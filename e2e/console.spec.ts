import { expect, test } from '@playwright/test';
import { AVISO_NO_CONSOLE } from '../src/componentes/aviso-no-console';

/**
 * O recado no console (D41) chega ao navegador de verdade, na carga da página
 * — inclusive na área do estudo, que é onde ele mais importa.
 */
for (const rota of ['/#/', '/#/estudo/piloto-nov']) {
  test(`o recado aparece no console, em ${rota}`, async ({ page }) => {
    const mensagens: string[] = [];
    page.on('console', (m) => mensagens.push(m.text()));
    await page.goto(rota);
    await expect.poll(() => mensagens.some((m) => m.includes(AVISO_NO_CONSOLE))).toBe(true);
  });
}
