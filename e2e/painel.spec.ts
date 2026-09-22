import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { INTERVALO_ENTRE_LOCALIZACOES_MS } from '../src/nucleo/metricas';

/**
 * Painel de métricas sobre as sessões do aparelho (D22).
 *
 * Roda sem banco — o servidor dos testes sobe com as chaves vazias —, que é o
 * modo em que o painel mostra o espelho local. O modo do pesquisador depende do
 * projeto Supabase e do RLS, e não se verifica daqui.
 */

/** Uma sessão de quem abriu e saiu, e outra de quem executou. */
async function duasSessoes(page: Page) {
  await page.goto('/#/exercicio/vetor-dobrar?andaime=com-apoio');
  await expect(page.getByRole('button', { name: /Executar/ }).first()).toBeVisible();

  await page.goto('/#/exercicio/pilha-reverter?andaime=sem-apoio');
  // O clique espera o botão habilitar, isto é, a execução automática da
  // abertura terminar.
  await page.getByRole('button', { name: 'Executar', exact: true }).click();
  // A execução roda no Worker e só é registrada quando o resultado volta. Sair
  // antes disso perde a execução — é outro defeito, anotado em D22, e não o
  // que este arquivo verifica. O clique é evento discreto, então o React já
  // trocou o rótulo para "Executando…" quando ele retorna.
  await expect(page.getByRole('button', { name: /Executando/ })).toHaveCount(0);
}

test('vindo direto de um exercício, o painel já conta a última execução', async ({ page }) => {
  await duasSessoes(page);
  await page.goto('/#/metricas');

  // Sem a releitura ao montar, a sessão da pilha aparecia com o retrato de
  // antes da execução, e a contagem saía 0.
  await expect(page.getByRole('heading', { name: 'Sessões (2 de 2 · 1 válidas)' })).toBeVisible();
});

test('o filtro de válidas recorta a tabela sem apagar nada', async ({ page }) => {
  await duasSessoes(page);
  await page.goto('/#/metricas');

  await page.getByLabel(/Só sessões válidas/).check();
  await expect(page.getByRole('heading', { name: 'Sessões (1 de 2 · 1 válidas)' })).toBeVisible();

  // Os critérios se somam: a única válida não é do vetor.
  await page.getByLabel('Exercício').selectOption('vetor-dobrar');
  await expect(page.getByText('Nenhuma sessão atende ao filtro.')).toBeVisible();

  // Tirar os filtros traz tudo de volta: o recorte não apagou o dado bruto.
  await page.getByLabel('Exercício').selectOption('');
  await page.getByLabel(/Só sessões válidas/).uncheck();
  await expect(page.getByRole('heading', { name: 'Sessões (2 de 2 · 1 válidas)' })).toBeVisible();
});

test('a exportação leva só o recorte, e diz qual foi', async ({ page }) => {
  await duasSessoes(page);
  await page.goto('/#/metricas');
  await page.getByLabel(/Só sessões válidas/).check();

  const baixando = page.waitForEvent('download');
  await page.getByRole('button', { name: /Exportar o que está na tela/ }).click();
  const arquivo = await baixando;
  const conteudo = JSON.parse(readFileSync(await arquivo.path(), 'utf8'));

  expect(arquivo.suggestedFilename()).toBe('metricas-aparelho.json');
  expect(conteudo.sessoes.map((s: { exercicioId: string }) => s.exercicioId)).toEqual([
    'pilha-reverter',
  ]);
  expect(conteudo.recorte).toEqual({
    origem: 'aparelho',
    filtro: { participanteId: null, exercicioId: null, andaime: null, apenasValidas: true },
    totalNaOrigem: 2,
  });
});

test('a sessão com padrão de varredura sai sinalizada, e continua na tabela', async ({ page }) => {
  // Cinco linhas vizinhas, uma depois da outra, sem executar nada no meio. O
  // relógio é do teste: o intervalo de D25 é pulado, e não esperado.
  await page.clock.install();
  await page.goto('/#/exercicio/pilha-desempilhar?andaime=com-apoio');
  const numeros = page.locator('.cm-lineNumbers .cm-gutterElement');
  const apontadas = page.locator('.apontadas li');
  for (let linha = 3; linha <= 7; linha++) {
    await numeros.nth(linha).click();
    await expect(apontadas).toHaveCount(linha - 2);
    await page.clock.fastForward(INTERVALO_ENTRE_LOCALIZACOES_MS);
  }

  await page.goto('/#/metricas');
  const sinal = page.locator('.sinal');
  await expect(sinal).toHaveText('varredura');
  await expect(sinal).toHaveAttribute('title', /^5 tentativas seguidas, da linha 3 à 7/);
  // Sinalizar não é filtrar nem apagar: a sessão continua contada.
  await expect(page.getByRole('heading', { name: 'Sessões (1 de 1 · 0 válidas)' })).toBeVisible();
});

test('a sessão sem padrão de varredura não sai sinalizada', async ({ page }) => {
  await duasSessoes(page);
  await page.goto('/#/metricas');
  await expect(page.getByRole('heading', { name: 'Sessões (2 de 2 · 1 válidas)' })).toBeVisible();
  await expect(page.locator('.sinal')).toHaveCount(0);
});

test('a aba esquecida sai sinalizada como ociosa, com a duração ativa ao lado da total', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/#/exercicio/pilha-reverter?andaime=com-apoio');
  await page.getByRole('button', { name: 'Executar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Executando/ })).toHaveCount(0);
  // Seis minutos sem ninguém na frente da tela.
  await page.clock.fastForward(6 * 60_000);

  await page.goto('/#/metricas');
  const cabecalho = await page.locator('.tabela-metricas th').allInnerTexts();
  const coluna = (nome: string) => cabecalho.indexOf(nome);
  const celulas = page.locator('.tabela-metricas tbody tr').first().locator('td');

  await expect(celulas.nth(coluna('Sinais'))).toHaveText('ociosa');
  // A total continua a do registro, intocada; a ativa deixa o silêncio de fora.
  await expect(celulas.nth(coluna('Duração'))).toHaveText(/^6 min 0\d s$/);
  await expect(celulas.nth(coluna('Ativa'))).toHaveText(/^\d+ s$/);
});
