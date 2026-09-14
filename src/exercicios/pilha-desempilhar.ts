import type { Exercicio } from '../nucleo/tipos';

/**
 * Exercício de referência do projeto — é a fatia vertical que valida a
 * arquitetura inteira. Use-o como modelo ao criar novos exercícios.
 *
 * Defeito implantado: `desempilhar` trunca o vetor em `topo` posições em vez de
 * `topo + 1`, e descarta junto o elemento que deveria ficar no topo. O quadro
 * que denuncia é o topo apontando além do último elemento que restou.
 *
 * O defeito anterior — ler o elemento depois de decrementar o topo — foi
 * reprovado na auditoria de D16: mudava só o valor devolvido, e a pilha
 * atravessava os mesmos estados com e sem ele.
 */
export const pilhaDesempilhar: Exercicio = {
  id: 'pilha-desempilhar',
  titulo: 'Pilha: um elemento some sem ter sido desempilhado',
  enunciado:
    'A pilha deve seguir a política LIFO: o último elemento empilhado é o primeiro a sair, ' +
    'e cada chamada de desempilhar() retira apenas esse elemento, deixando os demais ' +
    'guardados. Execute e acompanhe, na visualização, os elementos da pilha e a posição ' +
    'do topo enquanto os valores são desempilhados.',
  estrutura: 'pilha',
  categoriaDefeito: 'indice-deslocado',
  dificuldade: 1,
  tutorial: true,
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
  var removido = itens[topo];
  topo = topo - 1;
  itens.length = topo;
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
    'Acompanhe, na visualização, quantos elementos restam na pilha e para onde o topo ' +
      'aponta a cada chamada de desempilhar().',
    'Repare no quadro logo depois de o primeiro elemento sair: compare a posição do topo ' +
      'com a do último elemento que continua na pilha.',
    'Depois de desempilhar, o topo deve apontar para o último elemento que continua na ' +
      'pilha — nunca para uma posição vazia.',
  ],
};
