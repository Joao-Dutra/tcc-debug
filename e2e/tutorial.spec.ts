import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * O tutorial do participante (D32).
 *
 * Abre sozinho na primeira entrada do aparelho e depois só pelo botão de
 * ajuda; é idêntico nos dois níveis de apoio; e entra no log da sessão quando
 * foi visto e quando foi pulado.
 */

// Aparelho limpo: o resto da suíte começa com o tutorial já visto.
test.use({ storageState: { cookies: [], origins: [] } });

const exercicio = (andaime: string) => `/#/exercicio/vetor-ordenar?andaime=${andaime}`;
const dialogo = (page: Page) => page.getByRole('dialog');
const principal = (page: Page) =>
  dialogo(page).getByRole('button', { name: /^(Próximo|Começar)$/ });

/** Percorre o tutorial inteiro e devolve o título e o texto de cada passo. */
async function lerTodosOsPassos(page: Page): Promise<string[]> {
  const passos: string[] = [];
  for (;;) {
    passos.push(await dialogo(page).locator('.tutorial-corpo').innerText());
    if ((await principal(page).innerText()) === 'Começar') break;
    await principal(page).click();
  }
  return passos;
}

test('abre sozinho na primeira entrada, e é o mesmo nos dois níveis de apoio', async ({
  browser,
}) => {
  const lidos: Record<string, string[]> = {};
  for (const andaime of ['com-apoio', 'sem-apoio']) {
    // Um aparelho novo para cada nível: nos dois, é a primeira entrada.
    const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await contexto.newPage();
    await page.goto(exercicio(andaime));
    await expect(dialogo(page)).toBeVisible();
    await expect(principal(page)).toBeFocused();
    lidos[andaime] = await lerTodosOsPassos(page);
    await contexto.close();
  }
  expect(lidos['com-apoio'].length).toBeGreaterThan(3);
  expect(lidos['sem-apoio']).toEqual(lidos['com-apoio']);
});

test('depois da primeira entrada, só abre pelo botão de ajuda', async ({ page }) => {
  await page.goto(exercicio('com-apoio'));
  await expect(dialogo(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogo(page)).toBeHidden();

  // Outro exercício, e o mesmo de novo: não abre mais sozinho.
  for (const rota of ['/#/exercicio/pilha-desempilhar?andaime=sem-apoio', exercicio('com-apoio')]) {
    await page.goto(rota);
    await expect(page.getByRole('button', { name: 'Executar', exact: true })).toBeEnabled();
    await expect(dialogo(page)).toBeHidden();
  }

  await page.getByRole('button', { name: 'Ajuda' }).click();
  await expect(dialogo(page)).toBeVisible();
  // Toda abertura recomeça do primeiro passo.
  await expect(dialogo(page)).toContainText('passo 1 de');
});

test('o log registra quando foi visto e quando foi pulado', async ({ page }) => {
  await page.goto(exercicio('com-apoio'));
  await expect(dialogo(page)).toBeVisible();
  // Vê dois passos e pula.
  await principal(page).click();
  await dialogo(page).getByRole('button', { name: 'Pular tutorial' }).click();
  await expect(dialogo(page)).toBeHidden();

  // Volta pela ajuda e vai até o fim.
  await page.getByRole('button', { name: 'Ajuda' }).click();
  const total = (await lerTodosOsPassos(page)).length;
  await principal(page).click();
  await expect(dialogo(page)).toBeHidden();

  // Sair do exercício arquiva a sessão, e o arquivo fica no aparelho (D15).
  await page.goto('/#/exercicios');
  const eventos = await page.evaluate(() => {
    const sessoes = JSON.parse(localStorage.getItem('depurar:sessoes-arquivadas') ?? '[]');
    return sessoes
      .flatMap((s: { eventos: { tipo: string }[] }) => s.eventos)
      .filter((e: { tipo: string }) => e.tipo.startsWith('tutorial'))
      .map(({ t: _t, ...resto }: { t: number }) => resto);
  });
  expect(eventos).toEqual([
    { tipo: 'tutorial-aberto', motivo: 'primeira-entrada' },
    { tipo: 'tutorial-fechado', desfecho: 'pulado', passoAlcancado: 2, totalDePassos: total },
    { tipo: 'tutorial-aberto', motivo: 'ajuda' },
    { tipo: 'tutorial-fechado', desfecho: 'concluido', passoAlcancado: total, totalDePassos: total },
  ]);
});
