import { supabase } from './cliente';
import { exercicioDoRascunho, NOMES_DA_ESTRUTURA } from '../nucleo/verificacao-do-exercicio';
import type {
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from '../nucleo/verificacao-do-exercicio';
import type { CasoDeTeste, CategoriaDefeito, Exercicio, TipoEstrutura } from '../nucleo/tipos';

/**
 * Os exercícios de professor no banco (D31, D33): o que a área de autoria, a
 * pré-visualização e a vitrine leem e escrevem, e o interruptor da coleta.
 *
 * Mora fora do núcleo pelo mesmo motivo das sessões (D21): fala com a rede. O
 * formato do conteúdo é do núcleo — o `RascunhoDeExercicio` —, e é por ele que
 * o banco e as telas se entendem.
 *
 * Quem decide o que cada um pode é o RLS e os gatilhos das migrações 0002 e
 * 0003, e não
 * este módulo: ele só pergunta. Mas uma alteração barrada pelo RLS volta sem
 * erro nenhum, só sem linha — por isso toda escrita confere que alcançou a
 * linha, e diz quando não alcançou, em vez de deixar a tela achar que salvou.
 */

/**
 * `em_revisao` continua no tipo porque continua no banco, mas desde D33
 * nenhuma transição leva a ele: a migração 0003 devolveu os que havia a
 * rascunho.
 */
export type SituacaoDoExercicio = 'rascunho' | 'em_revisao' | 'publicado' | 'retirado';

/** Muda quando a forma de `conteudo` mudar, para os antigos continuarem legíveis. */
export const FORMATO_DO_CONTEUDO = 1;

/**
 * O que fica em `conteudo`: o rascunho e, depois da publicação, a linha do
 * defeito e as linhas aceitas — calculadas pela verificação que o autor fez
 * na hora de publicar (D33). O aluno recebe o exercício sem o código correto
 * (D31), e não teria como derivá-las.
 */
export interface ConteudoDoExercicio extends RascunhoDeExercicio {
  linhaDoDefeito?: number;
  linhasAceitas?: number[];
}

/**
 * Só o que o professor escreveu. A linha do defeito e as linhas aceitas quem
 * grava é a publicação, a partir da verificação feita na hora; criar um
 * rascunho a partir de um publicado não as leva junto.
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
    ...(conteudo.secao ? { secao: conteudo.secao } : {}),
  };
}

export interface ExercicioDeProfessor {
  id: string;
  autorId: string;
  situacao: SituacaoDoExercicio;
  conteudo: ConteudoDoExercicio;
  /**
   * O comentário de uma devolução da antiga revisão (D31). Ninguém escreve
   * mais nenhum (D33); o que existe aparece ao autor como registro.
   */
  comentarioDaRevisao: string | null;
  criadoEm: string;
  atualizadoEm: string;
  publicadoEm: string | null;
  retiradoEm: string | null;
  /** Quem tirou do ar: o próprio autor, ou o pesquisador puxando o freio (D33). */
  retiradoPor: string | null;
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
    (c.linhasAceitas === undefined || ehListaDeNumeros(c.linhasAceitas)) &&
    // O agrupamento da ordenação só existe no vetor (D35): a estrutura decide o
    // desenho, e ordenar é coisa que se faz num vetor.
    (c.secao === undefined || (c.secao === 'ordenacao' && c.estrutura === 'vetor'));
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
    ...(c.secao !== undefined ? { secao: 'ordenacao' as const } : {}),
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
  comentario_da_revisao: string | null;
  criado_em: string;
  atualizado_em: string;
  publicado_em: string | null;
  retirado_em: string | null;
  retirado_por: string | null;
}

const COLUNAS =
  'id, autor_id, situacao, conteudo, comentario_da_revisao, criado_em, atualizado_em, ' +
  'publicado_em, retirado_em, retirado_por';

