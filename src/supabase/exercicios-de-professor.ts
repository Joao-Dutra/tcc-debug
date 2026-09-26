import { supabase } from './cliente';
import { exercicioDoRascunho, NOMES_DA_ESTRUTURA } from '../nucleo/verificacao-do-exercicio';
import type {
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from '../nucleo/verificacao-do-exercicio';
import type { CasoDeTeste, CategoriaDefeito, Exercicio, TipoEstrutura } from '../nucleo/tipos';

/**
 * Os exercícios de professor no banco (D31): o que a área de autoria, a
 * revisão e a vitrine leem e escrevem.
 *
 * Mora fora do núcleo pelo mesmo motivo das sessões (D21): fala com a rede. O
 * formato do conteúdo é do núcleo — o `RascunhoDeExercicio` —, e é por ele que
 * o banco e as telas se entendem.
 *
 * Quem decide o que cada um pode é o RLS e o gatilho da migração 0002, e não
 * este módulo: ele só pergunta. Mas uma alteração barrada pelo RLS volta sem
 * erro nenhum, só sem linha — por isso toda escrita confere que alcançou a
 * linha, e diz quando não alcançou, em vez de deixar a tela achar que salvou.
 */

export type SituacaoDoExercicio = 'rascunho' | 'em_revisao' | 'publicado' | 'retirado';

/** Muda quando a forma de `conteudo` mudar, para os antigos continuarem legíveis. */
export const FORMATO_DO_CONTEUDO = 1;

/**
 * O que fica em `conteudo`: o rascunho e, depois da publicação, a linha do
 * defeito e as linhas aceitas — calculadas pela verificação refeita no
 * navegador do pesquisador. O aluno recebe o exercício sem o código correto
 * (D31), e não teria como derivá-las.
 */
export interface ConteudoDoExercicio extends RascunhoDeExercicio {
  linhaDoDefeito?: number;
  linhasAceitas?: number[];
}

/**
 * Só o que o professor escreveu. A linha do defeito e as linhas aceitas quem
 * grava é a publicação, a partir da verificação refeita; se vierem no conteúdo
 * de um exercício em revisão, foram escritas por outro caminho, e a revisão
 * não as usa.
 */
export function rascunhoDoConteudo(conteudo: ConteudoDoExercicio): RascunhoDeExercicio {
  return {
    titulo: conteudo.titulo,
    enunciado: conteudo.enunciado,
    estrutura: conteudo.estrutura,
    dificuldade: conteudo.dificuldade,
    categoriaDefeito: conteudo.categoriaDefeito,
    codigoCorreto: conteudo.codigoCorreto,
    codigoComDefeito: conteudo.codigoComDefeito,
    casosDeTeste: conteudo.casosDeTeste,
    dicas: conteudo.dicas,
    marcadores: conteudo.marcadores,
    variaveisDeValor: conteudo.variaveisDeValor,
  };
}

export interface ExercicioDeProfessor {
  id: string;
  autorId: string;
  situacao: SituacaoDoExercicio;
  conteudo: ConteudoDoExercicio;
  /**
   * O relatório que o navegador de quem enviou gravou. **Não prova nada**: pode
   * ter sido escrito por acesso direto à API. Serve para o pesquisador ver o
   * que o professor viu, e a decisão de publicar depende só da verificação
   * refeita no navegador dele (D31).
   */
  verificacaoDoProfessor: unknown;
  comentarioDaRevisao: string | null;
  criadoEm: string;
  atualizadoEm: string;
  enviadoEm: string | null;
  publicadoEm: string | null;
}

// ------------------------------------------------------------ leitura ---

const ESTRUTURAS = Object.keys(NOMES_DA_ESTRUTURA) as TipoEstrutura[];
const CATEGORIAS: readonly CategoriaDefeito[] = [
  'condicao-de-parada',
  'indice-deslocado',
  'referencia-incorreta',
  'ordem-de-operacoes',
  'inicializacao-incorreta',
];

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehListaDeTexto = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto);
const ehListaDeNumeros = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((n) => Number.isInteger(n));

function ehCaso(v: unknown): v is CasoDeTeste {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return ehTexto(c.descricao) && ehTexto(c.expressao) && 'esperado' in c;
}

/**
 * O conteúdo, se ele tiver a forma que o núcleo espera; nulo se não tiver. Uma
 * linha do banco malformada — escrita à mão, ou por uma versão futura — não pode
 * derrubar a vitrine do aluno: ela simplesmente não aparece.
 *
 * `semCodigoCorreto` é a leitura pela visão dos publicados, que tira o código
 * correto de propósito.
 */
