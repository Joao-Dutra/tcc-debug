import { expect, test } from '@playwright/test';

/**
 * O cabeçalho das telas do participante (D32).
 *
 * Título, marca e navegação ancorados numa faixa só, em todas as telas por que
 * o participante passa. A marca leva ao início, exceto no próprio início.
 */

const TELAS = [
  { rota: '/#/exercicios', titulo: 'Exercícios' },
  { rota: '/#/exercicio/vetor-dobrar?andaime=com-apoio', titulo: /^Vetor: / },
  { rota: '/#/exercicio/vetor-dobrar?andaime=sem-apoio', titulo: /^Vetor: / },
];

for (const { rota, titulo } of TELAS) {
  test(`${rota} tem a marca e o título dentro do cabeçalho`, async ({ page }) => {
    await page.goto(rota);
    const cabecalho = page.locator('header.cabecalho');
    await expect(cabecalho).toHaveCount(1);
    await expect(cabecalho.getByRole('heading', { level: 1 })).toHaveText(titulo);
    await expect(cabecalho.getByRole('link', { name: 'Depurar' })).toHaveAttribute('href', '#/');
  });
}

test('no início a marca está no cabeçalho, e não é link', async ({ page }) => {
  await page.goto('/#/');
  const cabecalho = page.locator('header.cabecalho');
  await expect(cabecalho.getByText('Depurar')).toBeVisible();
  await expect(cabecalho.getByRole('link', { name: 'Depurar' })).toHaveCount(0);
});

// A faixa vai de ponta a ponta sem passar da janela: a primeira versão criava
// rolagem horizontal em largura de celular.
test('a faixa do cabeçalho cobre a largura toda e não cria rolagem', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/exercicios');
  const larguras = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    janela: document.documentElement.clientWidth,
  }));
  expect(larguras.documento).toBeLessThanOrEqual(larguras.janela);
});
