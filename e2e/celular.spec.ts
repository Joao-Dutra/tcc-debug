import { expect, test } from '@playwright/test';

/**
 * Largura de celular (D20).
 *
 * O Edge headless não abre janela abaixo de 492 px, então esta é a faixa que as
 * capturas de tela não alcançam. Aqui a largura vem de emulação, e não da
 * janela.
 *
 * O que o teste responde é se a página cabe: nada transborda para os lados. Se
 * o texto fica legível e se a fileira rola bem com o dedo são perguntas de
 * olho e de aparelho, e continuam pendentes de uma conferência manual.
 */

const TELAS = [
  { nome: 'inicial', rota: '#/' },
  { nome: 'vitrine', rota: '#/exercicios' },
  { nome: 'exercício', rota: '#/exercicio/pilha-desempilhar?andaime=com-apoio' },
  { nome: 'do professor', rota: '#/autoria' },
];

for (const largura of [360, 390]) {
  test.describe(`em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 740 } });

    for (const tela of TELAS) {
      test(`a tela ${tela.nome} cabe na largura`, async ({ page }) => {
        await page.goto(`/${tela.rota}`);
        await expect(page.locator('h1')).toBeVisible();

        const medida = await page.evaluate(() => ({
          pagina: document.documentElement.scrollWidth,
          janela: window.innerWidth,
        }));
        expect(medida.pagina).toBeLessThanOrEqual(medida.janela);
      });
    }

    // A vitrine é o caso em que a rolagem horizontal é de propósito: ela mora
    // dentro da fileira, e não na página.
    test('a fileira da vitrine rola por dentro', async ({ page }) => {
      await page.goto('/#/exercicios');
      const prateleira = page.locator('.prateleira').first();
      const medida = await prateleira.evaluate((el) => ({
        conteudo: el.scrollWidth,
        visivel: el.clientWidth,
      }));
      expect(medida.conteudo).toBeGreaterThan(medida.visivel);
    });
  });
}
