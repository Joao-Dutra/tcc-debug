import type { ComponentType } from 'react';
import type { Instantaneo, TipoEstrutura } from '../nucleo/tipos';
import { VisualizadorPilha } from './VisualizadorPilha';
import { VisualizadorFila } from './VisualizadorFila';

/**
 * Registro de qual visualizador desenha cada estrutura.
 *
 * A tela do exercício escolhe por aqui, em vez de importar um visualizador
 * específico: acrescentar uma estrutura passa a ser acrescentar uma linha
 * neste mapa, sem tocar em nenhuma tela.
 */

export interface PropsVisualizador {
  instantaneo?: Instantaneo;
}

/**
 * Parcial de propósito: vetor e lista encadeada ainda não têm visualizador, e
 * fingir que têm quebraria a tela. Quem consome trata a ausência.
 */
export const visualizadores: Partial<
  Record<TipoEstrutura, ComponentType<PropsVisualizador>>
> = {
  pilha: VisualizadorPilha,
  fila: VisualizadorFila,
};
