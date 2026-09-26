import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistroDeSessao } from '../nucleo/metricas';
import type { LinhaDeSessao } from './sessoes-remotas';

/**
 * Leitura e gravação das sessões no banco, verificadas por execução (D22).
 *
 * Três regras, todas do tipo que falha em silêncio: a leitura não pode parar
 * antes do fim quando o servidor corta a página; uma sessão lida do banco sai
 * igual à que foi gravada; e um registro de outra identidade não pode derrubar
 * o lote inteiro dos que pertencem à identidade de agora.
 */

/** Banco de mentira: uma tabela em memória e um limite de linhas por resposta. */
const banco = {
  linhas: [] as LinhaDeSessao[],
  limiteDoServidor: 1000,
  upserts: [] as LinhaDeSessao[][],
};

const clienteFalso = {
  from: () => ({
    select: () => {
      const consulta = {
        order: () => consulta,
        range: (de: number, ate: number) => {
          const pedidas = banco.linhas.slice(de, ate + 1);
          // O servidor corta em silêncio o que passar do limite dele, por mais
          // que o pedido tenha sido maior.
          return Promise.resolve({ data: pedidas.slice(0, banco.limiteDoServidor), error: null });
        },
      };
      return consulta;
    },
    upsert: (linhas: LinhaDeSessao[]) => {
      banco.upserts.push(linhas);
      return Promise.resolve({ error: null });
    },
  }),
};

let usuarioAtual: string | null = 'uid-de-agora';

vi.mock('./cliente', () => ({
  supabase: () => clienteFalso,
  supabaseConfigurado: () => true,
}));

vi.mock('./identidade', () => ({
  identidadeAtual: () => ({ usuarioId: usuarioAtual }),
  iniciarIdentidade: () => Promise.resolve(),
  observarIdentidade: () => () => {},
}));

const { deLinha, destinoSupabase, lerSessoesDoBanco, paraLinha } = await import(
  './sessoes-remotas'
);

function registro(id: string, participanteId: string | null): RegistroDeSessao {
  return {
    versao: 4,
    id,
    exercicioId: 'vetor-dobrar',
    participanteId,
    andaime: 'com-apoio',
    instanteDeInicio: '2026-09-22T13:00:00.000Z',
    duracaoTotalMs: 1234,
    eventos: [{ tipo: 'dica', t: 10, indice: 0 }],
    resumo: {
      tempoAtePrimeiraExecucaoMs: null,
      tempoAteLocalizacaoMs: null,
      tempoAteCorrecaoMs: null,
      execucoes: 0,
      execucoesComErro: 0,
      dicasReveladas: 1,
      edicoes: 0,
      localizacoesTentadas: 0,
      corrigido: false,
    },
  };
}

beforeEach(() => {
  banco.linhas = [];
  banco.limiteDoServidor = 1000;
  banco.upserts = [];
  usuarioAtual = 'uid-de-agora';
});

describe('leitura do banco', () => {
  it('lê até o fim mesmo quando o servidor devolve menos do que o pedido', async () => {
    banco.linhas = Array.from({ length: 7 }, (_, i) =>
      paraLinha(registro(`sessao-${i}`, 'uid-a'), 'uid-a')
    );
    // Limite menor que a página pedida: toda resposta vem curta, e parar na
    // primeira resposta curta leria só as duas primeiras sessões.
    banco.limiteDoServidor = 2;

    const lidas = await lerSessoesDoBanco();

    expect(lidas.map((r) => r.id)).toEqual(banco.linhas.map((l) => l.id));
  });

  it('a sessão lida do banco sai igual à que foi gravada', () => {
    const original = registro('sessao-x', 'uid-a');
    const linha = paraLinha(original, 'uid-a');
    // O Postgres devolve o instante no formato dele, e não no do navegador.
    const vinda = { ...linha, instante_de_inicio: '2026-09-22 13:00:00+00' };

    expect(deLinha(vinda)).toEqual(original);
  });

  it('a origem do exercício vai e volta na versão 8, e não aparece nas anteriores (D31)', () => {
    const deProfessor = { ...registro('sessao-p', 'uid-a'), versao: 8, origemDoExercicio: 'professor' as const };
    expect(paraLinha(deProfessor, 'uid-a').origem_do_exercicio).toBe('professor');
    expect(deLinha(paraLinha(deProfessor, 'uid-a'))).toEqual(deProfessor);

    // Numa sessão antiga o banco preenche `catalogo` pelo padrão da coluna,
    // e isso não pode entrar no registro: ele não tinha o campo.
    const antiga = registro('sessao-antiga', 'uid-a');
    const lida = deLinha({ ...paraLinha(antiga, 'uid-a'), origem_do_exercicio: 'catalogo' });
    expect(lida).not.toHaveProperty('origemDoExercicio');
  });
});

describe('gravação no banco', () => {
  it('um registro de outra identidade fica de fora, e não derruba os demais', async () => {
    // O anônimo que existia neste aparelho antes de o pesquisador entrar.
    const deOutro = registro('do-anonimo-anterior', 'uid-anterior');
    const meu = registro('meu', 'uid-de-agora');
    const semIdentidade = registro('antigo', null);

    const gravados = await destinoSupabase().gravar([deOutro, meu, semIdentidade]);

    expect(gravados).toEqual(['meu', 'antigo']);
    expect(banco.upserts).toHaveLength(1);
    expect(banco.upserts[0].map((l) => [l.id, l.participante_id])).toEqual([
      ['meu', 'uid-de-agora'],
      ['antigo', 'uid-de-agora'],
    ]);
  });

  it('sem nada que a identidade de agora possa gravar, não vai à rede', async () => {
    const gravados = await destinoSupabase().gravar([registro('de-outro', 'uid-anterior')]);

    expect(gravados).toEqual([]);
    expect(banco.upserts).toEqual([]);
  });

  it('sem identidade, recusa o lote inteiro, que fica pendente', async () => {
    usuarioAtual = null;
    await expect(destinoSupabase().gravar([registro('x', null)])).rejects.toThrow(
      'ainda sem identidade'
    );
  });
});
