import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: as duas ligações da inserção são atribuídas na ordem
 * trocada. O nó anterior passa a apontar para o novo antes de o novo guardar o
 * resto da lista, e o que o novo recebe é ele mesmo — um nó apontando para si.
 *
 * O resto da lista fica sem ninguém apontando para ele. Não é desenhado como nó
 * solto: sem referência alguma ele deixa de ser alcançável e nem chega ao
 * instantâneo. O sintoma é o desaparecimento — o nó 30 some do desenho — junto
 * do laço do nó novo sobre si mesmo.
 */
export const listaInserirDepois: Exercicio = {
  id: 'lista-inserir-depois',
  titulo: 'Lista: o resto da lista some depois da inserção',
  enunciado:
    'inserirDepois() deve colocar um nó novo logo após um nó dado, mantendo ligado ' +
    'tudo o que vinha depois. Execute e acompanhe as ligações entre os nós enquanto ' +
    'a inserção acontece.',
  estrutura: 'lista-encadeada',
  categoriaDefeito: 'ordem-de-operacoes',
  dificuldade: 2,
  linhaDoDefeito: 15,
  // As duas atribuições trocaram de lugar, e apontar qualquer uma delas é
  // achar o defeito (D30): responder "não está aqui" para a segunda seria um
  // retorno falso.
  linhasAceitas: [15, 16],
  variaveisObservadas: ['cabeca', 'atual'],
  // Miniatura da lista: o nó novo criado, ainda solto.
  // Estado que as duas versões atravessam antes de divergirem (D20).
  miniatura: {
    variaveis: {
      cabeca: { __id: 0, valor: 10, proximo: { __id: 1, valor: 30, proximo: null } },
      atual: { __id: 2, valor: 20, proximo: null },
    },
  },

  codigoComDefeito: `class No {
  constructor(valor, proximo) {
    this.valor = valor;
    this.proximo = proximo;
  }
}

var segundo = new No(30, null);
var cabeca = new No(10, segundo);
var atual = null;

function inserirDepois(no, valor) {
  var novo = new No(valor, null);
  atual = novo;
  no.proximo = novo;
  novo.proximo = no.proximo;
  return cabeca;
}

inserirDepois(cabeca, 20);`,

  codigoCorreto: `class No {
  constructor(valor, proximo) {
    this.valor = valor;
    this.proximo = proximo;
  }
}

var segundo = new No(30, null);
var cabeca = new No(10, segundo);
var atual = null;

function inserirDepois(no, valor) {
  var novo = new No(valor, null);
  atual = novo;
  novo.proximo = no.proximo;
  no.proximo = novo;
  return cabeca;
}

inserirDepois(cabeca, 20);`,

  casosDeTeste: [
    {
      descricao: 'Depois do nó novo vem o que já estava na lista',
      expressao: 'cabeca.proximo.proximo.valor',
      esperado: 30,
    },
    {
      descricao: 'A lista termina depois do terceiro nó',
      expressao: 'cabeca.proximo.proximo.proximo === null',
      esperado: true,
    },
    {
      descricao: 'O nó novo entra logo depois do primeiro',
      expressao: 'cabeca.proximo.valor',
      esperado: 20,
    },
    {
      descricao: 'O primeiro nó continua sendo o mesmo',
      expressao: 'cabeca.valor',
      esperado: 10,
    },
  ],

  dicas: [
    'Acompanhe, na visualização, para onde o nó novo passa a apontar depois que as ligações são refeitas.',
    'Repare na ordem das duas atribuições e no que a primeira faz com a informação de que a segunda precisa.',
    'O nó novo precisa receber o resto da lista antes que essa informação seja sobrescrita.',
  ],
};
