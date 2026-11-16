import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { responderQuestionario } from './questionario-do-estudo';

/**
 * Captura das telas congeladas (D39), para comparar pixel a pixel antes e
 * depois de uma mudança de aparência em outras telas. As imagens vão para a
 * pasta de CONGELADO_DIR; sem a variável, o arquivo não faz nada.
 *
 * As telas daqui são as do percurso do estudo e os painéis sem banco. Desde
 * D44 e D46 todas elas têm a aparência nova, por decisão: a captura serve
 * para comparar o estado de agora com o de depois de uma mudança futura, e
 * não mais com o de antes de D43.
 */
const PASTA = process.env.CONGELADO_DIR;
test.skip(!PASTA, 'só roda com CONGELADO_DIR');
test.use({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });

async function foto(page: Page, nome: string) {
  // Fontes carregadas e nada em transição.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: true, animations: 'disabled', caret: 'hide' });
}

const aberto = (page: Page) => expect(page.locator('.contador')).toContainText('passo 1 /');

test('aviso do estudo no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/estudo/piloto-nov');
  await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible();
  await foto(page, 'celular-estudo-aviso');
});

test('área do estudo, do aviso ao fim', async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
  await page.goto('/#/estudo/piloto-nov');
  await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible();
  await foto(page, 'estudo-1-aviso');
  await page.getByLabel('Concordo em participar').check();
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByRole('heading', { name: 'Sobre você' })).toBeVisible();
  await foto(page, 'estudo-2-perfil');
  await page.getByRole('radio', { name: 'Já cursei' }).check();
  await page.getByRole('radio', { name: 'Nunca' }).check();
  await page.getByRole('radio', { name: 'Sim' }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await foto(page, 'estudo-3-tutorial');
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await aberto(page);
  await foto(page, 'estudo-4-aquecimento');
  await page.getByRole('button', { name: 'Seguir para o próximo' }).click();
  await foto(page, 'estudo-5-confirmar-seguir');
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  for (let n = 1; n <= 5; n++) {
    await expect(page.locator('.posicao-no-percurso')).toHaveText(`Exercício ${n} de 5`);
    await aberto(page);
    await foto(page, `estudo-6-exercicio-${n}`);
    await page.getByRole('button', { name: n === 5 ? 'Concluir os exercícios' : 'Seguir para o próximo' }).click();
    await page.getByRole('button', { name: n === 5 ? 'Concluir' : 'Seguir', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Para terminar' })).toBeVisible();
  await foto(page, 'estudo-7-questionario');
  await responderQuestionario(page);
  await expect(page.getByRole('heading', { name: 'Obrigado pela participação' })).toBeVisible();
  await foto(page, 'estudo-8-fim');
  await page.goto('/#/estudo/piloto-nov/conferir');
  await page.waitForTimeout(1500);
  await foto(page, 'estudo-9-conferir');
});

test('painéis do pesquisador', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
  await page.goto('/#/exercicio/vetor-dobrar?andaime=com-apoio');
  await aberto(page);
  await page.goto('/#/metricas');
  await page.waitForTimeout(1000);
  await foto(page, 'painel-metricas');
  await page.goto('/#/controle');
  await page.waitForTimeout(1000);
  await foto(page, 'painel-controle');
  await page.goto('/#/controle?secao=rotas');
  await page.waitForTimeout(1000);
  await foto(page, 'painel-controle-rotas');
});
