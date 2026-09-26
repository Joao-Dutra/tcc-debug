import type {
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from '../nucleo/verificacao-do-exercicio';

/**
 * As duas travas da área de autoria (D31), fora dos componentes para serem
 * cobradas pela suíte rápida: são elas que decidem o que chega à revisão e o
 * que chega ao aluno.
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

/** Enviar exige a verificação aprovada do que está no formulário agora. */
export function envioLiberado(
  relatorio: RelatorioDaVerificacao | null,
  verificado: string | null,
  atual: RascunhoDeExercicio | null
): boolean {
  return verificacaoValeParaOAtual(relatorio, verificado, atual) && relatorio?.aprovado === true;
}

/**
 * O que a publicação grava, se ela estiver liberada; nada, se não estiver.
 *
 * Recebe só a verificação refeita no navegador do pesquisador, e não o
 * relatório gravado pelo professor — de propósito, na assinatura: o gravado
 * pode ter sido forjado por acesso direto à API, e não tem como decidir nada.
 */
export function publicacaoLiberada(
  refeito: RelatorioDaVerificacao | null
): { linhaDoDefeito: number; linhasAceitas: number[] } | undefined {
  return refeito?.aprovado ? refeito.derivado : undefined;
}
