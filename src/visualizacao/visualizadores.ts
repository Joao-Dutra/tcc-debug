import type { ComponentType } from 'react';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo, TipoEstrutura } from '../nucleo/tipos';
import { VisualizadorPilha } from './VisualizadorPilha';
import { VisualizadorFila } from './VisualizadorFila';
import { VisualizadorVetor } from './VisualizadorVetor';

/**
 * Registro de qual visualizador desenha cada estrutura.
 *
 * A tela do exercício escolhe por aqui, em vez de importar um visualizador
 * específico: acrescentar uma estrutura passa a ser acrescentar uma linha
 * neste mapa, sem tocar em nenhuma tela.
 */

export interface PropsVisualizador {
  instantaneo?: Instantaneo;
  /**
   * Nível de andaime da sessão (D9). O visualizador consulta para decidir
   * quais textos gera — e não gera os que o nível não prevê, em vez de
   * escondê-los depois: texto escondido continua no DOM e é anunciado por
   * leitor de tela, o que vazaria o apoio que se quer ter retirado.
   *
   * Receber o nível não fere a pureza: o componente continua sem executar
   * código, sem conhecer exercício e sem decidir qual passo mostrar.
   */
  nivelAndaime?: NivelDeAndaime;
}

/**
 * Parcial de propósito: lista encadeada ainda não tem visualizador, e fingir
 * que tem quebraria a tela. Quem consome trata a ausência.
 */
export const visualizadores: Partial<
  Record<TipoEstrutura, ComponentType<PropsVisualizador>>
> = {
  vetor: VisualizadorVetor,
  pilha: VisualizadorPilha,
  fila: VisualizadorFila,
};
