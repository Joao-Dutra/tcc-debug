import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: o índice começa em 1, então a primeira posição do vetor
 * nunca é verificada.
 *
 * Defeito e sintoma na mesma função, de propósito: é exercício de entrada, e a
 * distância entre a causa e o efeito é o que se guarda para os próximos.
 */
export const vetorZerarNegativos: Exercicio = {
  id: 'vetor-zerar-negativos',
  titulo: 'Vetor: um valor negativo sobrevive',
  enunciado:
    'O programa deve percorrer o vetor e substituir por zero todo valor negativo, ' +
    'deixando os demais como estão. Execute e acompanhe o índice na visualização ' +
    'enquanto as posições são verificadas.',
  estrutura: 'vetor',
  categoriaDefeito: 'inicializacao-incorreta',
  dificuldade: 1,
  linhaDoDefeito: 4,
  variaveisObservadas: ['itens', 'indice'],

  codigoComDefeito: `var itens = [-4, 2, -7, 9];

function zerarNegativos() {
  var indice = 1;
  while (indice < itens.length) {
    if (itens[indice] < 0) {
      itens[indice] = 0;
    }
    indice = indice + 1;
  }
  return itens;
}

zerarNegativos();`,

  codigoCorreto: `var itens = [-4, 2, -7, 9];

function zerarNegativos() {
  var indice = 0;
  while (indice < itens.length) {
    if (itens[indice] < 0) {
      itens[indice] = 0;
    }
    indice = indice + 1;
  }
  return itens;
}

zerarNegativos();`,

  casosDeTeste: [
    {
      descricao: 'Todo valor negativo é substituído por zero',
      expressao: 'itens',
      esperado: [0, 2, 0, 9],
    },
    {
      descricao: 'A posição de índice 0 termina com zero',
      expressao: 'itens[0]',
      esperado: 0,
    },
    {
      descricao: 'Os valores positivos não são alterados',
      expressao: 'itens[1]',
      esperado: 2,
    },
    {
      descricao: 'O vetor mantém o mesmo tamanho',
      expressao: 'itens.length',
      esperado: 4,
    },
  ],

  dicas: [
    'Acompanhe o marcador do índice enquanto o laço corre e observe quais posições ele visita.',
    'Compare o conjunto de posições que o índice visitou com o conjunto de posições que o vetor tem.',
    'Toda posição precisa ser verificada uma vez, e a primeira delas é a de índice 0.',
  ],
};
