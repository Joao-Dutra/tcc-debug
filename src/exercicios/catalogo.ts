import type { Exercicio } from '../nucleo/tipos';
import { pilhaDesempilhar } from './pilha-desempilhar';
import { filaAtenderTodos } from './fila-atender-todos';

/**
 * Catálogo de exercícios disponíveis, em ordem crescente de dificuldade.
 *
 * Vive em arquivo próprio para que cada exercício continue sendo um módulo
 * independente: nenhum exercício precisa conhecer os outros.
 */
export const catalogo: Exercicio[] = [pilhaDesempilhar, filaAtenderTodos];
