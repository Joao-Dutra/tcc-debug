import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistroDeSessao } from '../nucleo/metricas';
import type { LinhaDeSessao } from './sessoes-remotas';

/**
 * Gravação das sessões no banco, verificada por execução (D22).
 *
 * A regra, do tipo que falha em silêncio: um registro de outra identidade não
 * pode derrubar o lote inteiro dos que pertencem à identidade de agora.
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

const { destinoSupabase } = await import('./sessoes-remotas');

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
