import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: a busca pelo menor compara cada valor com `itens[i]`, o
 * primeiro do trecho, e não com `itens[menor]`, o menor encontrado até ali.
 * `menor` passa a guardar o último valor menor que o primeiro, e não o menor
 * de todos.
 *
 * O quadro que denuncia está na primeira passagem: `menor` aponta o 10 e,
 * dois passos depois, salta para o 14 — um valor maior que o que ele já
 * apontava. O nome do marcador diz o que ele deveria guardar, e o desenho
 * mostra que ele não guarda. A troca do fim da passagem leva o 13 para a
 * frente, e o 10 fica para trás.
 *
 * Escolhido por execução entre doze candidatos (D34). Começar o laço interno
 * em `i` é mutante equivalente — só compara o menor consigo mesmo —, e os
 * defeitos da troca perdem um valor, que é o sintoma da ordenação por bolha.
 */
export const vetorOrdenarPorSelecao: Exercicio = {
  id: 'vetor-ordenar-por-selecao',
  titulo: 'Vetor: a ordenação por seleção deixa o começo fora de ordem',
  enunciado:
    'O programa deve deixar o vetor ordenado do menor para o maior valor. A cada passagem, ele ' +
    'procura o menor valor entre a posição i e o fim do vetor, guarda em menor a posição dele e, ' +
    'no fim da passagem, troca esse valor com o da posição i. Execute e acompanhe, na ' +
    'visualização, uma passagem inteira: as posições que menor aponta enquanto j percorre o ' +
    'vetor, e a troca do fim.',
  estrutura: 'vetor',
  categoriaDefeito: 'referencia-incorreta',
  dificuldade: 2,
  linhaDoDefeito: 11,
  variaveisObservadas: ['itens', 'j', 'menor', 'i', 'temp'],
  // `j` é o principal: é a posição examinada agora, e é dela que o anel
  // acompanha a célula. `menor` e `i` são posições também; `temp` não é
  // posição nenhuma, e vira caixa de valor (D27).
  marcadores: ['j', 'menor', 'i'],
  // Miniatura da lista: o vetor por ordenar, antes da primeira passagem.
  // Estado que as duas versões atravessam antes de divergirem (D20), copiado
  // da execução.
  miniatura: {
    variaveis: { itens: [29, 10, 14, 37, 13], i: 0, j: 0, menor: 0, temp: 0 },
  },

  codigoComDefeito: `var itens = [29, 10, 14, 37, 13];
var i = 0;
var j = 0;
var menor = 0;
var temp = 0;

function ordenar() {
  for (i = 0; i < itens.length - 1; i = i + 1) {
    menor = i;
    for (j = i + 1; j < itens.length; j = j + 1) {
      if (itens[j] < itens[i]) {
        menor = j;
      }
    }
    temp = itens[i];
    itens[i] = itens[menor];
    itens[menor] = temp;
  }
  return itens;
}

ordenar();`,

  codigoCorreto: `var itens = [29, 10, 14, 37, 13];
var i = 0;
var j = 0;
var menor = 0;
var temp = 0;

function ordenar() {
  for (i = 0; i < itens.length - 1; i = i + 1) {
    menor = i;
    for (j = i + 1; j < itens.length; j = j + 1) {
      if (itens[j] < itens[menor]) {
        menor = j;
      }
    }
    temp = itens[i];
    itens[i] = itens[menor];
    itens[menor] = temp;
  }
  return itens;
}

ordenar();`,

  casosDeTeste: [
    {
      descricao: 'O vetor termina ordenado do menor para o maior',
      expressao: 'itens',
      esperado: [10, 13, 14, 29, 37],
    },
    {
      descricao: 'O menor valor termina na primeira posição',
      expressao: 'itens[0]',
      esperado: 10,
    },
    {
      descricao: 'A soma dos valores continua a mesma do começo',
      expressao: 'itens[0] + itens[1] + itens[2] + itens[3] + itens[4]',
      esperado: 103,
    },
    {
      descricao: 'O maior valor termina na última posição',
      expressao: 'itens[4]',
      esperado: 37,
    },
  ],

  dicas: [
    'Avance a primeira passagem um passo de cada vez e observe as posições que o marcador menor ' +
      'aponta.',
    'Compare o valor que menor aponta com os valores que j já examinou nessa mesma passagem.',
    'Durante a passagem, menor precisa apontar sempre o menor valor examinado até ali: cada valor ' +
      'novo tem de ser comparado com esse, e não com outro.',
  ],
};
