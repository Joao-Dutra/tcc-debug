import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { COLUNAS_DO_CSV } from '../src/estudo/exportacao';
import { ITENS_DAS_ESCALAS } from '../src/estudo/questionario';
import { criarSessao } from '../src/nucleo/metricas';
import type { MarcaDoEstudo } from '../src/nucleo/metricas';

/**
 * O painel do pesquisador sobre o estudo (D37), no projeto `banco-falso`: o
 * filtro por aplicação, com a lista lida do banco, e o CSV do estudo, que
 * junta as sessões aos participantes e às respostas.
 *
 * Quem cobra que só o pesquisador lê essas tabelas é `npm run verificar-rls`;
 * aqui se cobra o que o painel faz com o que leu.
 */

const BANCO = 'http://supabase-falso.invalid';
const CHAVE_DA_SESSAO = 'sb-supabase-falso-auth-token';
const PESQUISADOR = '0c0c0c0c-0000-4000-8000-00000000000c';
const ANA = '0a0a0a0a-0000-4000-8000-0000000000a1';
const BIA = '0b0b0b0b-0000-4000-8000-0000000000b2';

/** Uma sessão do banco, como o select do painel a recebe. */
function linhaDeSessao(participanteId: string, exercicioId: string, andaime: string, estudo?: MarcaDoEstudo) {
  const s = criarSessao({ exercicioId, andaime, participanteId, linhaDoDefeito: 3, estudo });
  s.registrarEncerramento('tempo-esgotado');
  const r = s.registro();
  const { aplicacao = null, ...marca } = estudo ?? {};
  return {
    id: r.id,
    participante_id: participanteId,
    versao: r.versao,
    exercicio_id: r.exercicioId,
    origem_do_exercicio: 'catalogo',
    andaime: r.andaime,
    instante_de_inicio: r.instanteDeInicio,
    duracao_total_ms: r.duracaoTotalMs,
    eventos: r.eventos,
    resumo: r.resumo,
    aplicacao,
    estudo: estudo ? marca : null,
  };
}

const marca = (etapa: number): MarcaDoEstudo => ({ aplicacao: 'piloto-nov', etapa, aquecimento: etapa === 0 });

interface Banco {
  /** A leitura das respostas falha, como num projeto sem a migração 0004. */
  respostasFalham: boolean;
}

async function entrarComoPesquisador(page: Page) {
  const agora = Math.floor(Date.now() / 1000);
  const sessao = {
    access_token: 'token-de-mentira',
    refresh_token: 'renovacao-de-mentira',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: agora + 3600,
    user: {
      id: PESQUISADOR,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'pesquisa@example.com',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      is_anonymous: false,
      created_at: '2026-10-01T10:00:00Z',
    },
  };
  await page.addInitScript(
    ([chave, valor]) => window.localStorage.setItem(chave, valor),
    [CHAVE_DA_SESSAO, JSON.stringify(sessao)] as const
  );
}

async function bancoFalso(page: Page, banco: Banco) {
  const tabelas: Record<string, unknown[]> = {
    sessoes: [
      linhaDeSessao(BIA, 'pilha-desempilhar', 'com-apoio', marca(1)),
      linhaDeSessao(ANA, 'vetor-zerar-negativos', 'com-apoio', marca(0)),
      linhaDeSessao(ANA, 'pilha-desempilhar', 'com-apoio', marca(1)),
      linhaDeSessao(ANA, 'vetor-dobrar', 'sem-apoio'),
    ],
    aplicacoes_do_estudo: [{ codigo: 'aeds1-2026' }, { codigo: 'piloto-nov' }],
    participantes_do_estudo: [
      { participante_id: ANA, aplicacao: 'piloto-nov', grupo: 'A', ordem_de_entrada: 1, aeds1: 'cursando', depurador: 'nunca', usou_visualizacao: 'nao' },
      { participante_id: BIA, aplicacao: 'piloto-nov', grupo: 'B', ordem_de_entrada: 2, aeds1: 'ja-cursou', depurador: 'frequentemente', usou_visualizacao: 'sim' },
    ],
    respostas_do_questionario: [
      {
        participante_id: ANA,
        aplicacao: 'piloto-nov',
        versao_do_questionario: 1,
        // Concorda com tudo: os ímpares do SUS somam 20, e os pares, 0.
        escalas: Object.fromEntries(ITENS_DAS_ESCALAS.map((i) => [i.id, 5])),
        o_que_ajudou: 'ver a pilha, passo a passo',
        o_que_atrapalhou: null,
      },
    ],
  };
  await page.route(`${BANCO}/**`, async (rota) => {
    const pedido = rota.request();
    const url = new URL(pedido.url());
    if (url.pathname === '/auth/v1/user') return rota.fulfill({ status: 200, json: { id: PESQUISADOR } });
    const tabela = url.pathname.replace('/rest/v1/', '');
    if (tabela === 'perfis') return rota.fulfill({ status: 200, json: { papel: 'pesquisador' } });
    if (pedido.method() !== 'GET') return rota.fulfill({ status: 201, body: '' });
    if (tabela === 'respostas_do_questionario' && banco.respostasFalham) {
      return rota.fulfill({ status: 404, json: { message: 'relation "respostas_do_questionario" does not exist' } });
    }
    const linhas = tabelas[tabela];
    if (!linhas) return rota.fulfill({ status: 400, json: { message: 'banco de mentira' } });
    // Paginado até a página vazia (D22).
    const primeira = Number(url.searchParams.get('offset') ?? '0') === 0;
    return rota.fulfill({ status: 200, json: primeira ? linhas : [] });
  });
}

