import { clienteAvulso, supabase } from './cliente';
import { identidadeAtual, sair } from './identidade';
import { sincronizarPendentes } from '../nucleo/metricas';
import type { GrupoDoEstudo } from '../estudo/percurso';
import type { PerfilDoParticipante } from '../estudo/perfil';
import type { RespostaDoQuestionario } from '../estudo/questionario';
import type { ParticipanteDoEstudo, RespostaLida } from '../estudo/exportacao';

/**
 * A área do estudo no banco (D37, migração 0004).
 *
 * Tudo aqui lança quando não consegue: ao contrário da gravação das sessões,
 * que espera a rede voltar, a entrada no estudo precisa do banco na hora —
 * sem ele não há grupo balanceado —, e a tela diz ao participante que chame o
 * pesquisador.
 */

export type SituacaoDaAplicacao = 'aberta' | 'encerrada' | 'inexistente';

function cliente() {
  const c = supabase();
  if (!c) throw new Error('o banco não está configurado nesta instalação');
  return c;
}

/**
 * Se o código existe e está aberto. Não grava nada e não consome vaga: é a
 * mesma leitura da conferência das máquinas, e funciona até sem identidade.
 */
export async function situacaoDaAplicacao(codigo: string): Promise<SituacaoDaAplicacao> {
  const { data, error } = await cliente().rpc('situacao_da_aplicacao', { p_codigo: codigo });
  if (error) throw new Error(error.message);
  return data as SituacaoDaAplicacao;
}

export interface Entrada {
  grupo: GrupoDoEstudo;
  ordemDeEntrada: number;
}

/**
 * Entra no estudo e recebe o grupo. A única porta que escreve o grupo é a
 * função do banco, que alterna A e B na ordem de entrada; repetir a chamada,
 * porque a resposta se perdeu, devolve o mesmo grupo sem consumir vaga.
 */
export async function entrarNoEstudo(
  aplicacao: string,
  versaoDoAviso: number,
  perfil: PerfilDoParticipante
): Promise<Entrada> {
  const { data, error } = await cliente().rpc('entrar_no_estudo', {
    p_aplicacao: aplicacao,
    p_versao_do_aviso: versaoDoAviso,
    p_aeds1: perfil.aeds1,
    p_depurador: perfil.depurador,
    p_usou_visualizacao: perfil.usouVisualizacao,
  });
  if (error) throw new Error(error.message);
  const linha = (data as { grupo: GrupoDoEstudo; ordem_de_entrada: number }[] | null)?.[0];
  if (!linha) throw new Error('o banco não devolveu o grupo');
  return { grupo: linha.grupo, ordemDeEntrada: linha.ordem_de_entrada };
}

export type GravacaoDaResposta = 'gravada' | 'ja-gravada';

/**
 * Grava a resposta do questionário com a identidade atual, que é a do
 * participante: o questionário vem antes da troca de identidade do fim.
 *
 * Insert simples, sem pedir a linha de volta: o participante não tem leitura
 * da tabela, e um `select` depois do insert seria recusado. Sem upsert pelo
 * mesmo motivo, e porque a resposta não se refaz. O reenvio de quem perdeu a
 * confirmação na rede bate na chave (participante, aplicação), e o conflito
 * quer dizer que a primeira chegou.
 */
export async function gravarRespostas(
  aplicacao: string,
  resposta: RespostaDoQuestionario
): Promise<GravacaoDaResposta> {
  const { error } = await cliente().from('respostas_do_questionario').insert({
    aplicacao,
    versao_do_questionario: resposta.versao,
    escalas: resposta.escalas,
    o_que_ajudou: resposta.oQueAjudou,
    o_que_atrapalhou: resposta.oQueAtrapalhou,
  });
  if (!error) return 'gravada';
  if (error.code === '23505') return 'ja-gravada';
  throw new Error(error.message);
}

/**
 * Troca a identidade do aparelho por uma anônima nova, e devolve o id dela.
 *
 * No laboratório os computadores são compartilhados, e reaproveitar a
 * identidade do navegador misturaria participantes. Antes da troca, sobe o
 * que estiver pendente: depois dela, a identidade anterior não volta, e o que
 * ficou no aparelho só sairia de lá à mão, pelo painel.
 */
