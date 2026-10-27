import { formularioDe, formularioVazio } from './formulario-do-exercicio';
import type { FormularioDoExercicio } from './formulario-do-exercicio';
import type { RascunhoDeExercicio } from '../nucleo/verificacao-do-exercicio';

/**
 * O formulário do professor guardado na aba, enquanto ele digita.
 *
 * `sessionStorage`, e não `localStorage`: o texto sobrevive a um
 * recarregamento, mas não passa para outra aba nem fica no navegador de um
 * computador compartilhado depois de fechado. O que é para durar vai para o
 * banco, pelo "Salvar".
 *
 * **Uma chave por exercício e por conta.** Um rascunho do banco tem a dele,
 * pelo id; o exercício novo, ainda sem id, tem uma só, "novo". A conta entra
 * na chave para que outra pessoa que entre na mesma aba não abra o texto de
 * quem saiu.
 *
 * **Junto do texto vai a base**: o conteúdo do banco a partir do qual ele foi
 * escrito, em forma canônica. Ao abrir o exercício, se o banco já não é a
 * base, alguém salvou depois — outra aba, outro aparelho —, e o texto guardado
 * não entra sozinho por cima do mais novo: a tela pergunta. A comparação é pelo
 * conteúdo, e não pela data, porque o próprio "Salvar" desta aba muda a data
 * sem que nada novo tenha chegado do banco.
 *
 * **Quando some.** Ao salvar e ao publicar com sucesso, e ao apagar o
 * rascunho: nos três casos o que vale passou a ser o banco. "Voltar à lista"
 * não apaga, de propósito: é o caminho de quem sai sem salvar, e é
 * exatamente o texto que esta guarda existe para não perder.
 *
 * **A verificação não é guardada.** Restaurado o texto, publicar e ver como o
 * aluno veria ficam travados até verificar de novo — a mesma regra de editar
 * depois de verificar (D31, D33). Guardar o relatório deixaria um navegador
 * dizer que verificou um texto que pode ter mudado no armazenamento.
 *
 * Sem armazenamento — modo privado, site bloqueado —, cada função vira nada,
 * e o editor funciona como antes.
 */

export type ArmazenamentoDaAba = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function armazenamentoDaAba(): ArmazenamentoDaAba | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const PREFIXO = 'depurar:rascunho-do-professor';

export function chaveDoRascunho(autorId: string, exercicioId: string | null): string {
  return `${PREFIXO}:${autorId}:${exercicioId ?? 'novo'}`;
}

/** Qual editor estava aberto, para um recarregamento voltar a ele. */
function chaveDoAberto(autorId: string): string {
  return `${PREFIXO}:${autorId}:aberto`;
}

export interface GuardadoNaAba {
  formulario: FormularioDoExercicio;
  /** O conteúdo do banco de que o texto partiu, canônico; nulo no exercício novo. */
  base: string | null;
}

/** JSON com as chaves em ordem: o `jsonb` do banco não guarda a ordem delas. */
function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

/** A base de um conteúdo do banco, no formulário em que o editor o mostra. */
export function baseDe(conteudo: RascunhoDeExercicio): string {
  return canonico(formularioDe(conteudo));
}

function guardar(armazenamento: ArmazenamentoDaAba | null, chave: string, valor: string): void {
  try {
    armazenamento?.setItem(chave, valor);
  } catch {
    // Cheio ou bloqueado: o editor segue, só sem a guarda.
  }
}

function esquecer(armazenamento: ArmazenamentoDaAba | null, chave: string): void {
  try {
    armazenamento?.removeItem(chave);
  } catch {
    // Idem.
  }
}

function ler(armazenamento: ArmazenamentoDaAba | null, chave: string): unknown {
  try {
    const bruto = armazenamento?.getItem(chave) ?? null;
    return bruto === null ? null : JSON.parse(bruto);
  } catch {
    return null;
  }
}

/**
 * Tem a forma do formulário: as mesmas chaves do vazio, com os mesmos tipos.
 * O que não tiver é descartado, e o editor abre do banco — melhor do que
 * abrir um formulário que a tela não sabe desenhar.
 */