export function conteudoValido(
  valor: unknown,
  semCodigoCorreto = false
): ConteudoDoExercicio | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const c = valor as Record<string, unknown>;
  const valido =
    ehTexto(c.titulo) &&
    ehTexto(c.enunciado) &&
    ESTRUTURAS.includes(c.estrutura as TipoEstrutura) &&
    [1, 2, 3].includes(c.dificuldade as number) &&
    CATEGORIAS.includes(c.categoriaDefeito as CategoriaDefeito) &&
    ehTexto(c.codigoComDefeito) &&
    (semCodigoCorreto || ehTexto(c.codigoCorreto)) &&
    Array.isArray(c.casosDeTeste) &&
    c.casosDeTeste.every(ehCaso) &&
    ehListaDeTexto(c.dicas) &&
    ehListaDeTexto(c.marcadores) &&
    ehListaDeTexto(c.variaveisDeValor) &&
    (c.linhaDoDefeito === undefined || Number.isInteger(c.linhaDoDefeito)) &&
    (c.linhasAceitas === undefined || ehListaDeNumeros(c.linhasAceitas));
  if (!valido) return null;
  return {
    titulo: c.titulo as string,
    enunciado: c.enunciado as string,
    estrutura: c.estrutura as TipoEstrutura,
    dificuldade: c.dificuldade as 1 | 2 | 3,
    categoriaDefeito: c.categoriaDefeito as CategoriaDefeito,
    // Pela visão ele não vem, e nenhuma tela do aluno o usa.
    codigoCorreto: semCodigoCorreto ? '' : (c.codigoCorreto as string),
    codigoComDefeito: c.codigoComDefeito as string,
    casosDeTeste: c.casosDeTeste as CasoDeTeste[],
    dicas: c.dicas as string[],
    marcadores: c.marcadores as string[],
    variaveisDeValor: c.variaveisDeValor as string[],
    ...(c.linhaDoDefeito !== undefined ? { linhaDoDefeito: c.linhaDoDefeito as number } : {}),
    ...(c.linhasAceitas !== undefined ? { linhasAceitas: c.linhasAceitas as number[] } : {}),
  };
}

/** Uma linha de `exercicios_de_professor`, com os nomes do banco. */
interface LinhaDeExercicio {
  id: string;
  autor_id: string;
  situacao: SituacaoDoExercicio;
  conteudo: unknown;
  verificacao: unknown;
  comentario_da_revisao: string | null;
  criado_em: string;
  atualizado_em: string;
  enviado_em: string | null;
  publicado_em: string | null;
}

const COLUNAS =
  'id, autor_id, situacao, conteudo, verificacao, comentario_da_revisao, criado_em, ' +
  'atualizado_em, enviado_em, publicado_em';

function deLinha(linha: LinhaDeExercicio): ExercicioDeProfessor | null {
  const conteudo = conteudoValido(linha.conteudo);
  if (!conteudo) return null;
  return {
    id: linha.id,
    autorId: linha.autor_id,
    situacao: linha.situacao,
    conteudo,
    verificacaoDoProfessor: linha.verificacao,
    comentarioDaRevisao: linha.comentario_da_revisao,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    enviadoEm: linha.enviado_em,
    publicadoEm: linha.publicado_em,
  };
}

function cliente() {
  const c = supabase();
  if (!c) throw new Error('O banco não está configurado nesta instalação.');
  return c;
}

/** Até a página vazia, e não até a curta: o servidor corta em silêncio (D22). */
const POR_PAGINA = 1000;

async function lerTodas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const linhas: T[] = [];
  for (;;) {
    const { data, error } = await pagina(linhas.length, linhas.length + POR_PAGINA - 1);
    if (error) throw new Error(error.message);
    const lidas = (data ?? []) as T[];
    if (lidas.length === 0) return linhas;
    linhas.push(...lidas);
  }
}

/** Os exercícios do próprio professor, em qualquer situação, do mais recente. */
export async function lerMeusExercicios(autorId: string): Promise<ExercicioDeProfessor[]> {
  // Pelo autor, e não só pelo RLS: a conta de um pesquisador enxerga todos, e
  // "meus" precisa querer dizer meus.
  const linhas = await lerTodas<LinhaDeExercicio>((de, ate) =>
    cliente()
      .from('exercicios_de_professor')
      .select(COLUNAS)
      .eq('autor_id', autorId)
      .order('atualizado_em', { ascending: false })
      .order('id', { ascending: true })
      .range(de, ate)
  );
  return linhas.map(deLinha).filter((e): e is ExercicioDeProfessor => e !== null);
}

/**
 * O que o pesquisador revisa: tudo o que saiu do rascunho. O RLS é que deixa o
 * pesquisador ler todos; para qualquer outra conta, a mesma consulta devolve só
 * os próprios.
 */
export async function lerExerciciosDaRevisao(): Promise<ExercicioDeProfessor[]> {
  const linhas = await lerTodas<LinhaDeExercicio>((de, ate) =>
    cliente()
      .from('exercicios_de_professor')
      .select(COLUNAS)
      .in('situacao', ['em_revisao', 'publicado', 'retirado'])
      .order('atualizado_em', { ascending: false })
      .order('id', { ascending: true })
      .range(de, ate)
  );
  return linhas.map(deLinha).filter((e): e is ExercicioDeProfessor => e !== null);
}

