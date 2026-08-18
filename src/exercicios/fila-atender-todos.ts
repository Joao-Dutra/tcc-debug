import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: `estaVazia` considera a fila vazia quando o início
 * alcança o fim, e não quando o ultrapassa. O laço de atendimento para com o
 * último elemento ainda na fila.
 *
 * O defeito mora no predicado, não no laço: o estudante vê o atendimento parar
 * cedo em `atenderTodos` e precisa seguir a pista até `estaVazia`, que é onde a
 * condição de parada realmente é decidida.
 */
export const filaAtenderTodos: Exercicio = {
  id: 'fila-atender-todos',
  titulo: 'Fila: nem todos os elementos são atendidos',
  enunciado:
    'A fila deve seguir a política FIFO: o primeiro a entrar é o primeiro a sair. ' +
    'atenderTodos() deve atender todos os elementos enfileirados, na ordem de chegada, ' +
    'até que a fila fique vazia. Enfileire alguns nomes e observe a fila enquanto o ' +
    'atendimento acontece.',
  estrutura: 'fila',
  categoriaDefeito: 'condicao-de-parada',
  dificuldade: 2,
  linhaDoDefeito: 12,
  variaveisObservadas: ['itens', 'inicio', 'fim'],

  codigoComDefeito: `var itens = [];
var inicio = 0;
var fim = -1;

function enfileirar(valor) {
  fim = fim + 1;
  itens[fim] = valor;
  return fim;
}

function estaVazia() {
  return inicio >= fim;
}

function desenfileirar() {
  if (estaVazia()) {
    return null;
  }
  var removido = itens[inicio];
  inicio = inicio + 1;
  return removido;
}

function atenderTodos() {
  var saida = [];
  while (!estaVazia()) {
    saida[saida.length] = desenfileirar();
  }
  return saida;
}

enfileirar('ana');
enfileirar('bruno');
enfileirar('carla');
var atendidos = atenderTodos();`,

  codigoCorreto: `var itens = [];
var inicio = 0;
var fim = -1;

function enfileirar(valor) {
  fim = fim + 1;
  itens[fim] = valor;
  return fim;
}

function estaVazia() {
  return inicio > fim;
}

function desenfileirar() {
  if (estaVazia()) {
    return null;
  }
  var removido = itens[inicio];
  inicio = inicio + 1;
  return removido;
}

function atenderTodos() {
  var saida = [];
  while (!estaVazia()) {
    saida[saida.length] = desenfileirar();
  }
  return saida;
}

enfileirar('ana');
enfileirar('bruno');
enfileirar('carla');
var atendidos = atenderTodos();`,

  casosDeTeste: [
    {
      descricao: 'Todos os enfileirados são atendidos, na ordem de chegada',
      expressao: 'atendidos',
      esperado: ['ana', 'bruno', 'carla'],
    },
    {
      descricao: 'Não sobra nenhum elemento por atender na fila',
      expressao: 'fim - inicio + 1',
      esperado: 0,
    },
    {
      descricao: 'O primeiro a ser atendido é o primeiro que entrou',
      expressao: 'atendidos[0]',
      esperado: 'ana',
    },
    {
      descricao: 'enfileirar coloca cada novo elemento depois do anterior',
      expressao: 'itens',
      esperado: ['ana', 'bruno', 'carla'],
    },
  ],

  dicas: [
    'Acompanhe os marcadores inicio e fim na visualização enquanto atenderTodos() é executado.',
    'Repare no quadro em que o atendimento para e compare-o com o estado da fila naquele instante.',
    'Enquanto os dois marcadores estiverem sobre a mesma posição, ainda há exatamente um elemento por atender: a fila só está vazia quando o início ultrapassa o fim.',
  ],
};
