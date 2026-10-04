/**
 * Se o tutorial do participante já abriu neste aparelho (D32).
 *
 * Ele abre sozinho só na primeira entrada; depois, pelo botão de ajuda. A
 * marca fica no aparelho, como a identidade anônima (D29): no estudo, cada
 * participante usa o próprio aparelho, e o aparelho é a pessoa.
 *
 * Sem armazenamento — janela privada, dado do site bloqueado —, a leitura
 * falha e o tutorial abre de novo a cada exercício. É o erro do lado certo:
 * mostrar a mais é incômodo, e deixar de mostrar a quem nunca viu muda a
 * condição do participante.
 */

const CHAVE = 'depurar:tutorial-visto';

/**
 * O do professor (D33) tem marca própria: o professor que testa a tela do
 * aluno no mesmo aparelho não pode apagar o tutorial dele, nem o contrário.
 */
const CHAVE_DO_PROFESSOR = 'depurar:tutorial-do-professor-visto';

function jaVisto(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) !== null;
  } catch {
    return false;
  }
}

function marcar(chave: string): void {
  try {
    window.localStorage.setItem(chave, new Date().toISOString());
  } catch {
    // Sem armazenamento, fica sem marca: ver a explicação acima.
  }
}

export const tutorialJaVisto = () => jaVisto(CHAVE);
export const marcarTutorialVisto = () => marcar(CHAVE);
export const tutorialDoProfessorJaVisto = () => jaVisto(CHAVE_DO_PROFESSOR);
export const marcarTutorialDoProfessorVisto = () => marcar(CHAVE_DO_PROFESSOR);