interface LinhaPublicada {
  id: string;
  conteudo: unknown;
  publicado_em: string;
}

/**
 * Os publicados, como exercícios prontos para a tela do aluno — pela visão, que
 * não traz o código correto.
 *
 * Só entra o que tem a linha do defeito, que a publicação grava: sem ela o
 * veredito da localização não tem com o que comparar. E o que não tem a forma
 * esperada fica de fora em silêncio, porque a vitrine do aluno não é lugar de
 * mensagem de erro do banco.
 */
export async function lerExerciciosPublicados(): Promise<Exercicio[]> {
  const linhas = await lerTodas<LinhaPublicada>((de, ate) =>
    cliente()
      .from('exercicios_publicados')
      .select('id, conteudo, publicado_em')
      .order('publicado_em', { ascending: true })
      .order('id', { ascending: true })
      .range(de, ate)
  );
  const exercicios: Exercicio[] = [];
  for (const linha of linhas) {
    const conteudo = conteudoValido(linha.conteudo, true);
    if (!conteudo || conteudo.linhaDoDefeito === undefined) continue;
    exercicios.push(
      exercicioDoRascunho(linha.id, conteudo, {
        linhaDoDefeito: conteudo.linhaDoDefeito,
        linhasAceitas: conteudo.linhasAceitas ?? [conteudo.linhaDoDefeito],
      })
    );
  }
  return exercicios;
}

// ------------------------------------------------------------- escrita ---

/**
 * Confere que a escrita alcançou a linha. O RLS barra uma alteração sem erro
 * nenhum — a linha só não está ao alcance —, e sem esta conferência a tela
 * diria "salvo" para o que o banco recusou.
 */
async function alterar(
  id: string,
  campos: Record<string, unknown>,
  seNaoAlcancou: string
): Promise<void> {
  const { data, error } = await cliente()
    .from('exercicios_de_professor')
    .update(campos)
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== 1) throw new Error(seNaoAlcancou);
}

export async function criarRascunho(rascunho: RascunhoDeExercicio): Promise<string> {
  // O autor e a situação o banco escreve sozinho (0002): o navegador não diz
  // quem é nem em que pé o exercício está.
  const { data, error } = await cliente()
    .from('exercicios_de_professor')
    .insert({ formato: FORMATO_DO_CONTEUDO, conteudo: rascunho })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? 'O banco não devolveu o rascunho criado.');
  }
  return data.id as string;
}

export function salvarRascunho(id: string, rascunho: RascunhoDeExercicio): Promise<void> {
  return alterar(
    id,
    { formato: FORMATO_DO_CONTEUDO, conteudo: rascunho },
    'O rascunho não pôde ser salvo: ele não está mais em rascunho, ou não é seu.'
  );
}

/**
 * Envia para revisão, com o relatório que o navegador do professor produziu. O
 * relatório vai junto para o pesquisador ver o que o professor viu — e só para
 * isso: quem decide a publicação é a verificação refeita na revisão.
 */
export async function enviarParaRevisao(
  id: string,
  rascunho: RascunhoDeExercicio,
  relatorio: RelatorioDaVerificacao
): Promise<void> {
  if (!relatorio.aprovado) {
    throw new Error('Só se envia um exercício que passou na verificação.');
  }
  await alterar(
    id,
    {
      formato: FORMATO_DO_CONTEUDO,
      conteudo: rascunho,
      verificacao: relatorio,
      situacao: 'em_revisao',
    },
    'O exercício não pôde ser enviado: ele não está mais em rascunho, ou não é seu.'
  );
}

export async function apagarRascunho(id: string): Promise<void> {
  const { data, error } = await cliente()
    .from('exercicios_de_professor')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== 1) {
    throw new Error('O rascunho não pôde ser apagado: ele não está mais em rascunho, ou não é seu.');
  }
}

/**
 * Publica, gravando junto a linha do defeito e as linhas aceitas que a
 * verificação refeita derivou. O banco carimba quem publicou (0002).
 */
export function publicar(
  id: string,
  rascunho: RascunhoDeExercicio,
  derivado: { linhaDoDefeito: number; linhasAceitas: number[] }
): Promise<void> {
  const conteudo: ConteudoDoExercicio = { ...rascunho, ...derivado };
  return alterar(
    id,
    { formato: FORMATO_DO_CONTEUDO, conteudo, situacao: 'publicado' },
    'O exercício não pôde ser publicado: ele não está mais em revisão, ou esta conta não é de ' +
      'pesquisador.'
  );
}

export function devolver(id: string, comentario: string): Promise<void> {
  return alterar(
    id,
    { situacao: 'rascunho', comentario_da_revisao: comentario },
    'O exercício não pôde ser devolvido: ele não está mais em revisão, ou esta conta não é de ' +
      'pesquisador.'
  );
}

export function retirar(id: string): Promise<void> {
  return alterar(
    id,
    { situacao: 'retirado' },
    'O exercício não pôde ser retirado: ele não está publicado, ou esta conta não é de pesquisador.'
  );
}
