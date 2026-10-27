import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Os dois defeitos de layout corrigidos em D39, nas larguras prováveis do
 * laboratório: o seguir do percurso, que quebrava em duas linhas quando a
 * confirmação abria, e as notas dos formulários, espremidas à esquerda de um
 * bloco mais largo.
 */

const TAMANHOS = [
  { width: 1366, height: 657 },
  { width: 1920, height: 960 },
];

async function aceitarEEntrar(page: Page) {
  await page.goto('/#/estudo/piloto-nov');
  await page.getByLabel('Concordo em participar').check();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('radio', { name: 'Estou cursando' }).check();
  await page.getByRole('radio', { name: 'Às vezes' }).check();
  await page.getByRole('radio', { name: 'Não', exact: true }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
}

/** O texto do elemento cabe numa linha: a altura não passa de uma linha e meia. */
async function emUmaLinha(alvo: Locator) {
  const { altura, linha } = await alvo.evaluate((el) => {
    const estilo = getComputedStyle(el);
    return { altura: el.getBoundingClientRect().height, linha: parseFloat(estilo.lineHeight) };
  });
  const enfeite = await alvo.evaluate((el) => {
    const e = getComputedStyle(el);
    return parseFloat(e.paddingTop) + parseFloat(e.paddingBottom) + parseFloat(e.borderTopWidth) * 2;
  });
  expect(altura - enfeite).toBeLessThan(linha * 1.5);
}

for (const tamanho of TAMANHOS) {
  test.describe(`${tamanho.width} × ${tamanho.height}`, () => {
    test.use({ viewport: tamanho });

    test('o seguir e a confirmação ficam em uma linha, e a barra não muda', async ({ page }) => {
      await aceitarEEntrar(page);
      const pular = page.getByRole('button', { name: 'Pular tutorial' });
      await pular.click();
      const seguir = page.getByRole('button', { name: 'Seguir para o próximo' });
      await emUmaLinha(seguir);
      const barra = page.locator('.cabecalho-barra');
      const alturaAntes = (await barra.boundingBox())!.height;

      await seguir.click();
      const confirmacao = page.locator('.confirmar-seguir');
      await expect(confirmacao).toBeVisible();
      // A pergunta numa linha só, com os dois botões.
      const caixas = await Promise.all(
        [confirmacao.locator('span'), ...(await confirmacao.getByRole('button').all())].map((l) => l.boundingBox())
      );
      const topos = new Set(caixas.map((c) => Math.round(c!.y + c!.height / 2)));
      expect(Math.max(...topos) - Math.min(...topos)).toBeLessThan(4);
      for (const botao of await confirmacao.getByRole('button').all()) await emUmaLinha(botao);
      await emUmaLinha(seguir);
      // O botão continua no lugar, e a barra, da mesma altura.
      expect((await barra.boundingBox())!.height).toBe(alturaAntes);
      await expect(seguir).toHaveAttribute('aria-expanded', 'true');
    });

    test('a nota do aviso ocupa a largura do bloco a que pertence', async ({ page }) => {
      await page.goto('/#/estudo/piloto-nov');
      const bloco = page.locator('.aviso-do-estudo');
      const nota = bloco.locator('.rodape-painel');
      await expect(nota).toBeVisible();
      const larguraDoBloco = (await bloco.boundingBox())!.width;
      expect((await nota.boundingBox())!.width).toBeCloseTo(larguraDoBloco, 0);
      // E o bloco tem chão próprio, mais largo que a medida de antes.
      const corpo = page.locator('.corpo-do-estudo');
      expect(await corpo.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    });
  });
}
