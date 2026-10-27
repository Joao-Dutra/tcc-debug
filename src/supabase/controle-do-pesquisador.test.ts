import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O cliente do painel de controle (D38). A regra que falha calada aqui é uma
 * só: a função da 0005 recusa sem erro — grava a recusa e responde `ok:
 * false` —, e uma resposta sem `ok` verdadeiro não pode passar por feita.
 */

interface Chamada {
  funcao: string;
  argumentos: unknown;
}

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const chamadas: Chamada[] = [];
let responder: (chamada: Chamada) => Resposta = () => ({ data: { ok: true }, error: null });

vi.mock('./cliente', () => ({
  supabase: () => ({
    rpc: async (funcao: string, argumentos?: unknown) => {
      const chamada = { funcao, argumentos };
      chamadas.push(chamada);
      return responder(chamada);
    },
  }),
  supabaseConfigurado: () => true,
}));

const modulo = await import('./controle-do-pesquisador');

beforeEach(() => {
  chamadas.length = 0;
  responder = () => ({ data: { ok: true }, error: null });
});

describe('as ações do painel', () => {
  it('cada uma chama a sua função, com os parâmetros que a 0005 espera', async () => {
    await modulo.criarAplicacao('aeds1-2026', false);
    await modulo.definirAplicacaoAberta('aeds1-2026', false);
    await modulo.protegerAplicacao('aeds1-2026');
    responder = () => ({
      data: { ok: true, respostas: 1, sessoes: 2, participantes: 3, entradas_antes: 3 },
      error: null,
    });
    expect(await modulo.limparAplicacao('teste-1', 'teste-1')).toEqual({
      respostas: 1,
      sessoes: 2,
      participantes: 3,
      entradasAntes: 3,
    });
    expect(chamadas).toEqual([
      { funcao: 'criar_aplicacao', argumentos: { p_codigo: 'aeds1-2026', p_teste: false } },
      { funcao: 'definir_aplicacao_aberta', argumentos: { p_codigo: 'aeds1-2026', p_aberta: false } },
      { funcao: 'proteger_aplicacao', argumentos: { p_codigo: 'aeds1-2026' } },
      // O código digitado vai junto, para o banco conferir de novo.
      { funcao: 'limpar_aplicacao', argumentos: { p_codigo: 'teste-1', p_confirmacao: 'teste-1' } },
    ]);
  });

  it('a recusa do banco, sem erro, vira falha com o motivo', async () => {
    responder = () => ({ data: { ok: false, motivo: 'aplicacao-protegida' }, error: null });
    const falha = await modulo.limparAplicacao('piloto-nov', 'piloto-nov').catch((e: unknown) => e);
    expect(falha).toBeInstanceOf(modulo.RecusaDoPainel);
    expect((falha as InstanceType<typeof modulo.RecusaDoPainel>).motivo).toBe('aplicacao-protegida');
  });

  it('resposta sem ok verdadeiro não passa por feita, e o erro da rede sobe', async () => {
    responder = () => ({ data: null, error: null });
    await expect(modulo.criarAplicacao('x', true)).rejects.toBeInstanceOf(modulo.RecusaDoPainel);
    responder = () => ({ data: { protegida: true }, error: null });
    await expect(modulo.criarAplicacao('x', true)).rejects.toBeInstanceOf(modulo.RecusaDoPainel);
    responder = () => ({ data: null, error: { message: 'sem rede' } });
    await expect(modulo.criarAplicacao('x', true)).rejects.toThrow('sem rede');
  });

  it('a lista traduz as colunas e trata a contagem como número', async () => {
    responder = () => ({
      data: [
        {
          codigo: 'piloto-nov',
          aberta: true,
          protegida: false,
          entradas: 3,
          criada_em: '2026-10-27T10:00:00Z',
          participantes_a: 2,
          // `count(*)` é bigint; um proxy pode entregá-lo como texto.
          participantes_b: '1',
          sessoes: 9,
          respostas: 0,
        },
      ],
      error: null,
    });
    expect(await modulo.listarAplicacoes()).toEqual([
      {
        codigo: 'piloto-nov',
        aberta: true,
        protegida: false,
        entradas: 3,
        criadaEm: '2026-10-27T10:00:00Z',
        participantesA: 2,
        participantesB: 1,
        sessoes: 9,
        respostas: 0,
      },
    ]);
    expect(chamadas[0].funcao).toBe('listar_aplicacoes');
  });
});
