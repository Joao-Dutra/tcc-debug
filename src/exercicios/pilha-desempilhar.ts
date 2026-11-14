import type { Exercicio } from '../nucleo/tipos';

/**
 * Exercício de referência do projeto — é a fatia vertical que valida a
 * arquitetura inteira. Use-o como modelo ao criar novos exercícios.
 *
 * Modelo da pilha (D18, D40): um vetor com um contador de topo, sem
 * truncagem, na convenção do Ziviani, que é o livro da disciplina. `topo`
 * começa em 0 e conta os elementos; a pilha vai da posição 0 até `topo - 1`,
 * e o que está acima continua no vetor, mas fora da pilha — o visualizador
 * desenha essas posições como células consumidas.
 *
 * Esta pilha é de capacidade fixa, e é o exercício que declara isso: a
 * variável `capacidade` é observada, e o desenho mostra as posições que ainda
 * não receberam valor como contorno pontilhado (D10). A pilha dinâmica do
 * catálogo não declara capacidade, e lá os blocos só aparecem.
 *
 * Defeito implantado: empilhar avança o topo e escreve o valor em
 * `itens[topo]`, uma posição acima da última da pilha, que é `topo - 1`. Cada
 * valor empilhado vai parar fora da pilha, e o topo fica sobre uma posição que
 * ninguém escreveu. O quadro que denuncia é o do primeiro empilhar().
 */
export const pilhaDesempilhar: Exercicio = {
  id: 'pilha-desempilhar',
  titulo: 'Pilha: o valor empilhado fica fora da pilha',
  enunciado:
    'A pilha guarda seus elementos num vetor de capacidade fixa, e topo conta quantos ' +
    'elementos ela tem: a pilha vai da posição 0 até a posição topo - 1, e o que está acima ' +
    'disso não faz parte dela. Ela deve seguir a política LIFO: o último elemento empilhado é ' +
    'o primeiro a sair. Execute e acompanhe, na visualização, a caixa em que cada valor ' +
    'empilhado é guardado e a caixa que o topo aponta.',
  estrutura: 'pilha',
  categoriaDefeito: 'indice-deslocado',
  dificuldade: 1,
  linhaDoDefeito: 10,
  variaveisObservadas: ['itens', 'topo', 'capacidade'],
  // Miniatura da lista: a pilha vazia, antes do primeiro empilhar().
  // Estado que as duas versões atravessam antes de divergirem (D20).
  miniatura: {
    variaveis: { itens: [], topo: 0, capacidade: 4 },
  },

  codigoComDefeito: `var capacidade = 4;
var itens = [];
var topo = 0;

function empilhar(valor) {
  if (topo == capacidade) {
    return -1;
  }
  topo = topo + 1;
  itens[topo] = valor;
  return topo;
}

function desempilhar() {
  if (topo == 0) {
    return null;
  }
  var removido = itens[topo - 1];
  topo = topo - 1;
  return removido;
}

empilhar(10);
empilhar(20);
empilhar(30);
var primeiraSaida = desempilhar();
var segundaSaida = desempilhar();`,

  codigoCorreto: `var capacidade = 4;
var itens = [];
var topo = 0;

function empilhar(valor) {
  if (topo == capacidade) {
    return -1;
  }
  topo = topo + 1;
  itens[topo - 1] = valor;
  return topo;
}

function desempilhar() {
  if (topo == 0) {
    return null;
  }
  var removido = itens[topo - 1];
  topo = topo - 1;
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
      expressao: 'topo',
      esperado: 1,
    },
    {
      descricao: 'O fundo da pilha guarda o primeiro valor empilhado',
      expressao: 'itens[0]',
      esperado: 10,
    },
  ],

  dicas: [
    'Acompanhe, na visualização, em que caixa cada valor empilhado vai parar e para onde o ' +
      'topo aponta depois de empilhar().',
    'Logo depois do primeiro empilhar(), compare a caixa em que o valor foi escrito com a ' +
      'caixa que o topo indica.',
    'Como o topo conta os elementos, o último empilhado ocupa a posição topo - 1: é ' +
      'exatamente nela que o valor precisa ser escrito.',
  ],
};
