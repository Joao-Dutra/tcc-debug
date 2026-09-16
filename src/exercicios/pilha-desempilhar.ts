import type { Exercicio } from '../nucleo/tipos';

/**
 * Exercício de referência do projeto — é a fatia vertical que valida a
 * arquitetura inteira. Use-o como modelo ao criar novos exercícios.
 *
 * Modelo da pilha (D18): um vetor de capacidade fixa e um índice de topo, como
 * a estrutura é ensinada em Java. A pilha vai da posição 0 até o topo; o que
 * está acima dele continua no vetor, mas fora da pilha, e o visualizador
 * desenha essas posições como células consumidas.
 *
 * Defeito implantado: empilhar avança o topo e escreve o valor uma posição
 * acima dele. Cada valor empilhado vai parar fora da pilha, e o topo fica
 * sobre uma posição que ninguém escreveu. O quadro que denuncia é o do
 * primeiro empilhar().
 *
 * Os dois defeitos anteriores foram trocados: o primeiro mudava só o valor
 * devolvido (D16), e o segundo dependia de atribuir a `length` para encolher o
 * vetor, semântica que só existe em JavaScript (D17, D18).
 */
export const pilhaDesempilhar: Exercicio = {
  id: 'pilha-desempilhar',
  titulo: 'Pilha: o valor empilhado fica fora da pilha',
  enunciado:
    'A pilha guarda seus elementos no vetor itens, da posição 0 até a posição topo; o que ' +
    'está acima do topo não faz parte dela. Ela deve seguir a política LIFO: o último ' +
    'elemento empilhado é o primeiro a sair. Execute e acompanhe, na visualização, a caixa ' +
    'em que cada valor empilhado é guardado e a posição do topo.',
  estrutura: 'pilha',
  categoriaDefeito: 'indice-deslocado',
  dificuldade: 1,
  linhaDoDefeito: 6,
  variaveisObservadas: ['itens', 'topo'],

  codigoComDefeito: `var itens = [0, 0, 0, 0];
var topo = -1;

function empilhar(valor) {
  topo = topo + 1;
  itens[topo + 1] = valor;
  return topo;
}

function desempilhar() {
  if (topo < 0) {
    return null;
  }
  var removido = itens[topo];
  topo = topo - 1;
  return removido;
}

empilhar(10);
empilhar(20);
empilhar(30);
var primeiraSaida = desempilhar();
var segundaSaida = desempilhar();`,

  codigoCorreto: `var itens = [0, 0, 0, 0];
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
      expressao: 'topo + 1',
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
    'O valor empilhado precisa ser escrito exatamente na posição que o topo passa a indicar.',
  ],
};
