import { describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import { avisosDeEstilo } from './estilo';

/**
 * O aviso de estilo de D17, verificado por execução.
 *
 * Duas metades, e a segunda protege a primeira: cada construção que só existe
 * em JavaScript é apontada na linha certa; e o catálogo, que segue D17 por
 * revisão, sai sem aviso nenhum — um verificador que acusasse o que o próprio
 * projeto usa ensinaria o professor a ignorá-lo.
 */

const construcoes = (codigo: string) =>
  avisosDeEstilo(codigo).map((a) => `${a.linha}: ${a.construcao}`);

describe('o que é apontado', () => {
  it.each([
    ['let x = 1;', '1: declaração com let'],
    ['const x = 1;', '1: declaração com const'],
    ['var f = (x) => x + 1;', '1: função com =>'],
    ['var t = `topo = ${1}`;', '1: texto entre crases, com ${...}'],
    ['var { valor } = { valor: 1 };', '1: desestruturação'],
    ['var a = [1]; var b = [...a];', '1: espalhamento (...)'],
    ['var x = 1; if (x === 1) {}', '1: comparação com ==='],
    ['var x = 1; if (x !== 1) {}', '1: comparação com !=='],
    ['var x = null; var y = x ?? 0;', '1: operador ??'],
    ['var x = null; var y = x?.valor;', '1: acesso com ?.'],
    ['var a = [1]; for (var v of a) {}', '1: laço for...of'],
    ['var a = [1]; a.push(2);', '1: método de vetor push()'],
    ['var a = [1, 2]; a.length = 1;', '1: atribuição a length'],
  ])('%s', (codigo, esperado) => {
    expect(construcoes(codigo)).toContain(esperado);
  });

  it('aponta a linha em que a construção está', () => {
    const codigo = ['var itens = [];', 'var topo = -1;', 'itens.push(3);'].join('\n');
    expect(construcoes(codigo)).toEqual(['3: método de vetor push()']);
  });

  it('não repete a mesma construção na mesma linha', () => {
    expect(construcoes('var a = [1]; a.push(2); a.push(3);')).toEqual([
      '1: método de vetor push()',
    ]);
  });

  it('código que não compila não tem aviso: a sintaxe é conferida em outro lugar', () => {
    expect(avisosDeEstilo('var = ;')).toEqual([]);
  });
});

describe('o que não é apontado', () => {
  it('o que um estudante de Java ou C lê sem ajuda', () => {
    const codigo = [
      'class No {',
      '  constructor(valor, proximo) {',
      '    this.valor = valor;',
      '    this.proximo = proximo;',
      '  }',
      '}',
      'var cabeca = new No(1, null);',
      'var itens = [5, 3];',
      'function trocar(i, j) {',
      '  var temp = itens[i];',
      '  itens[i] = itens[j];',
      '  itens[j] = temp;',
      '}',
      'for (var i = 0; i < itens.length; i = i + 1) {',
      '  if (itens[i] == 3 && cabeca != null) { i++; }',
      '}',
      "var letra = 'pilha'.charAt(0);",
      'var meio = Math.floor((0 + 7) / 2);',
    ].join('\n');
    expect(avisosDeEstilo(codigo)).toEqual([]);
  });

  it.each(catalogo)('$id, nas duas versões', (exercicio) => {
    expect(construcoes(exercicio.codigoComDefeito)).toEqual([]);
    expect(construcoes(exercicio.codigoCorreto)).toEqual([]);
  });
});
