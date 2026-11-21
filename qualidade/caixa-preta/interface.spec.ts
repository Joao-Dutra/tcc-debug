import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { vetorDobrar } from '../../src/exercicios/vetor-dobrar';

/**
 * Testes de caixa preta automatizados na interface gráfica (Playwright).
 *
 * Cada teste corresponde a um caso documentado no relatório (CTCP01 a
 * CTCP06). O exercício usado é "Vetor: os dobros não batem com os valores
 * originais" (vetor-dobrar), cujo defeito está na linha 6.
 */

const EXERCICIO = '/#/exercicio/vetor-dobrar?andaime=com-apoio';
const LINHA_DO_DEFEITO = 6;

/** Troca todo o conteúdo do editor pelo texto dado. */
async function escreverNoEditor(page: Page, codigo: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(codigo);
}

/** O número da linha no gutter: o primeiro elemento é de medida, então a linha N é o N-ésimo. */
const numeroDaLinha = (page: Page, linha: number) =>
  page.locator('.cm-lineNumbers .cm-gutterElement').nth(linha);

test('CTCP01 — o filtro da vitrine mostra só os exercícios da estrutura escolhida', async ({ page }) => {
  await page.goto('/#/exercicios');
  const secoes = page.getByRole('heading', { level: 2 });
  await expect(secoes).toHaveText(['Vetor', 'Ordenação', 'Pilha', 'Fila', 'Lista encadeada']);

  const fila = page.getByRole('button', { name: 'Fila', exact: true });
  await fila.click();

  await expect(secoes).toHaveText(['Fila']);
  await expect(fila).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cartao').first()).toContainText(/Fila/);
});

test('CTCP02 — abrir o exercício executa o código e mostra a visualização passo a passo', async ({ page }) => {
  await page.goto(EXERCICIO);

  // O código exibido é o com defeito, e algum caso de teste falha.
  await expect(page.locator('.cm-content')).toContainText('itens[indice + 1] * 2');
  await expect(page.locator('.painel li.falhou').first()).toBeVisible();
  await expect(page.locator('.painel.acertou')).toHaveCount(0);

  // O reprodutor começa no passo 1 e avança com o botão.
  const contador = page.locator('.contador');
  await expect(contador).toContainText('passo 1 /');
  await page.getByRole('button', { name: 'próximo passo' }).click();
  await expect(contador).toContainText('passo 2 /');
  await page.getByRole('button', { name: 'passo anterior' }).click();
  await expect(contador).toContainText('passo 1 /');
});

test('CTCP03 — apontar a linha diz se o defeito está ou não nela', async ({ page }) => {
  // Relógio controlado: entre duas tentativas há um intervalo obrigatório (D25).
  await page.clock.install();
  await page.goto(EXERCICIO);
  const apontadas = page.locator('.apontadas li');

  await numeroDaLinha(page, 2).click();
  await expect(apontadas.first()).toContainText('Linha 2');
  await expect(apontadas.first()).toContainText('o defeito não está aqui');

  await page.clock.fastForward(10_000);
  await numeroDaLinha(page, LINHA_DO_DEFEITO).click();
  await expect(apontadas).toHaveCount(2);
  await expect(apontadas.first()).toContainText(`Linha ${LINHA_DO_DEFEITO}`);
  await expect(apontadas.first()).toContainText('o defeito está aqui');
});

test('CTCP04 — corrigir o código e executar faz todos os casos passarem', async ({ page }) => {
  await page.goto(EXERCICIO);
  await escreverNoEditor(page, vetorDobrar.codigoCorreto);
  await page.getByRole('button', { name: /Executar/ }).click();

  await expect(page.locator('.painel.acertou')).toBeVisible();
  await expect(page.locator('.painel li.falhou')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /próximo exercício/i })).toBeVisible();
});

test('CTCP05 — as dicas são reveladas uma de cada vez', async ({ page }) => {
  await page.goto(EXERCICIO);
  const dicas = page.locator('li.dica');
  await expect(dicas).toHaveCount(0);

  await page.getByRole('button', { name: 'Revelar dica 1' }).click();
  await expect(dicas).toHaveCount(1);
  await expect(dicas.first()).toContainText(vetorDobrar.dicas[0]);

  await page.getByRole('button', { name: 'Revelar dica 2' }).click();
  await expect(dicas).toHaveCount(2);
});

test('CTCP06 — um laço infinito é interrompido e o estudante é avisado', async ({ page }) => {
  await page.goto(EXERCICIO);
  await escreverNoEditor(page, 'var itens = [1, 2];\nvar indice = 0;\nwhile (indice < 2) {\n  itens[0] = 1;\n}');
  await page.getByRole('button', { name: /Executar/ }).click();

  await expect(page.locator('.painel .erro')).toContainText('laço infinito');
  // A página continua respondendo: dá para executar de novo.
  await expect(page.getByRole('button', { name: 'Executar', exact: true })).toBeEnabled();
});
