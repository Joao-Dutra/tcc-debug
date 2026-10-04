import { expect, test } from '@playwright/test';

/**
 * O Worker sem rede, no navegador de verdade (D33).
 *
 * O teste da suíte rápida roda o Worker no Node; aqui é o Worker do Edge, com
 * os `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` e `importScripts`
 * do navegador. O código vai pelo editor, como iria o de qualquer exercício,
 * e nenhum pedido pode sair para o endereço que ele tenta.
 */

/** O código e o nome que a recusa traz entre parênteses. */
const TENTATIVAS: [string, string][] = [
  ['fetch("http://exemplo.invalid/fetch");', 'fetch'],
  ['var pedido = new XMLHttpRequest();', 'XMLHttpRequest'],
  ['var canal = new WebSocket("ws://exemplo.invalid/");', 'WebSocket'],
  ['var fonte = new EventSource("http://exemplo.invalid/fonte");', 'EventSource'],
  ['importScripts("http://exemplo.invalid/a.js");', 'importScripts'],
];

test('o código do exercício não alcança a rede', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (pedido) => {
    if (pedido.url().includes('exemplo.invalid')) pedidos.push(pedido.url());
  });

  await page.goto('/#/exercicio/vetor-dobrar?andaime=com-apoio');
  const executar = page.getByRole('button', { name: /Executar/ });
  await expect(executar).toBeEnabled();

  for (const [tentativa, nome] of TENTATIVAS) {
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(`var itens = [1];\n${tentativa}`);
    await executar.click();
    // Com o nome de cada uma: a mensagem da tentativa anterior, ainda na tela,
    // não passa por esta.
    await expect(page.locator('.erro'), tentativa).toContainText(
      `O acesso à rede está bloqueado na execução dos exercícios: nenhum exercício precisa dele. (${nome})`
    );
  }
  expect(pedidos).toEqual([]);
});
