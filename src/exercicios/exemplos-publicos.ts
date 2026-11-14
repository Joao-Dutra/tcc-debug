/**
 * Os únicos exercícios do catálogo cujo código correto vai ao navegador (D41).
 *
 * São os exemplos do formulário do professor (D35): o campo "código correto"
 * mostra o de um deles, e para isso o texto precisa estar no pacote. Todos
 * ficam fora do percurso do estudo — o código correto de um exercício que os
 * participantes resolvem não pode estar a uma aba de ferramentas de
 * desenvolvedor de distância. O build apaga o de todos os outros, e o teste
 * do pacote confere no arquivo final.
 *
 * Sem importação nenhuma, de propósito: o `vite.config.ts` lê esta lista, e o
 * TypeScript da configuração resolve módulos de outro jeito que o da
 * aplicação.
 */
export const EXERCICIOS_DE_EXEMPLO = [
  'vetor-dobrar',
  'vetor-ordenar-por-insercao',
  'pilha-reverter',
  'fila-inverter',
  'lista-inserir-posicao',
] as const;

export type ExercicioDeExemplo = (typeof EXERCICIOS_DE_EXEMPLO)[number];
