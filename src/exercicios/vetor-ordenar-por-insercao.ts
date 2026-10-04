import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: dentro do deslocamento, `j` diminui antes da cópia, e
 * não depois. A cópia `itens[j + 1] = itens[j]` continua escrita como na
 * versão correta, mas com o `j` já movido ela leva para a direita o vizinho
 * da esquerda, e não o valor maior que a chave. O valor que deveria andar uma
 * casa é coberto e some do vetor.
 *
 * É uma troca de ordem entre duas linhas vizinhas, e as duas contam como
 * acerto ao apontar (D30).
 *
 * O quadro que denuncia é a segunda passagem: o 29 precisa abrir espaço para
 * o 14, e o arco da cópia sai do 10, à esquerda dele. Quando a passagem
 * termina, o 29 não está em posição nenhuma, e a chave ocupa o lugar dele.
 *
 * O menor valor está na primeira posição de propósito. Com ele ali, o
 * deslocamento nunca chega à frente do vetor, e o programa com defeito nunca
 * lê `itens[-1]` — que em Java lançaria exceção e aqui devolveria um vazio,
 * comportamento que quem estudou Java ou C não espera (D17).
 */
export const vetorOrdenarPorInsercao: Exercicio = {
  id: 'vetor-ordenar-por-insercao',
  titulo: 'Vetor: a ordenação por inserção faz um valor sumir',
  enunciado:
    'O programa deve deixar o vetor ordenado do menor para o maior valor. A cada passagem, ele ' +
    'guarda em chave o valor da posição i e, da posição i - 1 para trás, desloca uma casa para a ' +
    'direita cada valor maior que a chave, abrindo o espaço onde ela é colocada. Execute e ' +
    'acompanhe, na visualização, um deslocamento inteiro: de onde sai cada valor copiado e onde ' +
    'ele chega.',
  estrutura: 'vetor',
  categoriaDefeito: 'ordem-de-operacoes',
  dificuldade: 3,
  linhaDoDefeito: 11,
  linhasAceitas: [11, 12],
  variaveisObservadas: ['itens', 'j', 'i', 'chave'],
  // `j` é o principal: é a posição comparada e deslocada agora, e é dela que
  // o anel acompanha a célula. `chave` guarda um valor, e vira caixa (D27).
  marcadores: ['j', 'i'],
  // Miniatura da lista: o vetor por ordenar, antes da primeira passagem.
  // Estado que as duas versões atravessam antes de divergirem (D20), copiado
  // da execução.
  miniatura: {
    variaveis: { itens: [10, 29, 14, 37, 13], i: 0, j: 0, chave: 0 },
  },

  codigoComDefeito: `var itens = [10, 29, 14, 37, 13];
var i = 0;
var j = 0;
var chave = 0;

function ordenar() {
  for (i = 1; i < itens.length; i = i + 1) {
    chave = itens[i];
    j = i - 1;
    while (j >= 0 && itens[j] > chave) {
      j = j - 1;
      itens[j + 1] = itens[j];
    }
    itens[j + 1] = chave;
  }
  return itens;
}

ordenar();`,

  codigoCorreto: `var itens = [10, 29, 14, 37, 13];
var i = 0;
var j = 0;
var chave = 0;

function ordenar() {
  for (i = 1; i < itens.length; i = i + 1) {
    chave = itens[i];
    j = i - 1;
    while (j >= 0 && itens[j] > chave) {
      itens[j + 1] = itens[j];
      j = j - 1;
    }
    itens[j + 1] = chave;
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
      descricao: 'A soma dos valores continua a mesma do começo',
      expressao: 'itens[0] + itens[1] + itens[2] + itens[3] + itens[4]',
      esperado: 103,
    },
    {
      descricao: 'O menor valor continua na primeira posição',
      expressao: 'itens[0]',
      esperado: 10,
    },
    {
      descricao: 'O vetor mantém o mesmo tamanho',
      expressao: 'itens.length',
      esperado: 5,
    },
  ],

  dicas: [
    'Avance uma passagem em que algum valor precise ser deslocado, e acompanhe os marcadores j e ' +
      'i a cada passo.',
    'Repare em qual posição o marcador j está no instante em que cada valor é copiado para a ' +
      'direita.',
    'Cada valor maior que a chave precisa ir da posição em que estava para a casa logo à direita ' +
      'dela, e nenhum valor do vetor pode desaparecer no caminho.',
  ],
};