function eFormulario(valor: unknown): valor is FormularioDoExercicio {
  if (typeof valor !== 'object' || valor === null) return false;
  const v = valor as Record<string, unknown>;
  const modelo = formularioVazio() as unknown as Record<string, unknown>;
  for (const [chave, padrao] of Object.entries(modelo)) {
    if (chave === 'agrupamento') {
      if (v[chave] !== null && typeof v[chave] !== 'string') return false;
    } else if (Array.isArray(padrao) !== Array.isArray(v[chave]) || typeof padrao !== typeof v[chave]) {
      return false;
    }
  }
  if ((v.dicas as unknown[]).length !== 3) return false;
  return (v.casos as unknown[]).every(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      ['descricao', 'expressao', 'esperado'].every((k) => typeof (c as Record<string, unknown>)[k] === 'string')
  );
}

export function guardarNaAba(
  armazenamento: ArmazenamentoDaAba | null,
  autorId: string,
  exercicioId: string | null,
  guardado: GuardadoNaAba
): void {
  guardar(armazenamento, chaveDoRascunho(autorId, exercicioId), JSON.stringify(guardado));
}

export function lerDaAba(
  armazenamento: ArmazenamentoDaAba | null,
  autorId: string,
  exercicioId: string | null
): GuardadoNaAba | null {
  const valor = ler(armazenamento, chaveDoRascunho(autorId, exercicioId));
  if (typeof valor !== 'object' || valor === null) return null;
  const g = valor as Partial<GuardadoNaAba>;
  if (!eFormulario(g.formulario)) return null;
  if (g.base !== null && typeof g.base !== 'string') return null;
  return { formulario: g.formulario, base: g.base };
}

export function esquecerDaAba(
  armazenamento: ArmazenamentoDaAba | null,
  autorId: string,
  exercicioId: string | null
): void {
  esquecer(armazenamento, chaveDoRascunho(autorId, exercicioId));
}

/** O editor aberto: o id do exercício, ou nulo para o novo. */
export function guardarAberto(
  armazenamento: ArmazenamentoDaAba | null,
  autorId: string,
  exercicioId: string | null
): void {
  guardar(armazenamento, chaveDoAberto(autorId), JSON.stringify({ exercicioId }));
}

/** Indefinido quando nenhum editor estava aberto. */
export function lerAberto(
  armazenamento: ArmazenamentoDaAba | null,
  autorId: string
): string | null | undefined {
  const valor = ler(armazenamento, chaveDoAberto(autorId));
  if (typeof valor !== 'object' || valor === null) return undefined;
  const { exercicioId } = valor as { exercicioId?: unknown };
  if (exercicioId === null || typeof exercicioId === 'string') return exercicioId;
  return undefined;
}

export function esquecerAberto(armazenamento: ArmazenamentoDaAba | null, autorId: string): void {
  esquecer(armazenamento, chaveDoAberto(autorId));
}

/**
 * O que fazer com o texto guardado ao abrir o editor.
 *
 * - `nada`: não há texto guardado, ou ele é igual ao que já se abriria.
 * - `restaurar`: o texto partiu do que se está abrindo; entra, e a tela diz
 *   que entrou.
 * - `conflito`: o texto partiu de outra coisa — o banco mudou depois, ou o
 *   exercício novo está sendo criado a partir de outro publicado. O professor
 *   escolhe, e até lá vale o que se abriu.
 *
 * `partida` é o que o editor abriria sem a guarda: o conteúdo do banco, a
 * cópia de um publicado, ou nulo para o formulário vazio. O exercício novo
 * aberto vazio — o botão "Novo exercício", ou o recarregamento de um novo —
 * restaura sem perguntar: não há linha no banco que alguém possa ter mudado.
 */
export type Restauracao = 'nada' | 'restaurar' | 'conflito';

export function decidirRestauracao(
  guardado: GuardadoNaAba | null,
  partida: RascunhoDeExercicio | null,
  exercicioNovo: boolean
): Restauracao {
  if (!guardado) return 'nada';
  const aberto = partida ? formularioDe(partida) : formularioVazio();
  if (canonico(guardado.formulario) === canonico(aberto)) return 'nada';
  if (exercicioNovo && !partida) return 'restaurar';
  return partida && guardado.base === baseDe(partida) ? 'restaurar' : 'conflito';
}
