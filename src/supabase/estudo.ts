import { clienteAvulso, supabase } from './cliente';
import { identidadeAtual, sair } from './identidade';
import { sincronizarPendentes } from '../nucleo/metricas';
import type { GrupoDoEstudo } from '../estudo/percurso';
import type { PerfilDoParticipante } from '../estudo/perfil';

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
