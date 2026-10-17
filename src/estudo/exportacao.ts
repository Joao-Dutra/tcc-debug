import { resumirSessao, sessaoValida } from '../nucleo/metricas';
import type { RegistroDeSessao } from '../nucleo/metricas';
import { duracaoAtivaMs } from '../nucleo/sinais-de-sessao';
import { ETAPAS } from './percurso';
import type { GrupoDoEstudo } from './percurso';
import type { PerfilDoParticipante } from './perfil';
import { ITENS_DA_VISUALIZACAO, ITENS_DO_SUS, escoreDoSus } from './questionario';

/**
 * O CSV do estudo (D37): uma linha por sessão do percurso, com o participante,
 * a sessão, as métricas, a navegação e o questionário lado a lado, pronto para
 * R e pandas.
 *
 * RFC 4180, UTF-8 sem BOM, vírgula como separador, ponto como decimal e CRLF
 * no fim de cada linha: é o que `read.csv` e `pandas.read_csv` leem sem
 * configuração. Ausente é campo vazio, que os dois leem como NA — nunca 0,
 * pela mesma razão do resumo: "não corrigiu" não pode colidir com "corrigiu
 * na hora". Verdadeiro e falso saem `true` e `false`, que os dois reconhecem.
 *
 * Sem React e sem navegador: o painel junta as fontes e baixa o texto.
 */

/** Uma linha de participantes_do_estudo, como o painel a lê. */
export interface ParticipanteDoEstudo {
  participanteId: string;
  aplicacao: string;
  grupo: GrupoDoEstudo;
  ordemDeEntrada: number;
  perfil: PerfilDoParticipante;
}

/** Uma linha de respostas_do_questionario, como o painel a lê. */
export interface RespostaLida {
  participanteId: string;
  aplicacao: string;
  versao: number;
  escalas: Partial<Record<string, number>>;
  oQueAjudou: string | null;
  oQueAtrapalhou: string | null;
}

/**
 * Como a sessão terminou, derivado do log, e não gravado (D37: o log guarda o
 * gesto, e não o juízo). Corrigir vale mais que o gesto do fim: quem corrige e
 * depois clica em seguir sai como corrigido.
 */
export type DesfechoNoEstudo = 'corrigido' | 'desistencia' | 'tempo-esgotado' | 'sem-encerramento';

export function desfechoNoEstudo(sessao: RegistroDeSessao): DesfechoNoEstudo {
  if (resumirSessao(sessao.eventos).corrigido) return 'corrigido';
  const encerramento = sessao.eventos.find((e) => e.tipo === 'encerramento');
  if (!encerramento) return 'sem-encerramento';
  return encerramento.motivo === 'seguir' ? 'desistencia' : 'tempo-esgotado';
}

/**
 * Se a sessão é o que o plano manda para aquela etapa e aquele grupo: o
 * exercício e o apoio. Nulo sem grupo, porque não há com o que comparar.
 *
 * Compara com o plano de agora, em `percurso.ts`. Se o plano for recalibrado
 * depois do piloto, as sessões do piloto passam a sair com `false` — e é o
 * filtro por aplicação que separa as duas coletas.
 */
export function apoioConfereComPlano(sessao: RegistroDeSessao, grupo: GrupoDoEstudo | null): boolean | null {
  if (!sessao.estudo || grupo === null) return null;
  const etapa = ETAPAS[sessao.estudo.etapa];
  if (!etapa) return false;
  return etapa.exercicioId === sessao.exercicioId && etapa.apoio[grupo] === sessao.andaime;
}

type Valor = string | number | boolean | null | undefined;

/** As colunas, na ordem do arquivo. A ordem é parte do formato. */
export const COLUNAS_DO_CSV = [
  // Participante
  'aplicacao',
  'participante_id',
  'grupo',
  'ordem_de_entrada',
  'perfil_aeds1',
  'perfil_depurador',
  'perfil_visualizacao',
  // Sessão
  'sessao_id',
  'versao_do_registro',
  'exercicio_id',
  'etapa',
  'aquecimento',
  'apoio',
  'apoio_confere_com_plano',
  'instante_de_inicio',
  'duracao_total_ms',
  'duracao_ativa_ms',
  'sessao_valida',
  'desfecho',
  // Métricas, recalculadas do log
  'tempo_ate_primeira_execucao_ms',
  'tempo_ate_localizacao_ms',
  'tempo_ate_correcao_ms',
  'execucoes',
  'execucoes_com_erro',
  'dicas_reveladas',
  'edicoes',
  'localizacoes_tentadas',
  'corrigido',
  // Navegação (D36)
  'navegacoes',
  'passos_distintos_visitados',
  'retrocessos',
  'tempo_ate_primeira_navegacao_ms',
  // Questionário
  'versao_do_questionario',
  ...ITENS_DO_SUS.map((i) => i.id.replace('-', '_')),
  'sus_escore',
  ...ITENS_DA_VISUALIZACAO.map((i) => i.id.replace('-', '_')),
  'ajudou',
  'atrapalhou',
] as const;

export type ColunaDoCsv = (typeof COLUNAS_DO_CSV)[number];

/** As sessões do percurso, de uma aplicação ou de todas. */
export function sessoesDoEstudo(sessoes: RegistroDeSessao[], aplicacao: string | null): RegistroDeSessao[] {
  return sessoes.filter((s) => s.estudo !== undefined && (aplicacao === null || s.estudo.aplicacao === aplicacao));
}

const chave = (participanteId: string | null, aplicacao: string) => `${aplicacao}\u0000${participanteId}`;

