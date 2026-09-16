import type { Exercicio } from '../nucleo/tipos';
import { vetorZerarNegativos } from './vetor-zerar-negativos';
import { vetorDobrar } from './vetor-dobrar';
import { pilhaDesempilhar } from './pilha-desempilhar';
import { pilhaReverter } from './pilha-reverter';
import { filaAtenderTodos } from './fila-atender-todos';
import { filaInverter } from './fila-inverter';
import { listaInserirDepois } from './lista-inserir-depois';
import { listaInserirPosicao } from './lista-inserir-posicao';

/**
 * Catálogo de exercícios disponíveis, na ordem de apresentação (D8): vetor,
 * pilha, fila e lista encadeada, e dentro de cada estrutura por complexidade
 * crescente. É a ordem em que a disciplina apresenta as estruturas.
 *
 * Ordem de apresentação não é sequência obrigatória: nenhum exercício é
 * bloqueado, e todos ficam abertos nos três apoios desde o começo.
 *
 * Vive em arquivo próprio para que cada exercício continue sendo um módulo
 * independente: nenhum exercício precisa conhecer os outros.
 */
export const catalogo: Exercicio[] = [
  vetorZerarNegativos,
  vetorDobrar,
  pilhaDesempilhar,
  pilhaReverter,
  filaAtenderTodos,
  filaInverter,
  listaInserirDepois,
  listaInserirPosicao,
];