export async function trocarPorAnonimaNova(): Promise<string> {
  cliente();
  await sincronizarPendentes();
  await sair();
  const { usuarioId, forma, falha } = identidadeAtual();
  if (!usuarioId || forma !== 'anonima') {
    throw new Error(falha ?? 'a identidade anônima não foi criada');
  }
  return usuarioId;
}

/** O que o painel do pesquisador lê do estudo, além das sessões. */
export interface DadosDoEstudo {
  /** Os códigos cadastrados, abertos ou não. */
  aplicacoes: string[];
  participantes: ParticipanteDoEstudo[];
  respostas: RespostaLida[];
}

const LINHAS_POR_PAGINA = 1000;

/**
 * Todas as linhas de uma tabela, página por página, até a página vazia —
 * pelo mesmo motivo da leitura das sessões (D22): o limite do projeto corta
 * a resposta em silêncio.
 */
async function lerTodas<Linha>(tabela: string, colunas: string, ordem: string[]): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (;;) {
    let consulta = cliente().from(tabela).select(colunas);
    for (const coluna of ordem) consulta = consulta.order(coluna, { ascending: true });
    const { data, error } = await consulta.range(linhas.length, linhas.length + LINHAS_POR_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as Linha[];
    if (pagina.length === 0) return linhas;
    linhas.push(...pagina);
  }
}

/**
 * As aplicações, os participantes e as respostas. Só o pesquisador lê estas
 * tabelas; para qualquer outra identidade, o RLS devolve listas vazias (0004).
 */
export async function lerDadosDoEstudo(): Promise<DadosDoEstudo> {
  const [aplicacoes, participantes, respostas] = await Promise.all([
    lerTodas<{ codigo: string }>('aplicacoes_do_estudo', 'codigo', ['codigo']),
    lerTodas<{
      participante_id: string;
      aplicacao: string;
      grupo: GrupoDoEstudo;
      ordem_de_entrada: number;
      aeds1: PerfilDoParticipante['aeds1'];
      depurador: PerfilDoParticipante['depurador'];
      usou_visualizacao: PerfilDoParticipante['usouVisualizacao'];
    }>(
      'participantes_do_estudo',
      'participante_id, aplicacao, grupo, ordem_de_entrada, aeds1, depurador, usou_visualizacao',
      ['aplicacao', 'ordem_de_entrada']
    ),
    lerTodas<{
      participante_id: string;
      aplicacao: string;
      versao_do_questionario: number;
      escalas: Record<string, number>;
      o_que_ajudou: string | null;
      o_que_atrapalhou: string | null;
    }>(
      'respostas_do_questionario',
      'participante_id, aplicacao, versao_do_questionario, escalas, o_que_ajudou, o_que_atrapalhou',
      ['aplicacao', 'participante_id']
    ),
  ]);
  return {
    aplicacoes: aplicacoes.map((a) => a.codigo),
    participantes: participantes.map((p) => ({
      participanteId: p.participante_id,
      aplicacao: p.aplicacao,
      grupo: p.grupo,
      ordemDeEntrada: p.ordem_de_entrada,
      perfil: { aeds1: p.aeds1, depurador: p.depurador, usouVisualizacao: p.usou_visualizacao },
    })),
    respostas: respostas.map((r) => ({
      participanteId: r.participante_id,
      aplicacao: r.aplicacao,
      versao: r.versao_do_questionario,
      escalas: r.escalas,
      oQueAjudou: r.o_que_ajudou,
      oQueAtrapalhou: r.o_que_atrapalhou,
    })),
  };
}

/**
 * A conferência da criação de identidade (D37), num cliente que não guarda
 * nada no navegador: a identidade do aparelho continua a mesma, e nenhuma
 * sessão é gravada. Cria, sim, um usuário anônimo no projeto — é isso que se
 * está testando —, e sai dele em seguida.
 */
export async function conferirIdentidadeAnonima(): Promise<void> {
  const avulso = clienteAvulso();
  if (!avulso) throw new Error('o banco não está configurado nesta instalação');
  const { data, error } = await avulso.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('o banco não devolveu a identidade');
  await avulso.auth.signOut();
}
