import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: a troca guarda o valor na temporária e depois não o
 * usa. A última atribuição lê `itens[j]`, que acabou de ser sobrescrito, e as
 * duas posições terminam com o mesmo valor — o que estava em `itens[j]` se
 * perde, e fica sozinho na caixa `temp`, sem voltar para o vetor.
 *
 * O quadro que denuncia é o terceiro passo da primeira troca: o arco leva de
 * volta para a direita o valor que acabou de chegar da direita (D27), as duas
 * caixas ficam com 3, e o 5 fica parado na temporária. A troca é o evento
 * central da ordenação, e é nela que o desenho é mais informativo que o
 * código.
 *
 * O laço externo anda com `ultimo`, que é uma posição de verdade — o fim do
 * trecho ainda desordenado —, e não com um contador de passagens. Assim os
 * dois marcadores do desenho apontam lugares que existem no vetor.
 */
export const vetorOrdenar: Exercicio = {
  id: 'vetor-ordenar',
  titulo: 'Vetor: a ordenação termina com valores repetidos',
  enunciado:
    'O programa deve deixar o vetor ordenado do menor para o maior valor. A cada passagem, ele ' +
    'compara cada par de vizinhos até a posição ultimo e troca os dois de lugar quando estão ' +
    'fora de ordem, de modo que o maior valor que resta vai parar em ultimo. Execute e ' +
    'acompanhe, na visualização, uma troca inteira: de onde sai cada valor e onde ele chega.',
  estrutura: 'vetor',
  categoriaDefeito: 'referencia-incorreta',
  dificuldade: 2,
  linhaDoDefeito: 12,
  variaveisObservadas: ['itens', 'j', 'ultimo', 'temp'],
  // `j` é o marcador principal: é o par que ele aponta que está sendo
  // comparado, e é dele que o anel acompanha a posição. `temp` não é posição
  // nenhuma, e por isso vira caixa de valor (D27).
  marcadores: ['j', 'ultimo'],
  // Miniatura da lista: o vetor por ordenar, com os dois marcadores nas pontas
  // do trecho. Estado que as duas versões atravessam antes de divergirem (D20).
  miniatura: {
    variaveis: { itens: [5, 3, 8, 1, 9], j: 0, ultimo: 4, temp: 0 },
  },

  codigoComDefeito: `var itens = [5, 3, 8, 1, 9];
var ultimo = 0;
var j = 0;
var temp = 0;

function ordenar() {
  for (ultimo = itens.length - 1; ultimo > 0; ultimo = ultimo - 1) {
    for (j = 0; j < ultimo; j = j + 1) {
      if (itens[j] > itens[j + 1]) {
        temp = itens[j];
        itens[j] = itens[j + 1];
        itens[j + 1] = itens[j];
      }
    }
  }
  return itens;
}

ordenar();`,

  codigoCorreto: `var itens = [5, 3, 8, 1, 9];
var ultimo = 0;
var j = 0;
var temp = 0;

function ordenar() {
  for (ultimo = itens.length - 1; ultimo > 0; ultimo = ultimo - 1) {
    for (j = 0; j < ultimo; j = j + 1) {
      if (itens[j] > itens[j + 1]) {
        temp = itens[j];
        itens[j] = itens[j + 1];
        itens[j + 1] = temp;
      }
    }
  }
  return itens;
}

ordenar();`,

  casosDeTeste: [
    {
      descricao: 'O vetor termina ordenado do menor para o maior',
      expressao: 'itens',
      esperado: [1, 3, 5, 8, 9],
    },
    {
      descricao: 'A soma dos valores continua a mesma do começo',
      expressao: 'itens[0] + itens[1] + itens[2] + itens[3] + itens[4]',
      esperado: 26,
    },
    {
      descricao: 'O maior valor termina na última posição',
      expressao: 'itens[4]',
      esperado: 9,
    },
    {
      descricao: 'O vetor mantém o mesmo tamanho',
      expressao: 'itens.length',
      esperado: 5,
    },
  ],

  dicas: [
    'Avance uma troca inteira, um passo de cada vez, e acompanhe quais posições mudam de valor.',
    'A caixa temp guarda um valor no começo da troca. Repare em que momento esse valor volta ' +
      'para o vetor.',
    'Depois de uma troca, cada uma das duas posições precisa ter o valor que estava na outra: ' +
      'nenhum dos dois pode se perder no caminho.',
  ],
};
