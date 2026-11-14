import type { Exercicio } from '../nucleo/tipos';

/**
 * Modelo da fila (D40): a convenção do Ziviani, que é o livro da disciplina,
 * sem a volta circular. `frente` é a posição de quem sai e `tras` a posição em
 * que o próximo entra; a fila vai de `frente` até `tras - 1`, e está vazia
 * quando os dois se encontram.
 *
 * Defeito implantado: `estaVazia` considera a fila vazia quando a frente chega
 * à posição anterior a `tras`, e não quando alcança `tras`. O laço de
 * atendimento para com o último elemento ainda na fila.
 *
 * O defeito mora no predicado, não no laço: o estudante vê o atendimento parar
 * cedo em `atenderTodos` e precisa seguir a pista até `estaVazia`, que é onde a
 * condição de parada realmente é decidida.
 */
export const filaAtenderTodos: Exercicio = {
  id: 'fila-atender-todos',
  titulo: 'Fila: nem todos os elementos são atendidos',
  enunciado:
    'A fila deve seguir a política FIFO: o primeiro a entrar é o primeiro a sair. Ela guarda ' +
    'seus elementos no vetor itens: frente é a posição de quem sai, e tras, a posição em que ' +
    'o próximo vai entrar. atenderTodos() deve atender todos os elementos enfileirados, na ' +
    'ordem de chegada, até que a fila fique vazia. Execute e observe a fila enquanto o ' +
    'atendimento acontece.',
  estrutura: 'fila',
  categoriaDefeito: 'condicao-de-parada',
  dificuldade: 2,
  linhaDoDefeito: 12,
  variaveisObservadas: ['itens', 'frente', 'tras'],
  // Miniatura da lista: os três na fila, antes do primeiro atendimento.
  // Estado que as duas versões atravessam antes de divergirem (D20).
  miniatura: {
    variaveis: { itens: ['ana', 'bruno', 'carla'], frente: 0, tras: 3 },
  },

  codigoComDefeito: `var itens = [];
var frente = 0;
var tras = frente;

function enfileirar(valor) {
  itens[tras] = valor;
  tras = tras + 1;
  return tras;
}

function estaVazia() {
  return frente >= tras - 1;
}

function desenfileirar() {
  if (estaVazia()) {
    return null;
  }
  var removido = itens[frente];
  frente = frente + 1;
  return removido;
}

function atenderTodos() {
  var saida = [];
  var quantidade = 0;
  while (!estaVazia()) {
    saida[quantidade] = desenfileirar();
    quantidade = quantidade + 1;
  }
  return saida;
}

enfileirar('ana');
enfileirar('bruno');
enfileirar('carla');
var atendidos = atenderTodos();`,

  codigoCorreto: `var itens = [];
var frente = 0;
var tras = frente;

function enfileirar(valor) {
  itens[tras] = valor;
  tras = tras + 1;
  return tras;
}

function estaVazia() {
  return frente == tras;
}

function desenfileirar() {
  if (estaVazia()) {
    return null;
  }
  var removido = itens[frente];
  frente = frente + 1;
  return removido;
}

function atenderTodos() {
  var saida = [];
  var quantidade = 0;
  while (!estaVazia()) {
    saida[quantidade] = desenfileirar();
    quantidade = quantidade + 1;
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
      expressao: 'tras - frente',
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
    'Acompanhe os marcadores frente e tras na visualização enquanto atenderTodos() é executado.',
    'Repare no quadro em que o atendimento para e compare-o com o estado da fila naquele instante.',
    'Enquanto frente estiver uma posição antes de tras, ainda há exatamente um elemento por atender: a fila só está vazia quando frente alcança tras.',
  ],
};
