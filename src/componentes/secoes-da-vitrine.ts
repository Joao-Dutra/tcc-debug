import type { Exercicio, SecaoEspecial, TipoEstrutura } from '../nucleo/tipos';

/**
 * As seções da vitrine (D20, D34): uma por estrutura de dados, e a dos
 * algoritmos de ordenação logo depois do vetor sobre o qual eles trabalham.
 *
 * A seção de um exercício é a do campo `secao`, quando ele tem, e a da
 * estrutura, quando não tem. A estrutura continua decidindo o desenho e o
 * contrato de nomes da área do professor (D31); a seção decide só onde o
 * cartão aparece. Por isso os exercícios de ordenação continuam sendo de vetor,
 * com o id de sempre — as sessões já gravadas apontam para ele.
 *
 * Fora do componente para a regra ser cobrada pela suíte rápida.
 */

export type SecaoDaVitrine = TipoEstrutura | SecaoEspecial;

/** Na ordem em que a disciplina apresenta as estruturas (D8). */
export const SECOES: readonly { secao: SecaoDaVitrine; nome: string }[] = [
  { secao: 'vetor', nome: 'Vetor' },
  { secao: 'ordenacao', nome: 'Ordenação' },
  { secao: 'pilha', nome: 'Pilha' },
  { secao: 'fila', nome: 'Fila' },
  { secao: 'lista-encadeada', nome: 'Lista encadeada' },
];

export function secaoDe(exercicio: Exercicio): SecaoDaVitrine {
  return exercicio.secao ?? exercicio.estrutura;
}
