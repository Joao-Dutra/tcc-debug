import { beforeAll, describe, expect, it } from 'vitest';
import { abrirWorker } from './worker-em-teste';
import type { RodarNoWorker } from './worker-em-teste';
import type { Instantaneo } from './tipos';

/**
 * A escrita que produziu cada quadro, anotada pelo núcleo (D27).
 *
 * Sem ela, uma troca entre duas posições aparece como o vetor simplesmente
 * trocado de um quadro para o outro. A anotação diz de onde para onde o valor
 * foi, e é o que permite desenhar o movimento.
 *
 * Duas regras a cobrar, e a segunda é a que protege o programa: a anotação
 * precisa cair no quadro DEPOIS da escrita, que é o que mostra o resultado
 * dela; e a sonda nunca pode avaliar duas vezes uma expressão com efeito
 * colateral — antes fica sem anotação.
 */

let rodar: RodarNoWorker;
beforeAll(async () => {
  rodar = await abrirWorker();
});

const OBSERVADAS = ['itens', 'j', 'temp'];

function quadros(codigo: string, variaveisObservadas = OBSERVADAS): Instantaneo[] {
  return rodar({ codigo, variaveisObservadas }).instantaneos;
}

/** O primeiro quadro que traz uma escrita anotada. */
const primeiraEscrita = (instantaneos: Instantaneo[]) => instantaneos.find((i) => i.escrita);

const TROCA = `var itens = [7, 4];
var j = 0;
var temp = itens[j];
itens[j] = itens[j + 1];
itens[j + 1] = temp;`;

describe('cópias simples', () => {
  it('anota de uma posição para uma variável', () => {
    const escrita = primeiraEscrita(quadros(TROCA))?.escrita;
    expect(escrita).toEqual({
      destino: { variavel: 'temp' },
      origem: { vetor: 'itens', indice: 0 },
    });
  });

  it('anota de uma posição para outra, com o índice já avaliado', () => {
    const anotadas = quadros(TROCA)
      .map((i) => i.escrita)
      .filter((e) => e !== undefined);
    // A troca inteira: para a temporária, entre as posições, e de volta.
    expect(anotadas).toEqual([
      { destino: { variavel: 'temp' }, origem: { vetor: 'itens', indice: 0 } },
      { destino: { vetor: 'itens', indice: 0 }, origem: { vetor: 'itens', indice: 1 } },
      { destino: { vetor: 'itens', indice: 1 }, origem: { variavel: 'temp' } },
    ]);
  });

  it('cai no quadro que mostra o resultado da escrita, e não no anterior', () => {
    const instantaneos = quadros(TROCA);
    const quadro = instantaneos.find(
      (i) => i.escrita && 'vetor' in i.escrita.destino && i.escrita.destino.indice === 0
    );
    expect(quadro, 'nenhum quadro trouxe a escrita na posição 0').toBeDefined();
    const posicaoZero = (instantaneo: Instantaneo) => (instantaneo.variaveis.itens as unknown[])[0];

    // A posição 0 já vale 4 neste quadro: ele é o depois da cópia.
    expect(posicaoZero(quadro as Instantaneo)).toBe(4);
    // E no quadro anterior ela ainda valia 7.
    expect(posicaoZero(instantaneos[(quadro as Instantaneo).ordem - 1])).toBe(7);
  });
});

describe('o que não é cópia de lugar nenhum', () => {
  it('valor calculado não vira escrita', () => {
    expect(primeiraEscrita(quadros(`var itens = [7, 4];
var j = 0;
itens[j] = itens[j] * 2;`))).toBeUndefined();
  });

  it('valor vindo de chamada não vira escrita', () => {
    // A chamada tem sondas dentro, e a anotação cairia num quadro de dentro
    // dela — um quadro em que a escrita ainda não aconteceu.
    expect(primeiraEscrita(quadros(`var itens = [7, 4];
var j = 0;
function dobro(x) {
  return x * 2;
}
itens[j] = dobro(itens[j]);`))).toBeUndefined();
  });

  it('literal não vira escrita: não veio de lugar nenhum', () => {
    expect(primeiraEscrita(quadros(`var itens = [7, 4];
var j = 0;
itens[j] = 0;`))).toBeUndefined();
  });
});

describe('índice com efeito colateral', () => {
  const COM_EFEITO = `var itens = [7, 4];
var j = 0;
var temp = 9;
itens[j++] = temp;`;

  it('não é anotado', () => {
    expect(primeiraEscrita(quadros(COM_EFEITO))).toBeUndefined();
  });

  it('e o programa continua o mesmo: o efeito acontece uma vez só', () => {
    // Se a sonda avaliasse o índice, j iria a 2 e a escrita cairia na posição
    // errada. É o motivo de a anotação existir só para expressões sem efeito.
    const ultimo = quadros(COM_EFEITO).at(-1);
    expect(ultimo?.variaveis.j).toBe(1);
    expect(ultimo?.variaveis.itens).toEqual([9, 4]);
  });
});

describe('o que o desenho não alcança', () => {
  it('escrita com uma ponta fora das observadas é descartada', () => {
    // `outro` não é observado: o desenho não tem onde mostrar a origem.
    const codigo = `var itens = [7, 4];
var j = 0;
var outro = 5;
itens[j] = outro;`;
    expect(primeiraEscrita(quadros(codigo))).toBeUndefined();
    // Observando a variável, a mesma escrita passa a ser anotada.
    expect(primeiraEscrita(quadros(codigo, [...OBSERVADAS, 'outro']))?.escrita).toEqual({
      destino: { vetor: 'itens', indice: 0 },
      origem: { variavel: 'outro' },
    });
  });

  it('a anotação não mexe nas variáveis dos quadros', () => {
    const comEscrita = quadros(TROCA).map((i) => [i.linha, i.variaveis]);
    const semEscrita = quadros(TROCA, ['itens']).map((i) => [i.linha, i.variaveis]);
    // As observadas mudam entre as duas execuções, mas a sequência de quadros
    // e as linhas são as mesmas: anotar não acrescenta nem tira passo.
    expect(comEscrita.map(([linha]) => linha)).toEqual(semEscrita.map(([linha]) => linha));
  });
});