/**
 * As linhas do CSV, uma por sessão, ainda como valores. O questionário e o
 * perfil se repetem em cada linha do mesmo participante, e saem vazios para
 * quem não respondeu: é o formato longo, que a análise agrupa como quiser.
 */
export function linhasDoEstudo(
  sessoes: RegistroDeSessao[],
  participantes: ParticipanteDoEstudo[],
  respostas: RespostaLida[]
): Record<ColunaDoCsv, Valor>[] {
  const participantePor = new Map(participantes.map((p) => [chave(p.participanteId, p.aplicacao), p]));
  const respostaPor = new Map(respostas.map((r) => [chave(r.participanteId, r.aplicacao), r]));

  const linhas = sessoes
    .filter((s) => s.estudo !== undefined)
    .map((sessao) => {
      const marca = sessao.estudo!;
      const participante = participantePor.get(chave(sessao.participanteId, marca.aplicacao));
      const resposta = respostaPor.get(chave(sessao.participanteId, marca.aplicacao));
      // Sem banco, o grupo veio do aparelho, e mora na marca (D37).
      const grupo = participante?.grupo ?? marca.grupoNoAparelho ?? null;
      // Recalculado do log, e não lido do resumo gravado (D6).
      const r = resumirSessao(sessao.eventos);
      // A navegação só existe a partir da versão 10: antes dela, ausente é
      // "não coletado", e não zero.
      const comNavegacao = sessao.versao >= 10;

      const linha: Record<ColunaDoCsv, Valor> = {
        aplicacao: marca.aplicacao,
        participante_id: sessao.participanteId,
        grupo,
        ordem_de_entrada: participante?.ordemDeEntrada,
        perfil_aeds1: participante?.perfil.aeds1,
        perfil_depurador: participante?.perfil.depurador,
        perfil_visualizacao: participante?.perfil.usouVisualizacao,
        sessao_id: sessao.id,
        versao_do_registro: sessao.versao,
        exercicio_id: sessao.exercicioId,
        etapa: marca.etapa,
        aquecimento: marca.aquecimento,
        apoio: sessao.andaime,
        apoio_confere_com_plano: apoioConfereComPlano(sessao, grupo),
        instante_de_inicio: sessao.instanteDeInicio,
        duracao_total_ms: sessao.duracaoTotalMs,
        duracao_ativa_ms: duracaoAtivaMs(sessao),
        sessao_valida: sessaoValida(sessao),
        desfecho: desfechoNoEstudo(sessao),
        tempo_ate_primeira_execucao_ms: r.tempoAtePrimeiraExecucaoMs,
        tempo_ate_localizacao_ms: r.tempoAteLocalizacaoMs,
        tempo_ate_correcao_ms: r.tempoAteCorrecaoMs,
        execucoes: r.execucoes,
        execucoes_com_erro: r.execucoesComErro,
        dicas_reveladas: r.dicasReveladas,
        edicoes: r.edicoes,
        localizacoes_tentadas: r.localizacoesTentadas,
        corrigido: r.corrigido,
        navegacoes: comNavegacao ? r.navegacoes : null,
        passos_distintos_visitados: comNavegacao ? r.passosDistintosVisitados : null,
        retrocessos: comNavegacao ? r.retrocessos : null,
        tempo_ate_primeira_navegacao_ms: comNavegacao ? r.tempoAtePrimeiraNavegacaoMs : null,
        versao_do_questionario: resposta?.versao,
        sus_escore: resposta ? escoreDoSus(resposta.escalas) : null,
        ajudou: resposta?.oQueAjudou,
        atrapalhou: resposta?.oQueAtrapalhou,
      } as Record<ColunaDoCsv, Valor>;
      for (const item of [...ITENS_DO_SUS, ...ITENS_DA_VISUALIZACAO]) {
        linha[item.id.replace('-', '_') as ColunaDoCsv] = resposta?.escalas[item.id];
      }
      return { linha, participante };
    });

  // Na ordem da análise: aplicação, ordem de entrada, etapa, e o instante
  // desempata as sessões de uma mesma etapa (a recarga abre outra).
  linhas.sort(
    (a, b) =>
      compararTexto(a.linha.aplicacao, b.linha.aplicacao) ||
      (a.participante?.ordemDeEntrada ?? Infinity) - (b.participante?.ordemDeEntrada ?? Infinity) ||
      compararTexto(a.linha.participante_id, b.linha.participante_id) ||
      Number(a.linha.etapa) - Number(b.linha.etapa) ||
      compararTexto(a.linha.instante_de_inicio, b.linha.instante_de_inicio)
  );
  return linhas.map((l) => l.linha);
}

function compararTexto(a: Valor, b: Valor): number {
  const x = String(a ?? '');
  const y = String(b ?? '');
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Um campo pela RFC 4180: entre aspas só quando precisa — vírgula, aspas ou
 * quebra de linha —, com as aspas de dentro dobradas.
 *
 * O texto das respostas abertas sai como foi escrito. Um texto começando com
 * `=` seria lido como fórmula por uma planilha; o arquivo é para R e pandas,
 * e mudar o que o participante escreveu seria mexer no dado.
 */
export function campoDoCsv(valor: Valor): string {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function csvDoEstudo(
  sessoes: RegistroDeSessao[],
  participantes: ParticipanteDoEstudo[],
  respostas: RespostaLida[]
): string {
  const linhas = linhasDoEstudo(sessoes, participantes, respostas);
  return [COLUNAS_DO_CSV.join(','), ...linhas.map((l) => COLUNAS_DO_CSV.map((c) => campoDoCsv(l[c])).join(','))]
    .map((l) => `${l}\r\n`)
    .join('');
}
