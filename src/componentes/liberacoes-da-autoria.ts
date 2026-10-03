import type {
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from '../nucleo/verificacao-do-exercicio';

/**
 * As travas da área de autoria (D31, D33), fora dos componentes para serem
 * cobradas pela suíte rápida: são elas que decidem o que chega ao aluno.
 */

/**
 * A verificação vale para o que está no formulário agora? Compara o rascunho
 * verificado, guardado como texto, com o atual: editar depois de verificar
 * invalida a verificação.
 */
export function verificacaoValeParaOAtual(
  relatorio: RelatorioDaVerificacao | null,
  verificado: string | null,
  atual: RascunhoDeExercicio | null
): boolean {
  return relatorio !== null && atual !== null && verificado === JSON.stringify(atual);
}

/**
 * O que a publicação grava, se ela estiver liberada; nada, se não estiver.
 *
 * Desde D33 quem publica é o próprio autor, e a verificação é a que ele acabou
 * de fazer, no navegador dele: vale só se for do que está no formulário agora.
 * Verificar e depois editar não publica nada.
 *
 * Não recebe o relatório gravado no banco — de propósito, na assinatura: o
 * gravado é de outra verificação, e pode ter sido escrito por acesso direto à
 * API. Não tem como decidir nada.
 */
export function publicacaoLiberada(
  relatorio: RelatorioDaVerificacao | null,
  verificado: string | null,
  atual: RascunhoDeExercicio | null
): { linhaDoDefeito: number; linhasAceitas: number[] } | undefined {
  if (!verificacaoValeParaOAtual(relatorio, verificado, atual)) return undefined;
  return relatorio?.aprovado ? relatorio.derivado : undefined;
}
