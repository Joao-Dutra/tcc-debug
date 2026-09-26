import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RascunhoDeExercicio, RelatorioDaVerificacao } from '../nucleo/verificacao-do-exercicio';

/**
 * Os exercícios de professor no banco (D31), verificados por execução.
 *
 * Três regras, todas do tipo que falha em silêncio: uma linha malformada não
 * derruba a vitrine, e o que o aluno lê nunca traz o código correto; uma
 * escrita que o RLS barrou — sem erro, só sem linha — não pode passar por
 * salva; e o navegador não escreve autor nem situação ao criar, que são do
 * banco.
 */

interface Chamada {
  tabela: string;
  operacao: 'select' | 'insert' | 'update' | 'delete';
  dados?: unknown;
  filtros: [string, unknown][];
  faixa?: [number, number];
}

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const chamadas: Chamada[] = [];
let responder: (chamada: Chamada) => Resposta = () => ({ data: [], error: null });

/** Uma consulta encadeável que responde quando é aguardada, como a do Supabase. */
interface Consulta extends PromiseLike<Resposta> {
  select: (...args: unknown[]) => Consulta;
  insert: (dados: unknown) => Consulta;
  update: (dados: unknown) => Consulta;
  delete: () => Consulta;
  eq: (coluna: string, valor: unknown) => Consulta;
  in: (coluna: string, valores: unknown) => Consulta;
  order: (...args: unknown[]) => Consulta;
  range: (de: number, ate: number) => Consulta;
  single: () => Consulta;
}

function consulta(tabela: string): Consulta {
  const chamada: Chamada = { tabela, operacao: 'select', filtros: [] };
  const c: Consulta = {
    select: () => c,
    insert: (dados) => {
      chamada.operacao = 'insert';
      chamada.dados = dados;
      return c;
    },
    update: (dados) => {
      chamada.operacao = 'update';
      chamada.dados = dados;
      return c;
    },
    delete: () => {
      chamada.operacao = 'delete';
      return c;
    },
    eq: (coluna, valor) => {
      chamada.filtros.push([coluna, valor]);
      return c;
    },
    in: (coluna, valores) => {
      chamada.filtros.push([coluna, valores]);
      return c;
    },
    order: () => c,
    range: (de, ate) => {
      chamada.faixa = [de, ate];
      return c;
    },
    single: () => c,
    then: (resolver, rejeitar) => {
      chamadas.push(chamada);
      return Promise.resolve(responder(chamada)).then(resolver, rejeitar);
    },
  };
  return c;
}

vi.mock('./cliente', () => ({
  supabase: () => ({ from: consulta }),
  supabaseConfigurado: () => true,
}));

const modulo = await import('./exercicios-de-professor');

const RASCUNHO: RascunhoDeExercicio = {
  titulo: 'Vetor: exemplo',
  enunciado: 'Enunciado.',
  estrutura: 'vetor',
  dificuldade: 2,
  categoriaDefeito: 'indice-deslocado',
  codigoCorreto: 'var itens = [1];\nvar indice = 0;',
  codigoComDefeito: 'var itens = [1];\nvar indice = 1;',
  casosDeTeste: [{ descricao: 'caso', expressao: 'indice', esperado: 0 }],
  dicas: ['a', 'b', 'c'],
  marcadores: ['indice'],
  variaveisDeValor: [],
};

beforeEach(() => {
  chamadas.length = 0;
  responder = () => ({ data: [], error: null });
});

