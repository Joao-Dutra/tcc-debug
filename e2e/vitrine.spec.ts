import { expect, test } from '@playwright/test';

/** O filtro por estrutura da vitrine (D20). */
test.describe('vitrine de exercícios', () => {
  test('o filtro deixa só a fileira da estrutura escolhida', async ({ page }) => {
    await page.goto('/#/exercicios');

    const fileiras = page.getByRole('heading', { level: 2 });
    await expect(fileiras).toHaveText(['Vetor', 'Ordenação', 'Pilha', 'Fila', 'Lista encadeada']);

    const pilha = page.getByRole('button', { name: 'Pilha', exact: true });
    await pilha.click();

    await expect(fileiras).toHaveText(['Pilha']);
    await expect(pilha).toHaveAttribute('aria-pressed', 'true');
    // Os três exercícios de pilha do catálogo, e nenhum de outra estrutura.
    await expect(page.locator('.cartao')).toHaveCount(3);

    await page.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(fileiras).toHaveText(['Vetor', 'Ordenação', 'Pilha', 'Fila', 'Lista encadeada']);
  });

  // A ordenação tem seção e filtro próprios (D34), sem deixar de ser vetor: os
  // cartões abrem pelo mesmo id de sempre, e a busca binária fica em vetor.
  test('o filtro da ordenação mostra os três algoritmos, e a busca fica em vetor', async ({ page }) => {
    await page.goto('/#/exercicios');
    await page.getByRole('button', { name: 'Ordenação', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Ordenação']);
    const cartoes = page.locator('.cartao');
    await expect(cartoes).toHaveCount(3);
    await expect(cartoes.first().getByRole('link', { name: 'com apoio' })).toHaveAttribute(
      'href',
      '#/exercicio/vetor-ordenar?andaime=com-apoio'
    );

    await page.getByRole('button', { name: 'Vetor', exact: true }).click();
    await expect(page.getByRole('heading', { name: /a busca não acha/, level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /ordenação/i, level: 3 })).toHaveCount(0);
  });

  // A cor da etiqueta de complexidade não pode ser o único portador do nível
  // (D20): cada cartão diz a palavra.
  test('cada cartão diz a complexidade por escrito', async ({ page }) => {
    await page.goto('/#/exercicios');

    const cartoes = page.locator('.cartao');
    const total = await cartoes.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      await expect(cartoes.nth(i).locator('.complexidade')).toHaveText(
        /introdutório|intermediário|desafiador/
      );
    }
  });

  test('cada cartão abre o exercício nos dois níveis de apoio', async ({ page }) => {
    await page.goto('/#/exercicios');

    const primeiro = page.locator('.cartao').first();
    await expect(primeiro.getByRole('link', { name: 'com apoio' })).toHaveAttribute(
      'href',
      /andaime=com-apoio$/
    );
    await primeiro.getByRole('link', { name: 'sem apoio' }).click();
    await expect(page).toHaveURL(/#\/exercicio\/.+\?andaime=sem-apoio$/);
  });
});
