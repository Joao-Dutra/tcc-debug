import type { Exercicio } from '../nucleo/tipos';

/**
 * Fila e pilha auxiliar seguem a convenção do Ziviani (D40): a fila vai de
 * `frente` até `tras - 1`, e o topo da pilha conta os elementos.
 *
 * Defeito implantado: o topo da pilha auxiliar começa em 1, e não em 0. A
 * pilha nasce "com" um elemento que ninguém empilhou, e desempilhar devolve um
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
  variaveisObservadas: ['itens', 'frente', 'tras'],
  // Miniatura da lista: a fila com o primeiro já atendido.
  // Estado que as duas versões atravessam antes de divergirem (D20).
  miniatura: {
    variaveis: { itens: ['ana', 'bruno', 'carla'], frente: 1, tras: 3 },
  },

  codigoComDefeito: `var itens = [];
var frente = 0;
var tras = frente;

function enfileirar(valor) {
  itens[tras] = valor;
  tras = tras + 1;
}

function desenfileirar() {
  var removido = itens[frente];
  frente = frente + 1;
  return removido;
}

function filaVazia() {
  return frente == tras;
}

var pilha = [];
var topoDaPilha = 1;

function empilhar(valor) {
  topoDaPilha = topoDaPilha + 1;
  pilha[topoDaPilha - 1] = valor;
}

function desempilhar() {
  var removido = pilha[topoDaPilha - 1];
  topoDaPilha = topoDaPilha - 1;
  return removido;
}

function pilhaVazia() {
  return topoDaPilha == 0;
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
var frente = 0;
var tras = frente;

function enfileirar(valor) {
  itens[tras] = valor;
  tras = tras + 1;
}

function desenfileirar() {
  var removido = itens[frente];
  frente = frente + 1;
  return removido;
}

function filaVazia() {
  return frente == tras;
}

var pilha = [];
var topoDaPilha = 0;

function empilhar(valor) {
  topoDaPilha = topoDaPilha + 1;
  pilha[topoDaPilha - 1] = valor;
}

function desempilhar() {
  var removido = pilha[topoDaPilha - 1];
  topoDaPilha = topoDaPilha - 1;
  return removido;
}

function pilhaVazia() {
  return topoDaPilha == 0;
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
      expressao: 'itens[frente]',
      esperado: 'carla',
    },
    {
      descricao: 'O segundo da fila continua no meio',
      expressao: 'itens[frente + 1]',
      esperado: 'bruno',
    },
    {
      descricao: 'O último da fila passa a ser o primeiro que tinha entrado',
      expressao: 'itens[tras - 1]',
      esperado: 'ana',
    },
    {
      descricao: 'A fila continua com três elementos',
      expressao: 'tras - frente',
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
