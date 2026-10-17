import type { NivelDeAndaime } from '../componentes/andaime';
import type { MarcaDoEstudo, MotivoDoEncerramento } from '../nucleo/metricas';

/**
 * O percurso da área do estudo (D37): a sequência fixa, o apoio de cada grupo
 * em cada etapa e os tempos. Tudo o que o piloto de novembro pode recalibrar
 * mora aqui, e só aqui.
 *
 * Sem React e sem navegador: as telas consultam, e quem guarda o estado entre
 * uma carga e outra é a interface.
 */

/** Atribuído pelo banco, alternando na ordem de entrada (0004). */
export type GrupoDoEstudo = 'A' | 'B';

/**
 * Os tempos de cada etapa. O aquecimento tem mais porque o tutorial corre
 * dentro dele. A aula tem 1h30: 10 + 5 × 8 = 50 minutos de exercício, e a
 * folga fica para os imprevistos do laboratório, e não para alongar o limite.
 *
 * Mudar um destes valores muda o ambiente de coleta: o texto do aviso cita os
 * dois, e a versão dele sobe junto (o teste do aviso cobra).
 */
export const LIMITE_DO_AQUECIMENTO_MS = 10 * 60_000;
export const LIMITE_POR_EXERCICIO_MS = 8 * 60_000;

export interface EtapaDoPercurso {
  exercicioId: string;
  aquecimento: boolean;
  limiteMs: number;
  /** O apoio de cada grupo nesta etapa. */
  apoio: Record<GrupoDoEstudo, NivelDeAndaime>;
}

const AMBOS_COM_APOIO = { A: 'com-apoio', B: 'com-apoio' } as const;
const A_COM = { A: 'com-apoio', B: 'sem-apoio' } as const;
const A_SEM = { A: 'sem-apoio', B: 'com-apoio' } as const;

/**
 * A sequência é a mesma para todos, e só o apoio alterna: o grupo A começa
 * com apoio, e o B, sem. Assim cada exercício é visto pelos dois grupos sob
 * condições opostas, e a diferença entre exercícios não se confunde com a
 * diferença entre condições.
 *
 * O aquecimento é com apoio para todos e fica fora da análise: é onde o
 * participante aprende a tela, e o tutorial abre sobre ele.
 */
export const ETAPAS: readonly EtapaDoPercurso[] = [
  { exercicioId: 'vetor-zerar-negativos', aquecimento: true, limiteMs: LIMITE_DO_AQUECIMENTO_MS, apoio: AMBOS_COM_APOIO },
  { exercicioId: 'pilha-desempilhar', aquecimento: false, limiteMs: LIMITE_POR_EXERCICIO_MS, apoio: A_COM },
  { exercicioId: 'fila-atender-todos', aquecimento: false, limiteMs: LIMITE_POR_EXERCICIO_MS, apoio: A_SEM },
  { exercicioId: 'lista-inserir-depois', aquecimento: false, limiteMs: LIMITE_POR_EXERCICIO_MS, apoio: A_COM },
  { exercicioId: 'vetor-ordenar-por-selecao', aquecimento: false, limiteMs: LIMITE_POR_EXERCICIO_MS, apoio: A_SEM },
  { exercicioId: 'vetor-ordenar', aquecimento: false, limiteMs: LIMITE_POR_EXERCICIO_MS, apoio: A_COM },
];

/** Quantos exercícios entram na análise: todos menos o aquecimento. */
export const EXERCICIOS_DA_ANALISE = ETAPAS.filter((e) => !e.aquecimento).length;

/**
 * Posição na sequência, e nunca desempenho: é igual para todos, e não diz o
 * que foi resolvido (D37).
 */
export function rotuloDaEtapa(etapa: number): string {
  return ETAPAS[etapa].aquecimento ? 'Aquecimento' : `Exercício ${etapa} de ${EXERCICIOS_DA_ANALISE}`;
}

export function ultimaEtapa(etapa: number): boolean {
  return etapa === ETAPAS.length - 1;
}

/** Onde o participante está no percurso. */
export type PassoDoPercurso =
  | { tela: 'perfil' }
  | { tela: 'exercicio'; etapa: number }
  | { tela: 'tempo-esgotado'; etapa: number }
  | { tela: 'questionario' }
  | { tela: 'agradecimento' };

/**
 * O percurso de um participante, do aceite do aviso ao agradecimento. A
 * interface guarda isto na aba (sessionStorage): um recarregamento não perde o
 * lugar, e outra aba — ou o próximo participante — começa do aviso.
 */
export interface EstadoDoPercurso {
  aplicacao: string;
  /** A versão do texto do aviso que a pessoa aceitou. */
  versaoDoAviso: number;
  /** A identidade anônima criada na entrada; nula sem banco. */
  participanteId: string | null;
  /** Nulo até a entrada no estudo, que acontece ao confirmar o perfil. */
  grupo: GrupoDoEstudo | null;
  /** O grupo foi escolhido no aparelho, porque não havia banco. */
  grupoNoAparelho: boolean;
  passo: PassoDoPercurso;
  /**
   * O fim de cada etapa já aberta, no relógio de parede, por índice. Gravado
   * na primeira abertura e nunca refeito: recarregar a página não devolve o
   * tempo. Relógio de parede, e não o monotônico, porque precisa sobreviver à
   * carga da página.
   */
  prazos: (number | null)[];
}

