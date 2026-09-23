import type { Exercicio } from '../nucleo/tipos';
import { vetorZerarNegativos } from './vetor-zerar-negativos';
import { vetorDobrar } from './vetor-dobrar';
import { vetorOrdenar } from './vetor-ordenar';
import { vetorBuscaBinaria } from './vetor-busca-binaria';
import { pilhaDesempilhar } from './pilha-desempilhar';
import { pilhaReverter } from './pilha-reverter';
import { pilhaInverterPalavra } from './pilha-inverter-palavra';
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
 * bloqueado, e todos ficam abertos nos dois níveis de apoio desde o começo.
 *
 * Vive em arquivo próprio para que cada exercício continue sendo um módulo
 * independente: nenhum exercício precisa conhecer os outros.
 */
export const catalogo: Exercicio[] = [
  vetorZerarNegativos,
  vetorDobrar,
  vetorOrdenar,
  vetorBuscaBinaria,
  pilhaDesempilhar,
  pilhaReverter,
  pilhaInverterPalavra,
  filaAtenderTodos,
  filaInverter,
  listaInserirDepois,
  listaInserirPosicao,
];

/**
 * O exercício seguinte na ordem do catálogo, dando a volta no fim (D20).
 *
 * A volta não é detalhe de implementação. Sem ela, o último exercício ficaria
 * sem convite para continuar, e essa ausência diria ao estudante onde ele está
 * na sequência — posição e quantidade são progresso, e progresso não aparece
 * (D8). Com a volta, o convite é o mesmo em qualquer exercício.
 */
export function proximoDoCatalogo(id: string): Exercicio | undefined {
  const atual = catalogo.findIndex((exercicio) => exercicio.id === id);
  if (atual === -1 || catalogo.length < 2) return undefined;
  return catalogo[(atual + 1) % catalogo.length];
}
