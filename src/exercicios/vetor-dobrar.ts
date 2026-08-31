import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: a posição escrita é a do índice, mas o valor lido vem da
 * posição seguinte. Cada posição recebe o dobro do vizinho, e a última recebe o
 * dobro de uma posição que não existe.
 *
 * Defeito e sintoma na mesma linha, de propósito: é exercício de entrada.
 */
export const vetorDobrar: Exercicio = {
  id: 'vetor-dobrar',
  titulo: 'Vetor: os dobros não batem com os valores originais',
  enunciado:
    'Cada posição do vetor deve passar a guardar o dobro do valor que estava nela. ' +
    'Execute e acompanhe, na visualização, o valor que cada posição recebe enquanto ' +
    'o índice avança.',
  estrutura: 'vetor',
  categoriaDefeito: 'indice-deslocado',
  dificuldade: 2,
  linhaDoDefeito: 6,
  variaveisObservadas: ['itens', 'indice'],

  codigoComDefeito: `var itens = [3, 5, 2, 8];
var indice = 0;

function dobrarTudo() {
  while (indice < itens.length) {
    itens[indice] = itens[indice + 1] * 2;
    indice = indice + 1;
  }
  return itens;
}

dobrarTudo();`,

  codigoCorreto: `var itens = [3, 5, 2, 8];
var indice = 0;

function dobrarTudo() {
  while (indice < itens.length) {
    itens[indice] = itens[indice] * 2;
    indice = indice + 1;
  }
  return itens;
}

dobrarTudo();`,

  casosDeTeste: [
    {
      descricao: 'Cada posição guarda o dobro do valor que estava nela',
      expressao: 'itens',
      esperado: [6, 10, 4, 16],
    },
    {
      descricao: 'A última posição guarda o dobro do valor que havia nela',
      expressao: 'itens[3]',
      esperado: 16,
    },
    {
      descricao: 'O laço percorre todas as posições do vetor',
      expressao: 'indice',
      esperado: 4,
    },
    {
      descricao: 'O vetor mantém o mesmo tamanho',
      expressao: 'itens.length',
      esperado: 4,
    },
  ],

  dicas: [
    'Acompanhe o anel do índice e o valor que a posição dentro dele recebe.',
    'Compare o valor que aparece na posição destacada com o que estava ali antes e com os das posições vizinhas.',
    'O valor escrito em uma posição precisa vir dela mesma, e não de outra.',
  ],
};
