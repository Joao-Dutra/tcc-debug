import type { Exercicio } from '../nucleo/tipos';

/**
 * Pilha dinâmica: não há capacidade declarada, e o desenho mostra os blocos
 * aparecendo conforme as letras entram (D10).
 *
 * Defeito implantado: o laço que esvazia a pilha para enquanto o topo ainda
 * está na posição 0. A última letra a sair — que é a primeira da palavra —
 * nunca é desempilhada, e sobra uma caixa na pilha.
 */
export const pilhaInverterPalavra: Exercicio = {
  id: 'pilha-inverter-palavra',
  titulo: 'Pilha: falta uma letra no fim da palavra invertida',
  enunciado:
    'inverter() deve devolver a palavra escrita de trás para frente: empilha cada letra e ' +
    'depois desempilha todas, na ordem em que saem. A pilha é dinâmica — cresce conforme as ' +
    'letras entram, sem capacidade fixa. Execute e acompanhe, na visualização, as caixas que ' +
    'entram e saem e a posição do topo.',
  estrutura: 'pilha',
  categoriaDefeito: 'condicao-de-parada',
  dificuldade: 2,
  linhaDoDefeito: 23,
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

function inverter(texto) {
  var i = 0;
  while (i < texto.length) {
    empilhar(texto.charAt(i));
    i = i + 1;
  }
  var saida = '';
  while (topo > 0) {
    saida = saida + desempilhar();
  }
  return saida;
}

var invertida = inverter('PILHA');`,

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

function inverter(texto) {
  var i = 0;
  while (i < texto.length) {
    empilhar(texto.charAt(i));
    i = i + 1;
  }
  var saida = '';
  while (topo >= 0) {
    saida = saida + desempilhar();
  }
  return saida;
}

var invertida = inverter('PILHA');`,

  casosDeTeste: [
    {
      descricao: 'A palavra sai escrita de trás para frente',
      expressao: 'invertida',
      esperado: 'AHLIP',
    },
    {
      descricao: 'A pilha termina vazia',
      expressao: 'topo',
      esperado: -1,
    },
    {
      descricao: 'Todas as letras entraram na pilha',
      expressao: 'itens.length',
      esperado: 5,
    },
    {
      descricao: 'A primeira letra da palavra foi a primeira a entrar',
      expressao: 'itens[0]',
      esperado: 'P',
    },
  ],

  dicas: [
    'Acompanhe, na visualização, quantas caixas entram na pilha e quantas saem dela.',
    'Repare no último quadro: compare o que sobrou na pilha com o que a palavra invertida ' +
      'recebeu.',
    'Desempilhar precisa continuar enquanto houver alguma caixa na pilha, inclusive a que ' +
      'está na posição 0.',
  ],
};
