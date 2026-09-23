import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * O desenho do vetor nos dois exercícios novos (D27).
 *
 * O que só o navegador responde: que os marcadores declarados pelo exercício
 * chegam ao desenho, que o rótulo deles some sem apoio, e que o quadro mostra
 * de onde veio o valor escrito — o movimento da troca, que é o que faz o
 * defeito da ordenação aparecer.
 */

async function abrir(page: Page, id: string, andaime: string) {
  await page.goto(`/#/exercicio/${id}?andaime=${andaime}`);
  // O botão só habilita quando a execução da abertura termina.
  await expect(page.getByRole('button', { name: 'Executar', exact: true })).toBeEnabled();
  return page.locator('input[type=range]');
}

/** No primeiro quadro nenhuma variável existe ainda: o desenho está vazio. */
async function irParaOFim(barra: ReturnType<Page['locator']>) {
  await barra.fill((await barra.getAttribute('max')) ?? '0');
}

test('a busca binária desenha os três marcadores, e sem apoio some só o rótulo', async ({
  page,
}) => {
  const desenho = page.locator('.bancada svg');

  await irParaOFim(await abrir(page, 'vetor-busca-binaria', 'com-apoio'));
  await expect(desenho).toHaveAttribute('aria-label', /meio = \d+, inicio = \d+, fim = \d+/);
  // Três formas, uma por marcador: duas setas cheias — a principal e o
  // losango, que é a terceira forma — e uma vazada.
  await expect(desenho.locator('path.svg-seta-vazada')).toHaveCount(1);
  await expect(desenho.locator('path.svg-seta-cheia')).toHaveCount(2);

  await irParaOFim(await abrir(page, 'vetor-busca-binaria', 'sem-apoio'));
  // O rótulo sai; a forma e a faixa ficam (D9).
  await expect(desenho).toHaveAttribute('aria-label', /^Vetor com \d+ posições$/);
  await expect(desenho.locator('path.svg-seta-vazada')).toHaveCount(1);
  await expect(desenho.locator('path.svg-seta-cheia')).toHaveCount(2);
});

test('a ordenação mostra de onde veio o valor escrito, com e sem apoio', async ({ page }) => {
  for (const andaime of ['com-apoio', 'sem-apoio']) {
    const barra = await abrir(page, 'vetor-ordenar', andaime);
    const rastro = page.locator('.bancada svg path.svg-ligacao');

    // No primeiro quadro nada foi escrito ainda.
    await barra.fill('0');
    await expect(rastro, andaime).toHaveCount(0);

    // Em algum quadro da primeira troca, o rastro aparece.
    let quadroComRastro = -1;
    for (let passo = 1; passo <= 14 && quadroComRastro < 0; passo++) {
      await barra.fill(String(passo));
      if ((await rastro.count()) > 0) quadroComRastro = passo;
    }
    expect(quadroComRastro, `nenhum quadro mostrou de onde veio o valor (${andaime})`)
      .toBeGreaterThan(0);
  }
});

test('a caixa da temporária mostra o valor que saiu do vetor', async ({ page }) => {
  const barra = await abrir(page, 'vetor-ordenar', 'com-apoio');
  const desenho = page.locator('.bancada svg');

  // Depois da primeira cópia para a temporária, o 5 que saiu da posição 0
  // aparece na caixa — e é ele que, com o defeito, nunca volta.
  await barra.fill('10');
  await expect(desenho.getByText('temp', { exact: true })).toBeVisible();
  await expect(desenho.getByText('5', { exact: true }).first()).toBeVisible();
});