function deLinha(linha: LinhaDeExercicio): ExercicioDeProfessor | null {
  const conteudo = conteudoValido(linha.conteudo);
  if (!conteudo) return null;
  return {
    id: linha.id,
    autorId: linha.autor_id,
    situacao: linha.situacao,
    conteudo,
    comentarioDaRevisao: linha.comentario_da_revisao,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    publicadoEm: linha.publicado_em,
    retiradoEm: linha.retirado_em,
    retiradoPor: linha.retirado_por,
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
 * Os publicados de todos os professores, para o pesquisador poder retirar
 * qualquer um (D33). O RLS é que deixa o pesquisador ler todos; para qualquer
 * outra conta, a mesma consulta devolve só os próprios.
 */
export async function lerTodosOsPublicados(): Promise<ExercicioDeProfessor[]> {
  const linhas = await lerTodas<LinhaDeExercicio>((de, ate) =>
    cliente()
      .from('exercicios_de_professor')
      .select(COLUNAS)
      .eq('situacao', 'publicado')
      .order('publicado_em', { ascending: false })
      .order('id', { ascending: true })
      .range(de, ate)
  );
  return linhas.map(deLinha).filter((e): e is ExercicioDeProfessor => e !== null);
}

/**
 * Um exercício pela tabela, e não pela visão dos publicados: é a leitura da
 * pré-visualização (D33). O autor lê o próprio em qualquer situação, inclusive
 * com a seção oculta aos alunos; o pesquisador lê todos. Nulo se não existe,
 * se não está ao alcance desta conta ou se o conteúdo não tem a forma esperada.
 */
export async function lerExercicioPelaTabela(id: string): Promise<ExercicioDeProfessor | null> {
  const linhas = await lerTodas<LinhaDeExercicio>((de, ate) =>
    cliente().from('exercicios_de_professor').select(COLUNAS).eq('id', id).range(de, ate)
  );
  return linhas.length === 1 ? deLinha(linhas[0]) : null;
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
 * Publica pelo próprio autor (D33), com o rascunho exatamente como foi
 * verificado e o relatório dessa verificação. A linha do defeito e as linhas
 * aceitas vão para o conteúdo, porque o aluno não recebe o código correto e
 * não teria como derivá-las.
 *
 * Quem decide se publica é `publicacaoLiberada`, com a verificação feita
 * agora; o banco ainda recusa sem o relatório aprovado (0003), contra um
 * defeito desta tela, e carimba quem publicou.
 */
export async function publicar(
  id: string,
  rascunho: RascunhoDeExercicio,
  relatorio: RelatorioDaVerificacao
): Promise<void> {
  if (!relatorio.aprovado || !relatorio.derivado) {
    throw new Error('Só se publica um exercício que passou na verificação.');
  }
  const conteudo: ConteudoDoExercicio = { ...rascunho, ...relatorio.derivado };
  await alterar(
    id,
    { formato: FORMATO_DO_CONTEUDO, conteudo, verificacao: relatorio, situacao: 'publicado' },
    'O exercício não pôde ser publicado: ele não está mais em rascunho, não é seu, ou esta ' +
      'conta não tem o papel de professor.'
  );
}

/** O autor retira o próprio; o pesquisador, qualquer um (D33). */
export function retirar(id: string): Promise<void> {
  return alterar(
    id,
    { situacao: 'retirado' },
    'O exercício não pôde ser retirado: ele não está publicado, ou esta conta não pode retirá-lo.'
  );
}

// ----------------------------------------------- interruptor da coleta ---

export interface EstadoDaColeta {
  /** Ligado, a seção dos propostos não chega a aluno nenhum, pelo banco (0003). */
  propostosOcultos: boolean;
  alteradoEm: string;
}

/**
 * O estado do interruptor. Qualquer conta lê; nulo se a linha não está lá — a
 * migração 0003 não rodou —, e aí a visão dos publicados também não devolve
 * nada.
 */
export async function lerEstadoDaColeta(): Promise<EstadoDaColeta | null> {
  const { data, error } = await cliente()
    .from('coleta')
    .select('propostos_ocultos, alterado_em')
    .range(0, 0);
  if (error) throw new Error(error.message);
  const linha = (data ?? [])[0] as { propostos_ocultos: boolean; alterado_em: string } | undefined;
  return linha ? { propostosOcultos: linha.propostos_ocultos, alteradoEm: linha.alterado_em } : null;
}

/** Só o pesquisador mexe (0003); para outra conta, a escrita não alcança a linha. */
export async function mudarInterruptor(propostosOcultos: boolean): Promise<void> {
  const { data, error } = await cliente()
    .from('coleta')
    .update({ propostos_ocultos: propostosOcultos })
    .eq('unica', true)
    .select('unica');
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== 1) {
    throw new Error('O interruptor não mudou: só a conta de pesquisador pode mexer nele.');
  }
}
