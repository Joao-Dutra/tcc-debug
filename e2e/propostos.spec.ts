import { expect, test } from '@playwright/test';
import { pilhaReverter } from '../src/exercicios/pilha-reverter';
import { vetorDobrar } from '../src/exercicios/vetor-dobrar';
import type { Exercicio } from '../src/nucleo/tipos';

/**
 * Os exercícios propostos por professores, na tela do aluno (D31).
 *
 * Roda no projeto `banco-falso`: o servidor aponta para um endereço que não
 * existe (`.invalid`), e cada pedido a ele é respondido aqui. É o que deixa
 * testar o caminho com banco sem tocar no banco do estudo (D22) — nada sai da
 * máquina.
 */

const BANCO = 'http://supabase-falso.invalid';
const ID_VETOR = '11111111-1111-4111-8111-111111111111';
const ID_PILHA = '22222222-2222-4222-8222-222222222222';

/** Uma linha da visão dos publicados: o conteúdo sem o código correto. */
function publicado(id: string, e: Exercicio, titulo: string) {
  return {
    id,
    publicado_em: '2026-09-22T09:00:00Z',
    conteudo: {
      titulo,
      enunciado: e.enunciado,
      estrutura: e.estrutura,
      dificuldade: e.dificuldade,
      categoriaDefeito: e.categoriaDefeito,
      codigoComDefeito: e.codigoComDefeito,
      casosDeTeste: e.casosDeTeste,
      dicas: e.dicas,
      marcadores: e.estrutura === 'vetor' ? ['i'] : [],
      variaveisDeValor: [],
      linhaDoDefeito: e.linhaDoDefeito,
      linhasAceitas: [e.linhaDoDefeito],
    },
  };
}

const PUBLICADOS = [
  publicado(ID_VETOR, vetorDobrar, 'Proposto: os dobros'),
  publicado(ID_PILHA, pilhaReverter, 'Proposto: a pilha revertida'),
];

/** Responde pelo banco. A entrada anônima falha, e a tela do aluno não depende dela. */
async function bancoFalso(page: import('@playwright/test').Page, leituraFalha = false) {
  await page.route(`${BANCO}/**`, async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname === '/rest/v1/exercicios_publicados') {
      if (leituraFalha) return rota.fulfill({ status: 500, json: { message: 'fora do ar' } });
      // Paginado até a página vazia (D22).
      const inicio = Number(url.searchParams.get('offset') ?? '0');
      return rota.fulfill({ status: 200, json: inicio === 0 ? PUBLICADOS : [] });
    }
    return rota.fulfill({ status: 400, json: { message: 'banco de mentira' } });
  });
}

test('a vitrine mostra os propostos numa seção à parte, que o filtro também recorta', async ({ page }) => {
  await bancoFalso(page);
  await page.goto('/#/exercicios');
  const secao = page.getByRole('region', { name: 'Propostos por professores' });
  await expect(secao.getByRole('heading', { name: 'Proposto: os dobros' })).toBeVisible();
  await expect(secao.locator('.cartao')).toHaveCount(2);

  await page.getByRole('button', { name: 'Pilha' }).click();
  await expect(secao.locator('.cartao')).toHaveCount(1);
  await expect(secao.getByRole('heading', { name: 'Proposto: a pilha revertida' })).toBeVisible();
});

test('o proposto abre pelo identificador, e a sessão grava a origem', async ({ page }) => {
  await bancoFalso(page);
  await page.goto(`/#/exercicio/${ID_PILHA}?andaime=com-apoio`);
  await expect(page.getByRole('heading', { name: 'Proposto: a pilha revertida', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Executar' }).click();
  await expect(page.getByText('esperado [30,20,10]')).toBeVisible();

  // Sair do exercício arquiva a sessão no aparelho.
  await page.goto('/#/exercicios');
  const arquivadas = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('depurar:sessoes-arquivadas') ?? '[]')
  );
  expect(arquivadas).toEqual([
    expect.objectContaining({ exercicioId: ID_PILHA, origemDoExercicio: 'professor' }),
  ]);
});

test('um identificador que não é de nenhum publicado não abre nada', async ({ page }) => {
  await bancoFalso(page);
  await page.goto('/#/exercicio/33333333-3333-4333-8333-333333333333');
  await expect(page.getByRole('heading', { name: 'Exercício não encontrado' })).toBeVisible();
});

test('com a leitura falhando, a vitrine se cala e a abertura explica', async ({ page }) => {
  await bancoFalso(page, true);
  await page.goto('/#/exercicios');
  await expect(page.getByRole('heading', { name: 'Vetor', level: 2 })).toBeVisible();
  await expect(page.getByText('Propostos por professores')).toHaveCount(0);

  await page.goto(`/#/exercicio/${ID_VETOR}`);
  await expect(page.getByRole('heading', { name: 'O exercício não abriu' })).toBeVisible();
});