/** O CSV lido de volta, sem campo entre aspas nas colunas olhadas aqui. */
function lerCsv(texto: string): Record<string, string>[] {
  const [cabecalho, ...linhas] = texto.split('\r\n').filter((l) => l !== '');
  expect(cabecalho).toBe(COLUNAS_DO_CSV.join(','));
  return linhas.map((l) => {
    // As abertas são as últimas colunas, e a de Ana tem vírgula: entre aspas.
    const campos = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
    return Object.fromEntries(COLUNAS_DO_CSV.map((c, i) => [c, campos[i]]));
  });
}

test('o filtro por aplicação vem do banco, e o CSV junta participante, sessão e questionário', async ({ page }) => {
  await entrarComoPesquisador(page);
  await bancoFalso(page, { respostasFalham: false });
  await page.goto('/#/metricas');
  await expect(page.getByRole('heading', { name: 'Sessões (4 de 4 · 0 válidas)' })).toBeVisible();

  // A aplicação sem sessão nenhuma também aparece: a lista é a do banco.
  const opcoes = await page.getByLabel('Aplicação').locator('option').allTextContents();
  expect(opcoes).toEqual(['todas', 'aeds1-2026', 'piloto-nov']);
  await page.getByLabel('Aplicação').selectOption('piloto-nov');
  await expect(page.getByRole('heading', { name: 'Sessões (3 de 4 · 0 válidas)' })).toBeVisible();

  const baixando = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV do estudo' }).click();
  const baixado = await baixando;
  expect(baixado.suggestedFilename()).toBe('estudo-piloto-nov.csv');
  const linhas = lerCsv(readFileSync(await baixado.path(), 'utf8'));

  // Na ordem de entrada e de etapa; a sessão de fora do estudo não entra.
  expect(
    linhas.map((l) => [l.participante_id, l.grupo, l.etapa, l.apoio, l.apoio_confere_com_plano, l.desfecho])
  ).toEqual([
    [ANA, 'A', '0', 'com-apoio', 'true', 'tempo-esgotado'],
    [ANA, 'A', '1', 'com-apoio', 'true', 'tempo-esgotado'],
    // O plano manda a etapa 1 sem apoio para o grupo B.
    [BIA, 'B', '1', 'com-apoio', 'false', 'tempo-esgotado'],
  ]);
  expect(linhas[0]).toMatchObject({
    ordem_de_entrada: '1',
    perfil_aeds1: 'cursando',
    perfil_depurador: 'nunca',
    perfil_visualizacao: 'nao',
    versao_do_questionario: '1',
    sus_1: '5',
    sus_2: '5',
    sus_escore: '50',
    vis_6: '5',
    ajudou: 'ver a pilha, passo a passo',
    atrapalhou: '',
  });
  // O questionário se repete em cada sessão de quem respondeu, e Bia não respondeu.
  expect(linhas[1].sus_escore).toBe('50');
  expect(linhas[2]).toMatchObject({ perfil_aeds1: 'ja-cursou', versao_do_questionario: '', sus_escore: '' });
});

test('sem as respostas, o CSV fica indisponível em vez de sair com o questionário vazio', async ({ page }) => {
  await entrarComoPesquisador(page);
  await bancoFalso(page, { respostasFalham: true });
  await page.goto('/#/metricas');
  await expect(page.getByRole('heading', { name: 'Sessões (4 de 4 · 0 válidas)' })).toBeVisible();
  await expect(page.getByText(/A leitura do estudo falhou/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar CSV do estudo' })).toBeDisabled();
  // O resto do painel continua: a tabela e o JSON.
  await expect(page.getByRole('button', { name: /Exportar o que está na tela/ })).toBeEnabled();
});
