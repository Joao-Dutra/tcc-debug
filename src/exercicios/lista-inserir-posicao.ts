import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: a caminhada para quando o nó atual não tem próximo, e não
 * quando o próprio atual acaba. Diante de uma posição além do fim da lista,
 * `atual` para sobre o último nó em vez de passar dele, a verificação de
 * posição inválida nunca dispara, e o valor é pendurado no fim.
 *
 * A chamada com a posição inválida vem primeiro de propósito. A lista desenha
 * três nós por fileira (D14), e com dois nós na lista o que o defeito pendura
 * aparece inteiro no desenho: é esse o quadro que denuncia.
 */
export const listaInserirPosicao: Exercicio = {
  id: 'lista-inserir-posicao',
  titulo: 'Lista: um valor entra mesmo com a posição inválida',
  enunciado:
    'inserirNaPosicao(posicao, valor) deve colocar um nó novo de modo que ele passe a ocupar ' +
    'a posição pedida, contando a partir de 0. A posição 0 não é aceita, e nenhuma posição ' +
    'além do tamanho da lista também não: nesses casos a lista não muda e a função devolve ' +
    'false. Execute e acompanhe o ponteiro atual e as ligações enquanto cada inserção é tentada.',
  estrutura: 'lista-encadeada',
  categoriaDefeito: 'condicao-de-parada',
  dificuldade: 3,
  linhaDoDefeito: 17,
  variaveisObservadas: ['cabeca', 'atual'],

  codigoComDefeito: `class No {
  constructor(valor, proximo) {
    this.valor = valor;
    this.proximo = proximo;
  }
}

var cabeca = new No(10, new No(30, null));
var atual = null;

function inserirNaPosicao(posicao, valor) {
  if (posicao < 1) {
    return false;
  }
  atual = cabeca;
  var indice = 0;
  while (atual.proximo != null && indice < posicao - 1) {
    atual = atual.proximo;
    indice = indice + 1;
  }
  if (atual == null) {
    return false;
  }
  var novo = new No(valor, atual.proximo);
  atual.proximo = novo;
  return true;
}

var aceitouInvalida = inserirNaPosicao(4, 99);
var aceitouValida = inserirNaPosicao(1, 20);`,

  codigoCorreto: `class No {
  constructor(valor, proximo) {
    this.valor = valor;
    this.proximo = proximo;
  }
}

var cabeca = new No(10, new No(30, null));
var atual = null;

function inserirNaPosicao(posicao, valor) {
  if (posicao < 1) {
    return false;
  }
  atual = cabeca;
  var indice = 0;
  while (atual != null && indice < posicao - 1) {
    atual = atual.proximo;
    indice = indice + 1;
  }
  if (atual == null) {
    return false;
  }
  var novo = new No(valor, atual.proximo);
  atual.proximo = novo;
  return true;
}

var aceitouInvalida = inserirNaPosicao(4, 99);
var aceitouValida = inserirNaPosicao(1, 20);`,

  casosDeTeste: [
    {
      descricao: 'Uma posição além do tamanho da lista é recusada',
      expressao: 'aceitouInvalida',
      esperado: false,
    },
    {
      descricao: 'Uma posição intermediária é aceita',
      expressao: 'aceitouValida',
      esperado: true,
    },
    {
      descricao: 'O valor novo passa a ocupar a posição pedida',
      expressao: 'cabeca.proximo.valor',
      esperado: 20,
    },
    {
      descricao: 'A lista termina no 30, sem nenhum nó a mais',
      expressao: 'cabeca.proximo.proximo.proximo === null',
      esperado: true,
    },
  ],

  dicas: [
    'Acompanhe, na visualização, onde o ponteiro atual para em cada chamada de inserirNaPosicao().',
    'Na chamada com a posição que não existe, compare o lugar em que atual para com o lugar ' +
      'a que ele precisaria chegar para a verificação da posição perceber o problema.',
    'Se a lista acaba antes da posição pedida, a caminhada precisa terminar com atual sem ' +
      'nó nenhum — e não sobre o último nó.',
  ],
};
