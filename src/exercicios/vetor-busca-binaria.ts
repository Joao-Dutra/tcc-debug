import type { Exercicio } from '../nucleo/tipos';

/**
 * Defeito implantado: a condição de parada é `inicio < fim`, e não
 * `inicio <= fim`. Quando o trecho se estreita até uma posição só, o laço
 * termina antes de examiná-la — e é justamente ali que estão os valores das
 * pontas.
 *
 * O quadro que denuncia é o último: `inicio` e `fim` param sobre a mesma
 * posição, a que guarda o valor procurado, e o `meio` nunca chega nela. O
 * anel fica na posição vizinha, que foi a última examinada.
 *
 * Os outros dois candidatos de D7 para esta estrutura foram descartados por
 * execução: tanto o cálculo do meio quanto a atualização dos limites fazem o
 * trecho parar de encolher em alguma entrada, e o programa entra em laço
 * infinito — o estudante recebe o limite de passos do Worker (D5) em vez de um
 * quadro que denuncie o defeito.
 */
export const vetorBuscaBinaria: Exercicio = {
  id: 'vetor-busca-binaria',
  titulo: 'Vetor: a busca não acha um valor que está no vetor',
  enunciado:
    'buscar(alvo) deve devolver a posição em que o valor está no vetor, ou -1 quando ele não ' +
    'está. O vetor está ordenado, e a busca binária aproveita isso: a cada passo ela examina o ' +
    'meio do trecho entre inicio e fim e descarta a metade que não pode conter o valor. Execute ' +
    'e acompanhe, na visualização, o trecho entre inicio e fim se estreitando e quais posições ' +
    'o meio chega a examinar.',
  estrutura: 'vetor',
  categoriaDefeito: 'condicao-de-parada',
  dificuldade: 3,
  linhaDoDefeito: 9,
  variaveisObservadas: ['itens', 'inicio', 'meio', 'fim', 'alvo'],
  // `meio` é o principal: é a posição que está sendo examinada, e é dela que o
  // anel acompanha a célula. `alvo` não é posição nenhuma, e vira caixa de
  // valor ao lado da fileira (D27).
  marcadores: ['meio', 'inicio', 'fim'],
  // Miniatura da lista: o primeiro passo da primeira busca, com o trecho
  // inteiro e o meio no lugar. Estado que as duas versões atravessam antes de
  // divergirem (D20).
  miniatura: {
    variaveis: {
      itens: [2, 5, 8, 12, 17, 21, 30, 41],
      inicio: 0,
      meio: 3,
      fim: 7,
      alvo: 12,
    },
  },

  codigoComDefeito: `var itens = [2, 5, 8, 12, 17, 21, 30, 41];
var inicio = 0;
var meio = 0;
var fim = 0;

function buscar(alvo) {
  inicio = 0;
  fim = itens.length - 1;
  while (inicio < fim) {
    meio = Math.floor((inicio + fim) / 2);
    if (itens[meio] == alvo) {
      return meio;
    }
    if (itens[meio] < alvo) {
      inicio = meio + 1;
    } else {
      fim = meio - 1;
    }
  }
  return -1;
}

var posicaoDe12 = buscar(12);
var posicaoDe17 = buscar(17);
var posicaoDe41 = buscar(41);`,

  codigoCorreto: `var itens = [2, 5, 8, 12, 17, 21, 30, 41];
var inicio = 0;
var meio = 0;
var fim = 0;

function buscar(alvo) {
  inicio = 0;
  fim = itens.length - 1;
  while (inicio <= fim) {
    meio = Math.floor((inicio + fim) / 2);
    if (itens[meio] == alvo) {
      return meio;
    }
    if (itens[meio] < alvo) {
      inicio = meio + 1;
    } else {
      fim = meio - 1;
    }
  }
  return -1;
}

var posicaoDe12 = buscar(12);
var posicaoDe17 = buscar(17);
var posicaoDe41 = buscar(41);`,

  casosDeTeste: [
    {
      descricao: 'Encontra o valor que está bem no meio do vetor',
      expressao: 'posicaoDe12',
      esperado: 3,
    },
    {
      descricao: 'Encontra um valor da metade de cima',
      expressao: 'posicaoDe17',
      esperado: 4,
    },
    {
      descricao: 'Encontra o último valor do vetor',
      expressao: 'posicaoDe41',
      esperado: 7,
    },
    {
      descricao: 'A busca não altera o vetor',
      expressao: 'itens',
      esperado: [2, 5, 8, 12, 17, 21, 30, 41],
    },
  ],

  dicas: [
    'Acompanhe inicio e fim se aproximando a cada passo, e anote quais posições o meio chega ' +
      'a examinar.',
    'Repare no que acontece quando inicio e fim chegam à mesma posição: o meio ainda examina ' +
      'essa posição antes de a busca terminar?',
    'Enquanto sobrar alguma posição entre inicio e fim — inclusive quando sobrar uma só —, ela ' +
      'ainda precisa ser examinada antes de a busca desistir.',
  ],
};
