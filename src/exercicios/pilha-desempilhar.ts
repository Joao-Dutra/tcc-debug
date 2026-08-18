import type { Exercicio } from '../nucleo/tipos';

/**
 * Exercício de referência do projeto — é a fatia vertical que valida a
 * arquitetura inteira. Use-o como modelo ao criar novos exercícios.
 *
 * Defeito implantado: `desempilhar` devolve o elemento na posição `topo` depois
 * de já ter decrementado o topo, retornando o elemento errado.
 */
export const pilhaDesempilhar: Exercicio = {
  id: 'pilha-desempilhar',
  titulo: 'Pilha: desempilhar devolve o elemento errado',
  enunciado:
    'A pilha deve seguir a política LIFO: o último elemento empilhado é o primeiro a sair. ' +
    'Empilhe alguns valores e observe o que desempilhar() devolve.',
  estrutura: 'pilha',
  categoriaDefeito: 'indice-deslocado',
  dificuldade: 1,
  linhaDoDefeito: 16,
  variaveisObservadas: ['itens', 'topo'],

  codigoComDefeito: `var itens = [];
var topo = -1;

function empilhar(valor) {
  topo = topo + 1;
  itens[topo] = valor;
  return topo;
}

function desempilhar() {
  if (topo < 0) {
    return null;
  }
  topo = topo - 1;
  var removido = itens[topo];
  itens.length = topo + 1;
  return removido;
}

empilhar(10);
empilhar(20);
empilhar(30);
var primeiraSaida = desempilhar();
var segundaSaida = desempilhar();`,

  codigoCorreto: `var itens = [];
var topo = -1;

function empilhar(valor) {
  topo = topo + 1;
  itens[topo] = valor;
  return topo;
}

function desempilhar() {
  if (topo < 0) {
    return null;
  }
  var removido = itens[topo];
  topo = topo - 1;
  itens.length = topo + 1;
  return removido;
}

empilhar(10);
empilhar(20);
empilhar(30);
var primeiraSaida = desempilhar();
var segundaSaida = desempilhar();`,

  casosDeTeste: [
    {
      descricao: 'O primeiro desempilhar devolve o último valor empilhado',
      expressao: 'primeiraSaida',
      esperado: 30,
    },
    {
      descricao: 'O segundo desempilhar devolve o penúltimo valor empilhado',
      expressao: 'segundaSaida',
      esperado: 20,
    },
    {
      descricao: 'Sobra apenas um elemento na pilha',
      expressao: 'itens',
      esperado: [10],
    },
  ],

  dicas: [
    'Acompanhe o valor de topo na visualização enquanto desempilhar() é executado.',
    'Repare em que momento o topo muda de valor em relação ao momento em que o elemento é lido.',
    'A leitura do elemento precisa acontecer enquanto topo ainda aponta para ele.',
  ],
};
