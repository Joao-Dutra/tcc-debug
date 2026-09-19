import { expect, test } from '@playwright/test';
import { listaInserirPosicao } from '../src/exercicios/lista-inserir-posicao';
import { vetorDobrar } from '../src/exercicios/vetor-dobrar';

/** O fluxo dentro da tela de exercício (D20). */

/** Corrige o código no editor e executa, até todos os casos passarem. */
async function corrigirEExecutar(page: import('@playwright/test').Page, codigo: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(codigo);
  await page.getByRole('button', { name: /Executar/ }).click();
  await expect(page.locator('.painel.acertou')).toBeVisible();
}

test.describe('continuar sem voltar ao catálogo', () => {
  test('o convite leva ao próximo exercício com o mesmo apoio', async ({ page }) => {
    // Sem apoio de propósito: é o nível que o convite precisa carregar adiante.
    await page.goto('/#/exercicio/vetor-dobrar?andaime=sem-apoio');
    await corrigirEExecutar(page, vetorDobrar.codigoCorreto);

    await page.getByRole('link', { name: /próximo exercício/i }).click();

    await expect(page).toHaveURL(/#\/exercicio\/pilha-desempilhar\?andaime=sem-apoio$/);
    // Sessão nova (D8): o exercício recomeça do código com defeito, e não do
    // que ficou no editor anterior.
    await expect(page.locator('.cm-content')).toContainText('function empilhar');
    await expect(page.locator('.nivel.ativo')).toHaveText('sem apoio');
    await expect(page.locator('.painel.acertou')).toHaveCount(0);
  });

  test('o convite não informa posição nem quantidade', async ({ page }) => {
    await page.goto('/#/exercicio/vetor-dobrar?andaime=com-apoio');
    await corrigirEExecutar(page, vetorDobrar.codigoCorreto);

    const convite = page.getByRole('link', { name: /próximo exercício/i });
    // Nada de "2 de 9", "faltam 7" ou contagem de resolvidos: progresso
    // continua fora da interface do estudante.
    expect(await convite.innerText()).not.toMatch(/\d/);
  });

  test('o último exercício também convida, dando a volta', async ({ page }) => {
    // A ausência do convite no fim da lista contaria ao estudante onde ele
    // está na sequência, que é o mesmo que mostrar progresso. Por isso o
    // último volta ao primeiro do catálogo.
    await page.goto('/#/exercicio/lista-inserir-posicao?andaime=com-apoio');
    await corrigirEExecutar(page, listaInserirPosicao.codigoCorreto);

    await page.getByRole('link', { name: /próximo exercício/i }).click();
    await expect(page).toHaveURL(/#\/exercicio\/vetor-zerar-negativos\?andaime=com-apoio$/);
  });
});

test('as linhas apontadas aparecem da mais recente para a mais antiga', async ({ page }) => {
  await page.goto('/#/exercicio/pilha-desempilhar?andaime=com-apoio');

  const numeros = page.locator('.cm-lineNumbers .cm-gutterElement');
  // O gutter tem um elemento de medida antes da primeira linha, então a
  // linha N é o elemento N.
  await numeros.nth(3).click();
  await numeros.nth(7).click();

  const apontadas = page.locator('.apontadas li');
  await expect(apontadas).toHaveCount(2);
  await expect(apontadas.first()).toContainText('Linha 7');
  await expect(apontadas.last()).toContainText('Linha 3');
});
