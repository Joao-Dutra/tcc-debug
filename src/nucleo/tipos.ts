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
  /**
   * Linha do código-fonte original que estava prestes a ser executada. Nula no
   * quadro final, capturado depois que o programa termina (D1): não há mais
   * linha a executar.
   */
  linha: number | null;
  /** Variáveis visíveis naquele ponto, já serializadas. */
  variaveis: Record<string, unknown>;
  /**
   * A cópia de valor que produziu este quadro (D27), quando houve uma. É a
   * escrita da instrução anterior, e não da que está prestes a rodar: o quadro
   * mostra o resultado dela.
   */
  escrita?: Escrita;
  /**
   * Quais variáveis observadas são marcadores de posição, na ordem declarada
   * pelo exercício (D27). Vem daqui, e não do componente, porque o
   * visualizador é puro e não conhece o exercício: é o caminho que D14 já
   * apontava para o papel dos campos da lista.
   *
   * Sem esta lista não há como separar `j`, que aponta uma posição, de `temp`,
   * que guarda um valor: os dois são números.
   */
  marcadores?: string[];
}

/** Um lugar que guarda valor: uma posição de um vetor, ou uma variável. */
export type LugarDoValor = { vetor: string; indice: number } | { variavel: string };

/**
 * Uma cópia de valor de um lugar para outro (D27).
 *
 * Só as cópias simples são anotadas — `itens[a] = itens[b]`, `itens[a] = temp`,
 * `temp = itens[a]` —, e só quando os índices são expressões sem efeito
 * colateral, porque a sonda os avalia antes de a instrução rodar. Valor
 * calculado não vira escrita: `itens[i] = itens[i] * 2` não é cópia de lugar
 * nenhum.
 *
 * É isto que permite desenhar a troca entre duas posições como movimento, em
 * vez de o vetor simplesmente aparecer trocado no quadro seguinte.
 */
export interface Escrita {
  destino: LugarDoValor;
  origem: LugarDoValor;
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
  /**
   * Onde apontar conta como localizar o defeito, quando é mais de uma linha
   * (D30). Ausente, vale só `linhaDoDefeito`.
   *
   * Existe para a troca de ordem entre duas linhas vizinhas: as duas mudaram de
   * lugar, e quem aponta a segunda achou o defeito tanto quanto quem aponta a
   * primeira. Responder "o defeito não está aqui" para ela seria um retorno
   * falso, e retorno falso é pior que nenhum. O teste do catálogo confere que a
   * lista bate com a comparação entre as duas versões.
   */
  linhasAceitas?: number[];
  /** Nomes das variáveis que a visualização deve acompanhar. */
  variaveisObservadas: string[];
  /**
   * Entre as observadas, as que são marcadores de posição, na ordem em que o
   * desenho deve distingui-las (D27): a primeira é a principal, e é dela que o
   * anel acompanha a posição apontada.
   *
   * As demais variáveis observadas que não sejam a estrutura são desenhadas
   * como caixas de valor — a temporária de uma troca, por exemplo.
   */
  marcadores?: string[];
  /** Casos de teste anexados ao código na execução. */
  casosDeTeste: CasoDeTeste[];
  /** Dicas em ordem crescente de revelação. */
  dicas: string[];
  /**
   * Estado desenhado na miniatura do cartão, na lista de exercícios.
   *
   * Nunca o quadro que denuncia o defeito: a lista seria o primeiro lugar a
   * entregar o que o estudante precisa encontrar. Por isso é um estado inicial
   * ou intermediário, que as duas versões atravessam antes de divergirem — e o
   * teste de quadro-denúncia confere isso por execução, não por leitura.
   *
   * Opcional: o exercício sem ele aparece num cartão sem miniatura.
   */
  miniatura?: EstadoDaMiniatura;
}

/**
 * Só as variáveis de um instantâneo. Ordem e linha não fazem sentido fora de
 * uma execução, e escrevê-las à mão seria inventar um quadro.
 */
export type EstadoDaMiniatura = Pick<Instantaneo, 'variaveis'>;

export interface CasoDeTeste {
  descricao: string;
  /** Expressão JavaScript avaliada após o código do exercício. */
  expressao: string;
  esperado: unknown;
}
