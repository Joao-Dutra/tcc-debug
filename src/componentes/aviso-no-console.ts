/**
 * O recado para quem abre as ferramentas de desenvolvedor (D41).
 *
 * Num laboratório, sempre tem alguém que abre o console para ver o que dá
 * para mexer. O recado é em tom de conversa, e não de ameaça: diz que é um
 * ambiente de pesquisa, que o que vai ao servidor fica registrado, e devolve
 * a pessoa ao exercício. Não fala da isca nem dos limites (0006): avisar
 * onde está a isca a tornaria inútil, e os limites não mudam nada para quem
 * só resolve os exercícios.
 *
 * Fica no console, e não na tela: quem não abre as ferramentas não vê nada,
 * e a tela do participante não muda (congelamento de D39).
 */
export const AVISO_NO_CONSOLE =
  'Oi! 👋 Isto aqui é um ambiente de pesquisa, de um TCC do IFMG — Campus Ouro Branco. ' +
  'O que este navegador manda ao servidor fica registrado. ' +
  'O gabarito não mora no console 😄 — o defeito está no código, esperando por você. Bom proveito!';

/** Estilo do recado: maior e em negrito, para não se perder entre as mensagens do navegador. */
const ESTILO = 'font-size: 14px; font-weight: bold;';

/** Escreve o recado uma vez, na carga da página. */
export function avisarNoConsole(saida: Pick<Console, 'info'> = console): void {
  saida.info(`%c${AVISO_NO_CONSOLE}`, ESTILO);
}
