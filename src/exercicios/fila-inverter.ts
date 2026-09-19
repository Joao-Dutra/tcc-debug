import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: o topo da pilha auxiliar começa em 0, e não em -1. A
 * pilha nasce "com" uma posição que ninguém escreveu, e desempilhar devolve um
 * elemento a mais no fim — um `null` que volta para a fila.
 *
 * A causa mora na estrutura auxiliar, que não é desenhada; o sintoma aparece
 * na fila, que é. É a distância entre causa e efeito que dá a dificuldade: o
 * estudante vê a fila receber um elemento que nunca entrou e precisa seguir a
 * pista até a inicialização da pilha.
 *
 * A fila é sem volta — os índices só crescem —, porque o VisualizadorFila ainda
 * não desenha a fila circular. Depois de esvaziada e preenchida de novo, ela
 * mostra lado a lado a ordem original, já atendida, e a invertida.
 */
export const filaInverter: Exercicio = {
  id: 'fila-inverter',
  titulo: 'Fila: um elemento a mais aparece depois de inverter',
  enunciado:
    'inverter() deve inverter a ordem da fila usando uma pilha auxiliar: tira os elementos ' +
    'da fila um por um e os empilha, e depois os devolve à fila desempilhando. Ao final, a ' +
    'fila tem os mesmos elementos, na ordem contrária. Execute e acompanhe a fila na ' +
    'visualização enquanto os elementos saem e voltam.',
  estrutura: 'fila',
  categoriaDefeito: 'inicializacao-incorreta',
  dificuldade: 3,
  linhaDoDefeito: 21,
  variaveisObservadas: ['itens', 'inicio', 'fim'],
  // Miniatura da lista: a fila com o primeiro já atendido.
  // Estado que as duas versões atravessam antes de divergirem (D20).
  miniatura: {
    variaveis: { itens: ['ana', 'bruno', 'carla'], inicio: 1, fim: 2 },
  },

  codigoComDefeito: `var itens = [];
var inicio = 0;
var fim = -1;

function enfileirar(valor) {
  fim = fim + 1;
  itens[fim] = valor;
}

function desenfileirar() {
  var removido = itens[inicio];
  inicio = inicio + 1;
  return removido;
}

function filaVazia() {
  return inicio > fim;
}

var pilha = [];
var topoDaPilha = 0;

function empilhar(valor) {
  topoDaPilha = topoDaPilha + 1;
  pilha[topoDaPilha] = valor;
}

function desempilhar() {
  var removido = pilha[topoDaPilha];
  topoDaPilha = topoDaPilha - 1;
  return removido;
}

function pilhaVazia() {
  return topoDaPilha < 0;
}

function inverter() {
  while (!filaVazia()) {
    empilhar(desenfileirar());
  }
  while (!pilhaVazia()) {
    enfileirar(desempilhar());
  }
}

enfileirar('ana');
enfileirar('bruno');
enfileirar('carla');
inverter();`,

  codigoCorreto: `var itens = [];
var inicio = 0;
var fim = -1;

function enfileirar(valor) {
  fim = fim + 1;
  itens[fim] = valor;
}

function desenfileirar() {
  var removido = itens[inicio];
  inicio = inicio + 1;
  return removido;
}

function filaVazia() {
  return inicio > fim;
}

var pilha = [];
var topoDaPilha = -1;

function empilhar(valor) {
  topoDaPilha = topoDaPilha + 1;
  pilha[topoDaPilha] = valor;
}

function desempilhar() {
  var removido = pilha[topoDaPilha];
  topoDaPilha = topoDaPilha - 1;
  return removido;
}

function pilhaVazia() {
  return topoDaPilha < 0;
}

function inverter() {
  while (!filaVazia()) {
    empilhar(desenfileirar());
  }
  while (!pilhaVazia()) {
    enfileirar(desempilhar());
  }
}

enfileirar('ana');
enfileirar('bruno');
enfileirar('carla');
inverter();`,

  casosDeTeste: [
    {
      descricao: 'O primeiro da fila passa a ser o último que tinha entrado',
      expressao: 'itens[inicio]',
      esperado: 'carla',
    },
    {
      descricao: 'O segundo da fila continua no meio',
      expressao: 'itens[inicio + 1]',
      esperado: 'bruno',
    },
    {
      descricao: 'O último da fila passa a ser o primeiro que tinha entrado',
      expressao: 'itens[fim]',
      esperado: 'ana',
    },
    {
      descricao: 'A fila continua com três elementos',
      expressao: 'fim - inicio + 1',
      esperado: 3,
    },
  ],

  dicas: [
    'Acompanhe, na visualização, os elementos que voltam para a fila depois que ela é esvaziada.',
    'Compare quantos elementos saíram da fila com quantos voltaram, e pense de onde veio o ' +
      'último que entrou.',
    'Uma pilha que começa vazia não tem o topo sobre posição nenhuma: desempilhar só pode ' +
      'devolver o que foi empilhado.',
  ],
};
