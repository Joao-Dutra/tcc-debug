import { expect, test } from '@playwright/test';
import { listaInserirPosicao } from '../src/exercicios/lista-inserir-posicao';
import { vetorDobrar } from '../src/exercicios/vetor-dobrar';
import { INTERVALO_ENTRE_LOCALIZACOES_MS } from '../src/nucleo/metricas';

/** O fluxo dentro da tela de exercício (D20). */

/** Corrige o código no editor e executa, até todos os casos passarem. */
async function corrigirEExecutar(page: import('@playwright/test').Page, codigo: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(codigo);
  await page.getByRole('button', { name: /Executar/ }).click();
  await expect(page.locator('.painel.acertou')).toBeVisible();
}

test.describe('continuar sem voltar ao catálogo', () => {
  test('o convite leva ao próximo exercício com o mesmo apoio', async ({ page }) => {
    // Sem apoio de propósito: é o nível que o convite precisa carregar adiante.
    await page.goto('/#/exercicio/vetor-dobrar?andaime=sem-apoio');
    await corrigirEExecutar(page, vetorDobrar.codigoCorreto);

    await page.getByRole('link', { name: /próximo exercício/i }).click();

    await expect(page).toHaveURL(/#\/exercicio\/pilha-desempilhar\?andaime=sem-apoio$/);
    // Sessão nova (D8): o exercício recomeça do código com defeito, e não do
    // que ficou no editor anterior.
    await expect(page.locator('.cm-content')).toContainText('function empilhar');
    await expect(page.locator('.nivel.ativo')).toHaveText('sem apoio');
    await expect(page.locator('.painel.acertou')).toHaveCount(0);
  });

  test('o convite não informa posição nem quantidade', async ({ page }) => {
    await page.goto('/#/exercicio/vetor-dobrar?andaime=com-apoio');
    await corrigirEExecutar(page, vetorDobrar.codigoCorreto);

    const convite = page.getByRole('link', { name: /próximo exercício/i });
    // Nada de "2 de 9", "faltam 7" ou contagem de resolvidos: progresso
    // continua fora da interface do estudante.
    expect(await convite.innerText()).not.toMatch(/\d/);
  });

  test('o último exercício também convida, dando a volta', async ({ page }) => {
    // A ausência do convite no fim da lista contaria ao estudante onde ele
    // está na sequência, que é o mesmo que mostrar progresso. Por isso o
    // último volta ao primeiro do catálogo.
    await page.goto('/#/exercicio/lista-inserir-posicao?andaime=com-apoio');
    await corrigirEExecutar(page, listaInserirPosicao.codigoCorreto);

    await page.getByRole('link', { name: /próximo exercício/i }).click();
    await expect(page).toHaveURL(/#\/exercicio\/vetor-zerar-negativos\?andaime=com-apoio$/);
  });
});

test('as linhas apontadas aparecem da mais recente para a mais antiga', async ({ page }) => {
  // Relógio controlado pelo teste: entre duas tentativas há o intervalo de
  // D25, e ele é pulado em vez de esperado.
  await page.clock.install();
  await page.goto('/#/exercicio/pilha-desempilhar?andaime=com-apoio');

  const numeros = page.locator('.cm-lineNumbers .cm-gutterElement');
  const apontadas = page.locator('.apontadas li');
  // O gutter tem um elemento de medida antes da primeira linha, então a
  // linha N é o elemento N.
  await numeros.nth(3).click();
  await expect(apontadas).toHaveCount(1);
  await page.clock.fastForward(INTERVALO_ENTRE_LOCALIZACOES_MS);
  await numeros.nth(7).click();

  await expect(apontadas).toHaveCount(2);
  await expect(apontadas.first()).toContainText('Linha 7');
  await expect(apontadas.last()).toContainText('Linha 3');
});

test.describe('intervalo entre tentativas de localização (D25)', () => {
  // Nos dois níveis: o intervalo não é apoio, e é o mesmo com e sem ele.
  for (const nivel of ['com-apoio', 'sem-apoio']) {
    test(`o clique durante o intervalo não é julgado, ${nivel}`, async ({ page }) => {
      await page.clock.install();
      await page.goto(`/#/exercicio/pilha-desempilhar?andaime=${nivel}`);

      const numeros = page.locator('.cm-lineNumbers .cm-gutterElement');
      const apontadas = page.locator('.apontadas li');
      const aviso = page.locator('.intervalo-apontar');

      await numeros.nth(3).click();
      await expect(apontadas).toHaveCount(1);
      await expect(aviso).toHaveText('aguarde um instante para apontar outra linha');
      await expect(page.locator('.moldura-editor')).toHaveClass(/em-intervalo/);
      // Espera, e não cronômetro: o aviso não tem número nenhum.
      expect(await aviso.innerText()).not.toMatch(/\d/);

      // Dentro do intervalo, o clique não vira tentativa.
      await page.clock.fastForward(INTERVALO_ENTRE_LOCALIZACOES_MS - 1000);
      await numeros.nth(5).click();
      await expect(aviso).not.toBeEmpty();

      // Passado o intervalo, o aviso some e a tentativa seguinte é julgada.
      await page.clock.fastForward(1000);
      await expect(aviso).toBeEmpty();
      await expect(page.locator('.moldura-editor')).not.toHaveClass(/em-intervalo/);
      await numeros.nth(7).click();
      // Exatamente as duas julgadas. Se o clique na linha 5 tivesse sido
      // julgado, ele estaria aqui — e o da linha 7 teria caído no intervalo.
      await expect(apontadas).toHaveText([/Linha 7/, /Linha 3/]);
    });
  }

  test('o clique durante o intervalo fica no registro da sessão', async ({ page }) => {
    await page.clock.install();
    await page.goto('/#/exercicio/pilha-desempilhar?andaime=com-apoio');
    const numeros = page.locator('.cm-lineNumbers .cm-gutterElement');
    await numeros.nth(3).click();
    await expect(page.locator('.apontadas li')).toHaveCount(1);
    await numeros.nth(5).click();

    await page.goto('/#/metricas');
    await page.getByRole('button', { name: 'eventos' }).click();
    await expect(page.getByText('localização · linha 3 · incorreta')).toBeVisible();
    await expect(
      page.getByText('clique na linha 5 durante o intervalo · sem veredito')
    ).toBeVisible();
  });
});
