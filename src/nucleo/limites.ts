/**
 * Os dois limites que param uma execução que não termina (D5), com as
 * mensagens que o estudante lê.
 *
 * Moram aqui, e não em cada lado, porque três lugares precisam concordar sobre
 * eles: o Worker, que conta os passos; o executor, que corta pelo tempo; e a
 * verificação da submissão (D31), que precisa reconhecer um laço infinito para
 * recusá-lo — um exercício que não termina entrega ao estudante o limite, e
 * não um quadro que denuncie o defeito.
 */

export const LIMITE_DE_PASSOS = 5000;

export const TEMPO_LIMITE_MS = 5000;

export const MENSAGEM_DO_LIMITE_DE_PASSOS =
  'Limite de passos excedido — o programa provavelmente entrou em laço infinito.';

export const MENSAGEM_DO_TEMPO_LIMITE = 'Tempo limite de execução excedido.';

/** A execução foi cortada por um dos limites, e não terminou. */
export function naoTerminou(erro: string | undefined): boolean {
  return erro === MENSAGEM_DO_LIMITE_DE_PASSOS || erro === MENSAGEM_DO_TEMPO_LIMITE;
}
