import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: o vetor auxiliar não é um vetor novo, é a própria pilha.
 * `var auxiliar = itens` copia a referência, não os valores, e cada escrita no
 * auxiliar escreve na pilha. Enquanto ela é esvaziada, o fundo passa a guardar
 * o que acabou de sair do topo.
 *
 * O vetor auxiliar não é desenhado — a visualização da pilha mostra `itens` e
 * `topo` —, e o defeito foi escolhido por isso: ele aparece na própria pilha.
 * O quadro que denuncia é uma caixa mudando de valor enquanto a pilha só está
 * sendo desempilhada.
 */
export const pilhaReverter: Exercicio = {
  id: 'pilha-reverter',
  titulo: 'Pilha: um valor aparece duas vezes depois de reverter',
  enunciado:
    'reverter() deve inverter a ordem da pilha: o que estava no fundo passa para o topo, ' +
    'e o que estava no topo passa para o fundo. Para isso, desempilha tudo para um vetor ' +
    'auxiliar e depois empilha de volta, mexendo na pilha só por empilhar() e desempilhar(). ' +
    'Execute e acompanhe, na visualização, os valores da pilha e a posição do topo enquanto ' +
    'ela é esvaziada e preenchida de novo.',
  estrutura: 'pilha',
  categoriaDefeito: 'referencia-incorreta',
  dificuldade: 2,
  linhaDoDefeito: 21,
  variaveisObservadas: ['itens', 'topo'],

  codigoComDefeito: `var itens = [];
var topo = -1;

function empilhar(valor) {
  topo = topo + 1;
  itens[topo] = valor;
  return topo;
}

function desempilhar() {
  var removido = itens[topo];
  topo = topo - 1;
  return removido;
}

function estaVazia() {
  return topo < 0;
}

function reverter() {
  var auxiliar = itens;
  var quantidade = 0;
  while (!estaVazia()) {
    auxiliar[quantidade] = desempilhar();
    quantidade = quantidade + 1;
  }
  for (var i = 0; i < quantidade; i = i + 1) {
    empilhar(auxiliar[i]);
  }
}

empilhar(10);
empilhar(20);
empilhar(30);
reverter();`,

  codigoCorreto: `var itens = [];
var topo = -1;

function empilhar(valor) {
  topo = topo + 1;
  itens[topo] = valor;
  return topo;
}

function desempilhar() {
  var removido = itens[topo];
  topo = topo - 1;
  return removido;
}

function estaVazia() {
  return topo < 0;
}

function reverter() {
  var auxiliar = [];
  var quantidade = 0;
  while (!estaVazia()) {
    auxiliar[quantidade] = desempilhar();
    quantidade = quantidade + 1;
  }
  for (var i = 0; i < quantidade; i = i + 1) {
    empilhar(auxiliar[i]);
  }
}

empilhar(10);
empilhar(20);
empilhar(30);
reverter();`,

  casosDeTeste: [
    {
      descricao: 'A pilha termina na ordem inversa',
      expressao: 'itens',
      esperado: [30, 20, 10],
    },
    {
      descricao: 'O topo passa a ser o valor que estava no fundo',
      expressao: 'itens[topo]',
      esperado: 10,
    },
    {
      descricao: 'O fundo passa a ser o valor que estava no topo',
      expressao: 'itens[0]',
      esperado: 30,
    },
    {
      descricao: 'A pilha continua com três elementos',
      expressao: 'topo',
      esperado: 2,
    },
  ],

  dicas: [
    'Acompanhe, na visualização, os valores das caixas enquanto reverter() esvazia a pilha.',
    'Enquanto a pilha só está sendo desempilhada, nenhum valor guardado nela deveria mudar. ' +
      'Repare no quadro em que uma caixa muda de valor e no que o programa escreveu naquele instante.',
    'O vetor auxiliar precisa ser um vetor à parte: escrever nele não pode alterar a pilha.',
  ],
};
