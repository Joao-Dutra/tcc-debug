import type { Exercicio } from '../nucleo/tipos';

/**
 * Como a complexidade do exercício é escrita para o estudante (D20).
 *
 * O modelo continua com `dificuldade` numérica: número ordena, compara e entra
 * na análise. O que muda é a leitura — "complexidade 2 de 3" pedia que o
 * estudante convertesse uma fração numa expectativa, e três palavras dizem
 * isso direto.
 *
 * A etiqueta descreve **o exercício**, e não o desempenho de quem o abre. Por
 * isso ela não esbarra na proibição de progresso e pontuação (D8): é a mesma
 * informação que já estava na lista, com outra forma.
 *
 * A tabela mora aqui, e não na tela, pelo mesmo motivo de `andaime.ts`: quem
 * desenha consulta, não decide.
 */

export interface Complexidade {
  /** Palavra que o estudante lê. */
  termo: string;
  /** Classe da etiqueta; a cor mora no CSS, junto da medida de contraste. */
  classe: string;
}

const COMPLEXIDADES: Record<Exercicio['dificuldade'], Complexidade> = {
  1: { termo: 'introdutório', classe: 'introdutorio' },
  2: { termo: 'intermediário', classe: 'intermediario' },
  3: { termo: 'desafiador', classe: 'desafiador' },
};

export function complexidadeDe(dificuldade: Exercicio['dificuldade']): Complexidade {
  return COMPLEXIDADES[dificuldade];
}
