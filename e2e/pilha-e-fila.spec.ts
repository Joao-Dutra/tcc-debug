import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { filaAtenderTodos } from '../src/exercicios/fila-atender-todos';
import { pilhaDesempilhar } from '../src/exercicios/pilha-desempilhar';

/**
 * Os desenhos de pilha e fila leem `topo`, `frente` e `tras` pelo significado
 * que o Ziviani dá a eles (D40): `topo` conta os elementos, e `tras` é a vaga
 * do próximo, uma depois do último.
 *
 * O que só o navegador responde: que a seta e o anel da pilha ficam em
 * `topo - 1`, que a célula em `tras` não faz parte da fila, e que `tras` no
 * lugar dele não é anunciado como fora da fileira. Um desenho que lesse os
 * nomes pela convenção antiga passaria no quadro-denúncia e mentiria na tela.
 */

async function abrir(page: Page, id: string, andaime: string) {
  await page.goto(`/#/exercicio/${id}?andaime=${andaime}`);
  // O botão só habilita quando a execução da abertura termina.
  await expect(page.getByRole('button', { name: 'Executar', exact: true })).toBeEnabled();
}

async function irParaOFim(page: Page) {
  const barra = page.locator('input[type=range]');
  await barra.fill((await barra.getAttribute('max')) ?? '0');
}

async function corrigirEExecutar(page: Page, codigo: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(codigo);
  await page.getByRole('button', { name: /Executar/ }).click();
  await expect(page.locator('.painel.acertou')).toBeVisible();
}

test('na pilha, o topo conta os elementos: seta e anel ficam em topo - 1', async ({ page }) => {
  const desenho = page.locator('.bancada svg');
  await abrir(page, 'pilha-desempilhar', 'com-apoio');

  // Pilha vazia: topo vale 0, e não há elemento para o anel.
  await page.locator('input[type=range]').fill('3');
  await expect(desenho.getByText('topo = 0')).toBeVisible();
  await expect(desenho.locator('.svg-anel')).toHaveCount(0);

  // Com o defeito, sobra um elemento na conta e a posição 0 nunca foi escrita:
  // o topo aponta uma posição vazia, e a ausência do anel é o sintoma.
  await irParaOFim(page);
  await expect(desenho.getByText('topo = 1')).toBeVisible();
  await expect(desenho.locator('.svg-anel')).toHaveCount(0);
  await expect(desenho.locator('rect.svg-celula-ativa')).toHaveCount(0);

  // Corrigida, topo = 1 é uma pilha de um elemento, na posição 0: é ela que o
  // anel marca, e as duas acima já saíram. Pela convenção antiga, topo = 1
  // deixaria duas células ativas e o anel na posição 1.
  await corrigirEExecutar(page, pilhaDesempilhar.codigoCorreto);
  await irParaOFim(page);
  await expect(desenho.getByText('topo = 1')).toBeVisible();
  await expect(desenho.locator('.svg-anel')).toHaveCount(1);
  await expect(desenho.locator('rect.svg-celula-ativa')).toHaveCount(1);
  await expect(desenho.locator('rect.svg-celula-consumida')).toHaveCount(2);
});

test('na fila, tras é a vaga do próximo: não faz parte da fila nem está fora do lugar', async ({
  page,
}) => {
  const desenho = page.locator('.bancada svg');
  await abrir(page, 'fila-atender-todos', 'com-apoio');

  // Com o defeito, o atendimento para com a última ainda na fila.
  await irParaOFim(page);
  await expect(desenho).toHaveAttribute('aria-label', /frente = 2, trás = 3/);
  await expect(desenho.locator('rect.svg-celula-ativa')).toHaveCount(1);
  await expect(desenho.locator('rect.svg-celula-consumida')).toHaveCount(2);
  await expect(desenho.locator('.svg-anel')).toHaveCount(1);
  // `tras` uma posição depois da última célula é o lugar dele.
  await expect(desenho.getByText('fora da fileira')).toHaveCount(0);

  // Corrigida, a fila termina vazia: frente alcança tras, depois da última
  // célula. Só a frente está fora da fileira.
  await corrigirEExecutar(page, filaAtenderTodos.codigoCorreto);
  await irParaOFim(page);
  await expect(desenho).toHaveAttribute('aria-label', /frente = 3, trás = 3/);
  await expect(desenho.locator('rect.svg-celula-ativa')).toHaveCount(0);
  await expect(desenho.locator('.svg-anel')).toHaveCount(0);
  await expect(desenho.getByText('fora da fileira')).toHaveCount(1);
});

test('sem apoio, a fila perde os rótulos e mantém as duas setas', async ({ page }) => {
  const desenho = page.locator('.bancada svg');
  await abrir(page, 'fila-atender-todos', 'sem-apoio');
  await irParaOFim(page);

  await expect(desenho).toHaveAttribute('aria-label', /^Fila com 3 células$/);
  await expect(desenho.locator('path.svg-seta-cheia')).toHaveCount(1);
  await expect(desenho.locator('path.svg-seta-vazada')).toHaveCount(1);
  await expect(desenho.getByText('fora da fileira')).toHaveCount(0);
  await expect(desenho.getByText(/frente|trás/)).toHaveCount(0);
});