export function comecarPercurso(
  aplicacao: string,
  versaoDoAviso: number,
  participanteId: string | null
): EstadoDoPercurso {
  return {
    aplicacao,
    versaoDoAviso,
    participanteId,
    grupo: null,
    grupoNoAparelho: false,
    passo: { tela: 'perfil' },
    prazos: ETAPAS.map(() => null),
  };
}

/** Com o grupo, o participante vai para o aquecimento. */
export function entrarComGrupo(
  estado: EstadoDoPercurso,
  grupo: GrupoDoEstudo,
  noAparelho: boolean
): EstadoDoPercurso {
  return { ...estado, grupo, grupoNoAparelho: noAparelho, passo: { tela: 'exercicio', etapa: 0 } };
}

/** O prazo da etapa, gravado na primeira vez em que ela abre. */
export function abrirEtapa(estado: EstadoDoPercurso, etapa: number, agora: number): EstadoDoPercurso {
  if (estado.prazos[etapa] != null) return estado;
  const prazos = [...estado.prazos];
  prazos[etapa] = agora + ETAPAS[etapa].limiteMs;
  return { ...estado, prazos };
}

/** O que vem depois de uma etapa: a seguinte, ou, depois da última, o questionário. */
function depoisDa(etapa: number): PassoDoPercurso {
  return ultimaEtapa(etapa) ? { tela: 'questionario' } : { tela: 'exercicio', etapa: etapa + 1 };
}

/**
 * A etapa terminou. Pelo botão, segue direto; pelo prazo, passa antes pela
 * tela que diz que o tempo terminou, para a troca de exercício não pegar o
 * participante de surpresa no meio de uma digitação.
 */
export function encerrarEtapa(
  estado: EstadoDoPercurso,
  etapa: number,
  motivo: MotivoDoEncerramento
): EstadoDoPercurso {
  return {
    ...estado,
    passo: motivo === 'seguir' ? depoisDa(etapa) : { tela: 'tempo-esgotado', etapa },
  };
}

/** Da tela do tempo esgotado para a etapa seguinte. */
export function continuarDepoisDoTempo(estado: EstadoDoPercurso): EstadoDoPercurso {
  if (estado.passo.tela !== 'tempo-esgotado') return estado;
  return { ...estado, passo: depoisDa(estado.passo.etapa) };
}

/**
 * Do questionário respondido ao agradecimento. O questionário vem antes, e não
 * depois, porque é no agradecimento que o aparelho troca de identidade (D37):
 * a resposta precisa ser gravada pela identidade do participante.
 */
export function concluirQuestionario(estado: EstadoDoPercurso): EstadoDoPercurso {
  if (estado.passo.tela !== 'questionario') return estado;
  return { ...estado, passo: { tela: 'agradecimento' } };
}

/** A marca que vai em cada sessão aberta numa etapa. */
export function marcaDaEtapa(estado: EstadoDoPercurso, etapa: number): MarcaDoEstudo {
  return {
    aplicacao: estado.aplicacao,
    etapa,
    aquecimento: ETAPAS[etapa].aquecimento,
    ...(estado.grupoNoAparelho && estado.grupo ? { grupoNoAparelho: estado.grupo } : {}),
  };
}

/**
 * Lê de volta um estado guardado. O que não tiver a forma esperada é
 * descartado, e o participante recomeça do aviso: é melhor do que abrir um
 * exercício fora da sequência ou sob o apoio errado.
 */
export function interpretarPercurso(valor: unknown, aplicacao: string): EstadoDoPercurso | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const e = valor as Partial<EstadoDoPercurso>;
  if (e.aplicacao !== aplicacao) return null;
  if (typeof e.versaoDoAviso !== 'number') return null;
  if (e.participanteId !== null && typeof e.participanteId !== 'string') return null;
  if (e.grupo !== null && e.grupo !== 'A' && e.grupo !== 'B') return null;
  if (!Array.isArray(e.prazos) || e.prazos.length !== ETAPAS.length) return null;
  const passo = e.passo;
  if (typeof passo !== 'object' || passo === null) return null;
  const temEtapa = passo.tela === 'exercicio' || passo.tela === 'tempo-esgotado';
  if (temEtapa) {
    if (!Number.isInteger(passo.etapa) || passo.etapa < 0 || passo.etapa >= ETAPAS.length) return null;
    // Exercício sem grupo seria exercício sem apoio definido.
    if (e.grupo === null) return null;
  } else if (passo.tela === 'questionario') {
    // Só se chega ao questionário depois dos exercícios, e eles pedem grupo.
    if (e.grupo === null) return null;
  } else if (passo.tela !== 'perfil' && passo.tela !== 'agradecimento') {
    return null;
  }
  return e as EstadoDoPercurso;
}
