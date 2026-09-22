import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * Sair do exercício com a execução em curso não a apaga (D23).
 *
 * O laço infinito de verdade seria o cenário natural, mas a maioria deles
 * esbarra no limite de passos em milissegundos, e o que escapa leva cinco
 * segundos de tempo limite: o teste ficaria lento ou dependeria de sorte. Em
 * vez disso, o script do Worker é retido na rede — do ponto de vista da tela,
 * é a mesma coisa: a execução foi disparada e o resultado não volta.
 */
test('execução em curso ao sair fica gravada como interrompida', async ({ page, context }) => {
  let reter = false;
  const retidas: Route[] = [];
  await context.route(/executor\.worker/, (rota) => {
    if (reter) retidas.push(rota);
    else void rota.continue();
  });

  await page.goto('/#/exercicio/pilha-reverter?andaime=com-apoio');
  // O clique espera o botão habilitar: a execução automática da abertura
  // precisa ter terminado antes de o Worker ser retido.
  const executar = page.getByRole('button', { name: 'Executar', exact: true });
  await expect(executar).toBeEnabled();
  reter = true;
  await executar.click();
  await expect(page.getByRole('button', { name: /Executando/ })).toBeVisible();

  // O estudante desiste de esperar e sai.
  await page.goto('/#/metricas');
  await expect(page.getByRole('heading', { name: 'Sessões (1 de 1 · 1 válidas)' })).toBeVisible();
  await page.getByRole('button', { name: 'eventos' }).click();
  const interrompida = page.getByText('execução (estudante) · interrompida antes do resultado');
  await expect(interrompida).toBeVisible();

  // O Worker finalmente responde. A sessão já foi encerrada, e o resultado
  // tardio não muda o que foi gravado.
  reter = false;
  for (const rota of retidas) await rota.continue();
  await page.waitForTimeout(1000);
  await page.getByLabel(/Só sessões válidas/).check();
  await expect(interrompida).toBeVisible();
});
