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

export function tutorialJaVisto(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) !== null;
  } catch {
    return false;
  }
}

export function marcarTutorialVisto(): void {
  try {
    window.localStorage.setItem(CHAVE, new Date().toISOString());
  } catch {
    // Sem armazenamento, fica sem marca: ver a explicação acima.
  }
}
