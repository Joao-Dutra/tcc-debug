import { expect, test } from '@playwright/test';

/**
 * A entrada (D29, D32).
 *
 * A tela inicial tem um botão só, que leva à tela de entrada, com duas saídas.
 * O estudante segue sem conta, com um botão só e o aviso de registro junto
 * dele; o professor entra com Google ou com e-mail e senha. O caminho do
 * estudante precisa ser o mais leve: uma tela com cara de login pode fazê-lo
 * supor que precisa de conta. A suíte roda com o banco desligado (D22).
 */

test('a tela inicial tem um botão de entrar só, que leva à tela de entrada', async ({ page }) => {
  await page.goto('/#/');
  const entradas = page.getByRole('link', { name: /entrar/i });
  await expect(entradas).toHaveCount(1);
  await entradas.click();
  await expect(page).toHaveURL(/#\/entrar$/);
  await expect(page.getByRole('heading', { name: 'Entrar', level: 1 })).toBeVisible();
});

test('o estudante entra com um botão só, sem campo, avisado do registro', async ({ page }) => {
  await page.goto('/#/entrar');
  const estudante = page.locator('section', { has: page.getByRole('heading', { name: 'Sou estudante' }) });
  // Nenhum campo nem caixa de marcar entre o estudante e os exercícios.
  await expect(estudante.locator('input, select, textarea')).toHaveCount(0);
  await expect(estudante.getByRole('link')).toHaveCount(1);
  await expect(estudante.getByRole('button')).toHaveCount(0);
  await expect(estudante.getByText(/não precisa de conta/i)).toBeVisible();
  // O aviso fica junto do botão, na mesma saída.
  await expect(estudante.getByText(/registrada de forma anônima para fins de pesquisa/)).toBeVisible();
  await expect(estudante.getByText(/incluindo o código que você escrever/)).toBeVisible();

  await estudante.getByRole('link', { name: 'Entrar como estudante' }).click();
  await expect(page).toHaveURL(/#\/exercicios$/);
});

test('o estudante vem antes do professor, na leitura e na tela', async ({ page }) => {
  await page.goto('/#/entrar');
  const titulos = page.locator('.saidas-da-entrada h2');
  await expect(titulos).toHaveText(['Sou estudante', 'Sou professor']);

  for (const largura of [1366, 390]) {
    await page.setViewportSize({ width: largura, height: 800 });
    const estudante = await page.getByRole('link', { name: 'Entrar como estudante' }).boundingBox();
    const google = await page.getByRole('button', { name: 'Entrar com Google' }).boundingBox();
    // Em tela larga lado a lado, à esquerda; em tela estreita, em cima.
    if (largura > 900) expect(estudante!.x, `${largura}`).toBeLessThan(google!.x);
    else expect(estudante!.y, `${largura}`).toBeLessThan(google!.y);
  }
});

test('o professor entra com Google, com o ícone, ou com e-mail e senha', async ({ page }) => {
  await page.goto('/#/entrar');
  const professor = page.locator('section', { has: page.getByRole('heading', { name: 'Sou professor' }) });
  const google = professor.getByRole('button', { name: 'Entrar com Google' });
  await expect(google).toBeVisible();
  await expect(google.locator('svg.icone-google')).toHaveCount(1);
  await expect(professor.getByLabel('E-mail')).toBeVisible();
  await expect(professor.getByLabel('Senha')).toBeVisible();
  await expect(professor.getByRole('button', { name: 'Entrar com e-mail' })).toBeVisible();
  // Sem banco, a tela diz por que a entrada não funciona, e não promete uma
  // entrada que falharia.
  await expect(professor.getByText(/o banco não está configurado/)).toBeVisible();
  await expect(google).toBeDisabled();
});

test('o estudante não vê pedido de conta fora da tela de entrada', async ({ page }) => {
  for (const rota of ['/#/', '/#/exercicios', '/#/exercicio/vetor-dobrar?andaime=com-apoio']) {
    await page.goto(rota);
    await expect(page.getByText(/criar conta|entrar com google|cadastr/i)).toHaveCount(0);
  }
});

test('a área do professor, pelo endereço, diz sem banco por que não funciona', async ({ page }) => {
  await page.goto('/#/autoria');
  await expect(page.getByRole('heading', { name: 'Área do professor', level: 1 })).toBeVisible();
  await expect(page.getByText(/o banco não está configurado/).first()).toBeVisible();
});

// A pré-visualização é do autor (D33): nenhuma tela do aluno aponta para ela,
// e sem banco ela diz por que não funciona.
test('a pré-visualização fica fora das entradas, e sem banco diz por quê', async ({ page }) => {
  for (const rota of ['/#/', '/#/entrar', '/#/exercicios']) {
    await page.goto(rota);
    await expect(page.locator('a[href^="#/previa"]')).toHaveCount(0);
  }
  await page.goto('/#/previa/qualquer-id?andaime=com-apoio');
  await expect(page.getByRole('heading', { name: 'Pré-visualização', level: 1 })).toBeVisible();
  await expect(page.getByText(/o banco não está configurado/)).toBeVisible();
});