describe('os publicados, como o aluno os recebe', () => {
  it('vêm pela visão, sem o código correto, com a linha que a publicação gravou', async () => {
    const { codigoCorreto: _semEle, ...semCorreto } = RASCUNHO;
    let pagina = 0;
    responder = () => {
      pagina++;
      if (pagina > 1) return { data: [], error: null };
      return {
        data: [
          {
            id: 'uuid-1',
            conteudo: { ...semCorreto, linhaDoDefeito: 2 },
            publicado_em: '2026-09-26T10:00:00Z',
          },
        ],
        error: null,
      };
    };
    const [exercicio, ...resto] = await modulo.lerExerciciosPublicados();
    expect(resto).toEqual([]);
    expect(chamadas[0].tabela).toBe('exercicios_publicados');
    expect(exercicio).toMatchObject({
      id: 'uuid-1',
      linhaDoDefeito: 2,
      codigoCorreto: '',
      variaveisObservadas: ['itens', 'indice'],
      marcadores: ['indice'],
    });
    expect(exercicio.miniatura).toBeUndefined();
  });

  it('linha malformada ou sem a linha do defeito fica de fora, sem derrubar as outras', async () => {
    let pagina = 0;
    responder = () => {
      pagina++;
      if (pagina > 1) return { data: [], error: null };
      return {
        data: [
          { id: 'boa', conteudo: { ...RASCUNHO, linhaDoDefeito: 2 }, publicado_em: 'x' },
          { id: 'malformada', conteudo: { titulo: 'só o título' }, publicado_em: 'x' },
          { id: 'sem-linha', conteudo: { ...RASCUNHO }, publicado_em: 'x' },
          { id: 'nula', conteudo: null, publicado_em: 'x' },
        ],
        error: null,
      };
    };
    const lidos = await modulo.lerExerciciosPublicados();
    expect(lidos.map((e) => e.id)).toEqual(['boa']);
  });

  it('a leitura vai até a página vazia, e não para na primeira curta', async () => {
    // O servidor corta a página em silêncio (D22).
    let pagina = 0;
    responder = () => {
      pagina++;
      if (pagina > 2) return { data: [], error: null };
      return {
        data: [{ id: `p${pagina}`, conteudo: { ...RASCUNHO, linhaDoDefeito: 2 }, publicado_em: 'x' }],
        error: null,
      };
    };
    const lidos = await modulo.lerExerciciosPublicados();
    expect(lidos.map((e) => e.id)).toEqual(['p1', 'p2']);
    expect(chamadas).toHaveLength(3);
  });
});

describe('escrita', () => {
  it('criar manda só o formato e o conteúdo: autor e situação são do banco', async () => {
    responder = () => ({ data: { id: 'novo' }, error: null });
    expect(await modulo.criarRascunho(RASCUNHO)).toBe('novo');
    expect(chamadas[0]).toMatchObject({
      tabela: 'exercicios_de_professor',
      operacao: 'insert',
      dados: { formato: modulo.FORMATO_DO_CONTEUDO, conteudo: RASCUNHO },
    });
    expect(chamadas[0].dados).not.toHaveProperty('autor_id');
    expect(chamadas[0].dados).not.toHaveProperty('situacao');
  });

  it('a escrita que o RLS barrou, sem erro e sem linha, não passa por salva', async () => {
    responder = () => ({ data: [], error: null });
    await expect(modulo.salvarRascunho('uuid-1', RASCUNHO)).rejects.toThrow(
      /não está mais em rascunho, ou não é seu/
    );
  });

  it('enviar exige o relatório aprovado, e nem chega ao banco sem ele', async () => {
    const reprovado = { aprovado: false } as RelatorioDaVerificacao;
    await expect(modulo.enviarParaRevisao('uuid-1', RASCUNHO, reprovado)).rejects.toThrow(
      /passou na verificação/
    );
    expect(chamadas).toEqual([]);
  });

  it('publicar grava a linha do defeito e as linhas aceitas no conteúdo', async () => {
    responder = () => ({ data: [{ id: 'uuid-1' }], error: null });
    await modulo.publicar('uuid-1', RASCUNHO, { linhaDoDefeito: 2, linhasAceitas: [2] });
    expect(chamadas[0]).toMatchObject({
      operacao: 'update',
      filtros: [['id', 'uuid-1']],
      dados: {
        situacao: 'publicado',
        conteudo: { ...RASCUNHO, linhaDoDefeito: 2, linhasAceitas: [2] },
      },
    });
  });

  it('"meus exercícios" filtra pelo autor, e não só pelo RLS', async () => {
    // A conta de um pesquisador enxerga todos; "meus" precisa querer dizer meus.
    await modulo.lerMeusExercicios('uid-do-professor');
    expect(chamadas[0].filtros).toContainEqual(['autor_id', 'uid-do-professor']);
  });
});

describe('o conteúdo guardado', () => {
  it('é conferido campo a campo', () => {
    expect(modulo.conteudoValido(RASCUNHO)).toEqual(RASCUNHO);
    expect(modulo.conteudoValido({ ...RASCUNHO, estrutura: 'arvore' })).toBeNull();
    expect(modulo.conteudoValido({ ...RASCUNHO, dificuldade: 4 })).toBeNull();
    expect(modulo.conteudoValido({ ...RASCUNHO, dicas: [1, 2, 3] })).toBeNull();
    expect(modulo.conteudoValido({ ...RASCUNHO, casosDeTeste: [{ descricao: 'x' }] })).toBeNull();
  });

  it('sem o código correto só vale na leitura dos publicados', () => {
    const { codigoCorreto: _semEle, ...semCorreto } = RASCUNHO;
    expect(modulo.conteudoValido(semCorreto)).toBeNull();
    expect(modulo.conteudoValido(semCorreto, true)?.codigoCorreto).toBe('');
  });
});
