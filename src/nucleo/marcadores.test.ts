import { beforeAll, describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import { instrumentar } from './instrumentar';
import type { ResultadoExecucao } from './tipos';

/**
 * Marcadores declarados pelo exercício e levados até o instantâneo (D27).
 *
 * O visualizador é puro e não conhece o exercício: se a declaração não chegar
 * pelo instantâneo, não há como separar a variável que aponta uma posição da
 * que guarda um valor — as duas são números. Por isso o caminho inteiro, do
 * exercício ao quadro, é verificado por execução.
 */

let rodarNoWorker: (pedido: unknown) => ResultadoExecucao;

beforeAll(async () => {
  // Mesmo `self` de mentira do teste de quadro-denúncia: em Node não há
  // Worker, e o código que roda é o mesmo do navegador.
  let saida: ResultadoExecucao | null = null;
  const falso: {
    onmessage: ((evento: { data: unknown }) => void) | null;
    postMessage: (mensagem: ResultadoExecucao) => void;
  } = {
    onmessage: null,
    postMessage: (mensagem) => {
      saida = mensagem;
    },
  };
  (globalThis as unknown as { self: typeof falso }).self = falso;
  await import('./executor.worker');
  rodarNoWorker = (pedido) => {
    saida = null;
    falso.onmessage?.({ data: pedido });
    if (saida === null) throw new Error('o Worker não respondeu');
    return saida;
  };
});

const CODIGO = `var itens = [3, 1];
var j = 0;
var temp = itens[j];
j = j + 1;`;

function executar(marcadores?: string[]): ResultadoExecucao {
  return rodarNoWorker({
    codigo: instrumentar(CODIGO),
    variaveisObservadas: ['itens', 'j', 'temp'],
    marcadores,
    casos: [],
  });
}

describe('marcadores no instantâneo', () => {
  it('chegam a todos os quadros, na ordem declarada', () => {
    const { instantaneos } = executar(['j']);
    expect(instantaneos.length).toBeGreaterThan(1);
    for (const instantaneo of instantaneos) expect(instantaneo.marcadores).toEqual(['j']);
  });

  it('sem declaração, o campo não existe — nenhuma variável vira marcador por engano', () => {
    for (const instantaneo of executar().instantaneos) {
      expect(instantaneo.marcadores).toBeUndefined();
    }
  });

  it('a declaração não mexe nas variáveis observadas', () => {
    const com = executar(['j']).instantaneos.map((i) => i.variaveis);
    const sem = executar().instantaneos.map((i) => i.variaveis);
    expect(com).toEqual(sem);
  });
});

describe('o catálogo', () => {
  it.each(catalogo.filter((e) => e.marcadores !== undefined))(
    '$id declara só marcadores que são variáveis observadas',
    (exercicio) => {
      // Um marcador fora das observadas nunca chega ao instantâneo, e o
      // desenho ficaria sem ele sem ninguém perceber.
      for (const marcador of exercicio.marcadores ?? []) {
        expect(exercicio.variaveisObservadas).toContain(marcador);
      }
    }
  );

  it.each(catalogo.filter((e) => e.estrutura === 'vetor'))(
    '$id, que é de vetor, declara os marcadores',
    (exercicio) => {
      // No vetor, quem não declara não tem marcador desenhado: o índice sairia
      // como se fosse um valor guardado numa caixa.
      expect(exercicio.marcadores ?? []).not.toHaveLength(0);
    }
  );
});
