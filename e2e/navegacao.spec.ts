import { expect, test } from '@playwright/test';

/**
 * A navegação no reprodutor entra no log da sessão (D36).
 *
 * O teste do núcleo cobra a forma dos eventos; este cobra que os controles de
 * verdade os produzem — e que um arrasto com o ponteiro, que dispara dezenas
 * de mudanças na barra, chega ao log como um evento só.
 */

interface EventoLido {
  tipo: string;
  gesto?: string;
  de?: number;
  para?: number;
  total?: number;
}

test('avançar, voltar, tocar, pausar e arrastar entram no log com o passo de chegada', async ({
  page,
}) => {
  await page.goto('/#/exercicio/vetor-ordenar?andaime=com-apoio');
  // A execução da abertura terminou: há passos no reprodutor.
  await expect(page.locator('.contador')).toContainText('passo 1 /');

  await page.getByRole('button', { name: 'próximo passo' }).click();
  await page.getByRole('button', { name: 'próximo passo' }).click();
  await page.getByRole('button', { name: 'passo anterior' }).click();
  await expect(page.locator('.contador')).toContainText('passo 2 /');

  await page.getByRole('button', { name: 'tocar' }).click();
  await expect(page.locator('.contador')).toContainText('passo 4 /');
  await page.getByRole('button', { name: 'pausar' }).click();

  // Um arrasto de verdade: aperta perto do começo da barra, percorre em
  // vários movimentos e solta perto do fim.
  const barra = page.locator('.controles input[type="range"]');
  const caixa = (await barra.boundingBox())!;
  const y = caixa.y + caixa.height / 2;
  await page.mouse.move(caixa.x + caixa.width * 0.1, y);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width * 0.9, y, { steps: 25 });
  await page.mouse.up();

  // Sair do exercício arquiva a sessão no aparelho (D15).
  await page.goto('/#/exercicios');
  const navegacao = await page.evaluate(() => {
    const sessoes = JSON.parse(localStorage.getItem('depurar:sessoes-arquivadas') ?? '[]');
    return sessoes
      .flatMap((s: { eventos: EventoLido[] }) => s.eventos)
      .filter((e: EventoLido) => e.tipo === 'navegacao' && e.gesto !== 'parou');
  });

  const gestos = navegacao.map((e: EventoLido) => e.gesto);
  expect(gestos).toEqual(['avancar', 'avancar', 'voltar', 'tocar', 'pausar', 'arrastar']);
  const [ida, segunda, volta, tocar, pausar, arrastar] = navegacao as Required<EventoLido>[];
  expect([ida.de, ida.para, segunda.para, volta.para]).toEqual([1, 2, 3, 2]);
  expect([tocar.de, tocar.para]).toEqual([2, 2]);
  expect(pausar.de).toBe(2);
  expect(pausar.para).toBeGreaterThanOrEqual(4);
  // Um evento só, de onde a barra estava até perto do fim.
  expect(arrastar.para).toBeGreaterThan(arrastar.de);
  expect(arrastar.para).toBeGreaterThan(arrastar.total * 0.7);
});
