import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * O tema (D39): o seletor troca e a escolha sobrevive à recarga; na área do
 * estudo, o tema é sempre o padrão, sem seletor, mesmo com outro guardado.
 */

const SALA_PADRAO = 'rgb(234, 222, 205)'; // areia-300
const SALA_AZUL = 'rgb(210, 224, 251)'; // #d2e0fb

const fundo = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const temaDaRaiz = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-tema'));

test('sem escolha, a tela abre no padrão', async ({ page }) => {
  await page.goto('/#/entrar');
  expect(await temaDaRaiz(page)).toBe('padrao');
  expect(await fundo(page)).toBe(SALA_PADRAO);
  await expect(page.getByLabel('Tema')).toHaveValue('padrao');
});

test('o seletor troca o tema, e a escolha sobrevive à recarga', async ({ page }) => {
  await page.goto('/#/entrar');
  await page.getByLabel('Tema').selectOption('azul');
  expect(await temaDaRaiz(page)).toBe('azul');
  expect(await fundo(page)).toBe(SALA_AZUL);

  await page.reload();
  await expect(page.getByLabel('Tema')).toHaveValue('azul');
  expect(await temaDaRaiz(page)).toBe('azul');
  expect(await fundo(page)).toBe(SALA_AZUL);

  // E vale nas outras telas, até voltar ao padrão.
  await page.goto('/#/exercicios');
  expect(await fundo(page)).toBe(SALA_AZUL);
  await page.getByLabel('Tema').selectOption('padrao');
  expect(await fundo(page)).toBe(SALA_PADRAO);
});

test('na área do estudo, o tema é o padrão, sem seletor, mesmo com o azul guardado', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('depurar:tema', 'azul'));
  await page.goto('/#/estudo/piloto-nov');
  await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible();
  expect(await temaDaRaiz(page)).toBe('padrao');
  expect(await fundo(page)).toBe(SALA_PADRAO);
  await expect(page.getByLabel('Tema')).toHaveCount(0);

  // Também dentro do exercício do percurso.
  await page.getByLabel('Concordo em participar').check();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('radio', { name: 'Estou cursando' }).check();
  await page.getByRole('radio', { name: 'Às vezes' }).check();
  await page.getByRole('radio', { name: 'Não', exact: true }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('.contador')).toContainText('passo 1 /');
  expect(await temaDaRaiz(page)).toBe('padrao');
  await expect(page.getByLabel('Tema')).toHaveCount(0);

  // A escolha guardada não foi apagada: fora do estudo, ela volta.
  await page.goto('/#/entrar');
  expect(await temaDaRaiz(page)).toBe('azul');

  // E a conferência das máquinas, que também é da área do estudo.
  await page.goto('/#/estudo/piloto-nov/conferir');
  expect(await temaDaRaiz(page)).toBe('padrao');
  await expect(page.getByLabel('Tema')).toHaveCount(0);
});
