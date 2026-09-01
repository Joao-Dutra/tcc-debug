import type { ComponentType } from 'react';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo, TipoEstrutura } from '../nucleo/tipos';
import { VisualizadorPilha } from './VisualizadorPilha';
import { VisualizadorFila } from './VisualizadorFila';
import { VisualizadorVetor } from './VisualizadorVetor';
import { VisualizadorListaEncadeada } from './VisualizadorListaEncadeada';

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
 * Continua parcial: o union de `TipoEstrutura` pode crescer antes do
 * visualizador correspondente existir, e a tela trata a ausência em vez de
 * quebrar. Hoje todas as estruturas previstas para esta etapa estão cobertas.
 */
export const visualizadores: Partial<
  Record<TipoEstrutura, ComponentType<PropsVisualizador>>
> = {
  vetor: VisualizadorVetor,
  pilha: VisualizadorPilha,
  fila: VisualizadorFila,
  'lista-encadeada': VisualizadorListaEncadeada,
};
