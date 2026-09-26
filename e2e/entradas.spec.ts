import { expect, test } from '@playwright/test';

/**
 * As duas entradas da tela inicial (D29).
 *
 * O aluno segue direto, sem conta, e é avisado de que a interação é registrada;
 * o professor vai para a área dele. A suíte roda com o banco desligado (D22),
 * então da área se alcança aqui o estado sem banco — os demais são decididos
 * por uma função pura, verificada na suíte rápida.
 */

test('o aluno entra direto nos exercícios, avisado do registro', async ({ page }) => {
  await page.goto('/#/');
  // Informativo, e sem nada a aceitar: não há caixa de marcar nem botão de
  // concordar entre o aluno e os exercícios.
  await expect(page.getByText(/registrada de forma anônima para fins de pesquisa/)).toBeVisible();
  await expect(page.getByText(/incluindo o código que você escrever/)).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);

  await page.getByRole('link', { name: 'Entrar como aluno' }).click();
  await expect(page).toHaveURL(/#\/exercicios$/);
});

test('o aluno não vê pedido de conta em lugar nenhum', async ({ page }) => {
  for (const rota of ['/#/', '/#/exercicios', '/#/exercicio/vetor-dobrar?andaime=com-apoio']) {
    await page.goto(rota);
    await expect(page.getByText(/criar conta|entrar com google|cadastr/i)).toHaveCount(0);
  }
});

test('o professor vai para a área dele', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Entrar como professor' }).click();
  await expect(page).toHaveURL(/#\/autoria$/);
  await expect(page.getByRole('heading', { name: 'Área do professor', level: 1 })).toBeVisible();
  // Sem banco, a área diz por que não funciona, em vez de uma tela vazia.
  await expect(page.getByText(/o banco não está configurado/)).toBeVisible();
});

test('a revisão fica fora das entradas, e sem banco diz por quê', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('a[href="#/revisao"]')).toHaveCount(0);
  await page.goto('/#/revisao');
  await expect(page.getByRole('heading', { name: 'Revisão dos exercícios', level: 1 })).toBeVisible();
  await expect(page.getByText(/o banco não está configurado/)).toBeVisible();
});
