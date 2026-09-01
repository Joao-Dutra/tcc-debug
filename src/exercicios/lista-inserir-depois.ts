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
  linhaDoDefeito: 7,
  variaveisObservadas: ['cabeca', 'atual'],

  codigoComDefeito: `var cabeca = { valor: 10, proximo: { valor: 30, proximo: null } };
var atual = null;

function inserirDepois(no, valor) {
  var novo = { valor: valor, proximo: null };
  atual = novo;
  no.proximo = novo;
  novo.proximo = no.proximo;
  return cabeca;
}

inserirDepois(cabeca, 20);`,

  codigoCorreto: `var cabeca = { valor: 10, proximo: { valor: 30, proximo: null } };
var atual = null;

function inserirDepois(no, valor) {
  var novo = { valor: valor, proximo: null };
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
