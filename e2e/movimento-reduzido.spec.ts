import { expect, test } from '@playwright/test';
import { vetorDobrar } from '../src/exercicios/vetor-dobrar';

/**
 * Movimento reduzido no navegador (D20).
 *
 * O teste de `src/componentes/movimento-reduzido.test.ts` confere que a exceção
 * está escrita no CSS. Aqui se confere que ela produz efeito: com a preferência
 * ligada, nenhuma animação roda.
 *
 * O que continua fora do alcance de qualquer teste: que a configuração do
 * sistema operacional chegue ao navegador. Isso se confere uma vez, à mão, na
 * máquina do piloto.
 */

/**
 * Nomes das animações em curso na página.
 *
 * O piscar do cursor de texto do editor (`cm-blink`) fica de fora: é cursor de
 * texto, vem do CodeMirror e acompanha a convenção do sistema para o cursor,
 * não o movimento que a aplicação acrescenta.
 */
const animacoesEmCurso = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .map((a) => (a as CSSAnimation).animationName ?? a.constructor.name)
      .filter((nome) => !nome.startsWith('cm-'))
  );

test.describe('com movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nenhuma animação roda na tela inicial', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.folha')).toBeVisible();
    expect(await animacoesEmCurso(page)).toEqual([]);
  });

  test('nenhuma animação roda no sinal de acerto', async ({ page }) => {
    // O exercício abre executando (D1), e com o código corrigido todos os casos
    // passam: é aí que o selo se traçaria.
    await page.goto('/#/exercicio/vetor-dobrar?andaime=com-apoio');
    await expect(page.locator('.painel.acertou')).toHaveCount(0);

    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+A');
    // insertText, e não type: o editor fecha chave e indenta sozinho, e o
    // texto digitado tecla a tecla chega torto do outro lado.
    await page.keyboard.insertText(vetorDobrar.codigoCorreto);
    await page.getByRole('button', { name: /Executar/ }).click();

    await expect(page.locator('.sinal-de-acerto')).toBeVisible();
    expect(await animacoesEmCurso(page)).toEqual([]);
  });
});

test.describe('com movimento normal', () => {
  test.use({ reducedMotion: 'no-preference' });

  // Sem este, o teste acima passaria mesmo que as animações tivessem sumido da
  // tela por outro motivo.
  test('a folha e o marcador animam na tela inicial', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('.folha')).toBeVisible();
    expect(await animacoesEmCurso(page)).toEqual(
      expect.arrayContaining(['marcador-avanca', 'lupa-investiga'])
    );
  });
});
