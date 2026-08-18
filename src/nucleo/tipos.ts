/**
 * Tipos centrais do núcleo de execução.
 *
 * O projeto separa três responsabilidades que nunca devem se misturar:
 *   1. INSTRUMENTAR — reescreve o código do exercício inserindo pontos de captura.
 *   2. EXECUTAR     — roda o código instrumentado e devolve a lista de instantâneos.
 *   3. VISUALIZAR   — anima a lista de instantâneos.
 *
 * A visualização nunca executa código; ela apenas reproduz instantâneos.
 */

/** Estado capturado em um ponto da execução. */
export interface Instantaneo {
  /** Ordem do instantâneo na execução, começando em 0. */
  ordem: number;
  /** Linha do código-fonte original que estava prestes a ser executada. */
  linha: number;
  /** Variáveis visíveis naquele ponto, já serializadas. */
  variaveis: Record<string, unknown>;
}

/** Resultado de um caso de teste do exercício. */
export interface ResultadoCaso {
  descricao: string;
  esperado: unknown;
  obtido: unknown;
  passou: boolean;
}

/** Resultado completo de uma execução. */
export interface ResultadoExecucao {
  instantaneos: Instantaneo[];
  casos: ResultadoCaso[];
  /** Preenchido quando o código lança exceção ou excede o limite de passos. */
  erro?: string;
}

/** Categoria do defeito implantado, usada no catálogo e nas métricas. */
export type CategoriaDefeito =
  | 'condicao-de-parada'
  | 'indice-deslocado'
  | 'referencia-incorreta'
  | 'ordem-de-operacoes'
  | 'inicializacao-incorreta';

/** Estrutura de dados que o exercício manipula (define qual visualizador é usado). */
export type TipoEstrutura = 'vetor' | 'pilha' | 'fila' | 'lista-encadeada';

export interface Exercicio {
  id: string;
  titulo: string;
  /** O que o programa deveria fazer, na visão do estudante. */
  enunciado: string;
  estrutura: TipoEstrutura;
  categoriaDefeito: CategoriaDefeito;
  dificuldade: 1 | 2 | 3;
  /** Marca o exercício de entrada do catálogo, apresentado antes dos demais. */
  tutorial?: boolean;
  /** Código com o defeito implantado — é o que o estudante vê. */
  codigoComDefeito: string;
  /** Versão correta, usada apenas para conferência interna. Nunca exibir. */
  codigoCorreto: string;
  /** Linha onde está o defeito, para validar a localização feita pelo estudante. */
  linhaDoDefeito: number;
  /** Nomes das variáveis que a visualização deve acompanhar. */
  variaveisObservadas: string[];
  /** Casos de teste anexados ao código na execução. */
  casosDeTeste: CasoDeTeste[];
  /** Dicas em ordem crescente de revelação. */
  dicas: string[];
}

export interface CasoDeTeste {
  descricao: string;
  /** Expressão JavaScript avaliada após o código do exercício. */
  expressao: string;
  esperado: unknown;
}
