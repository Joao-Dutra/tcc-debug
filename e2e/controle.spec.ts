import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { catalogo } from '../src/exercicios/catalogo';
import { vetorDobrar } from '../src/exercicios/vetor-dobrar';
import { COLUNAS_DO_CSV } from '../src/estudo/exportacao';
import { criarSessao } from '../src/nucleo/metricas';
import type { MarcaDoEstudo } from '../src/nucleo/metricas';

/**
 * O painel de controle do pesquisador (D38), no projeto `banco-falso`: a lista
 * das aplicações, a criação, a limpeza com o CSV antes e o código digitado, o
 * freio com o título digitado, o mapa de rotas e a auditoria.
 *
 * Aqui se cobra o que a tela faz e o que ela pede ao banco. Que cada função
 * recusa quem não é pesquisador, que a protegida não se limpa e que a
 * auditoria só cresce, quem cobra é `npm run verificar-rls`, contra o banco de
 * verdade: uma tela adulterada esbarra lá, e não aqui.
 */

const BANCO = 'http://supabase-falso.invalid';
const CHAVE_DA_SESSAO = 'sb-supabase-falso-auth-token';
const PESQUISADOR = '0c0c0c0c-0000-4000-8000-00000000000c';
const OUTRA_CONTA = '0d0d0d0d-0000-4000-8000-00000000000d';
const ANA = '0a0a0a0a-0000-4000-8000-0000000000a1';
const ID_PUBLICADO = '33333333-3333-4333-8333-333333333333';

function linhaDeSessao(participanteId: string, exercicioId: string, estudo: MarcaDoEstudo) {
  const s = criarSessao({ exercicioId, andaime: 'com-apoio', participanteId, linhaDoDefeito: 3, estudo });
  s.registrarEncerramento('tempo-esgotado');
  const r = s.registro();
  const { aplicacao, ...marca } = estudo;
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
    estudo: marca,
  };
}

const aplicacao = (codigo: string, mudanca: Record<string, unknown>) => ({
  codigo,
  aberta: true,
  protegida: false,
  entradas: 0,
  criada_em: '2026-10-27T10:00:00Z',
  participantes_a: 0,
  participantes_b: 0,
  sessoes: 0,
  respostas: 0,
  ...mudanca,
});

interface Banco {
  papel: 'pesquisador' | 'professor';
  /** Os pedidos às funções do painel, na ordem. */
  chamadas: { funcao: string; corpo: unknown }[];
  /** O que cada função responde; sem resposta, `{ ok: true }`. */
  respostas: Record<string, unknown>;
}

async function entrarComo(page: Page, usuarioId: string) {
  const agora = Math.floor(Date.now() / 1000);
  const sessao = {
    access_token: 'token-de-mentira',
    refresh_token: 'renovacao-de-mentira',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: agora + 3600,
    user: {
      id: usuarioId,
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
    ([chave, valor]) => {
      window.localStorage.setItem(chave, valor);
      // A área de transferência do navegador pede permissão; o teste guarda o
      // que seria copiado, que é o que importa conferir.
      const copiados: string[] = [];
      (window as unknown as { copiados: string[] }).copiados = copiados;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (texto: string) => void copiados.push(texto) },
      });
    },
    [CHAVE_DA_SESSAO, JSON.stringify(sessao)] as const
  );
}

function novoBanco(papel: Banco['papel'] = 'pesquisador'): Banco {
  return { papel, chamadas: [], respostas: {} };
}

async function bancoFalso(page: Page, banco: Banco) {
  const tabelas: Record<string, unknown[]> = {
    sessoes: [
      linhaDeSessao(ANA, 'vetor-zerar-negativos', { aplicacao: 'piloto-nov', etapa: 0, aquecimento: true }),
      linhaDeSessao(ANA, 'pilha-desempilhar', { aplicacao: 'aeds1-2026', etapa: 1, aquecimento: false }),
    ],
    aplicacoes_do_estudo: [{ codigo: 'aeds1-2026' }, { codigo: 'piloto-nov' }, { codigo: 'treino-1' }],
    participantes_do_estudo: [
      { participante_id: ANA, aplicacao: 'piloto-nov', grupo: 'A', ordem_de_entrada: 1, aeds1: 'cursando', depurador: 'nunca', usou_visualizacao: 'nao' },
    ],
    respostas_do_questionario: [],
    coleta: [{ propostos_ocultos: true, alterado_em: '2026-10-02T09:00:00Z' }],
    exercicios_de_professor: [
      {
        id: ID_PUBLICADO,
        autor_id: OUTRA_CONTA,
        situacao: 'publicado',
        conteudo: {
          titulo: 'Vetor de outra pessoa',
          enunciado: vetorDobrar.enunciado,
          estrutura: vetorDobrar.estrutura,
          dificuldade: vetorDobrar.dificuldade,
          categoriaDefeito: vetorDobrar.categoriaDefeito,
          // Pela tabela, o pesquisador lê o conteúdo inteiro, com o correto.
          codigoCorreto: vetorDobrar.codigoCorreto,
          codigoComDefeito: vetorDobrar.codigoComDefeito,
          casosDeTeste: vetorDobrar.casosDeTeste,
          dicas: vetorDobrar.dicas,
          marcadores: vetorDobrar.marcadores ?? [],
          variaveisDeValor: [],
          linhaDoDefeito: vetorDobrar.linhaDoDefeito,
          linhasAceitas: [vetorDobrar.linhaDoDefeito],
        },
        comentario_da_revisao: null,
        criado_em: '2026-10-01T10:00:00Z',
        atualizado_em: '2026-10-02T10:00:00Z',
        publicado_em: '2026-10-02T10:00:00Z',
        retirado_em: null,
        retirado_por: null,
      },
    ],
    auditoria_do_pesquisador: [
      {
        id: 2,
        em: '2026-10-27T11:00:00Z',
        quem: OUTRA_CONTA,
        acao: 'limpar-aplicacao',
        alvo: 'aeds1-2026',
        resultado: 'recusada',
        detalhe: { motivo: 'aplicacao-protegida' },
      },
      {
        id: 1,
        em: '2026-10-27T10:00:00Z',
        quem: PESQUISADOR,
        acao: 'criar-aplicacao',
        alvo: 'treino-1',
        resultado: 'ok',
        detalhe: { protegida: false },
      },
    ],
  };
  await page.route(`${BANCO}/**`, async (rota) => {
    const pedido = rota.request();
    const url = new URL(pedido.url());
    if (url.pathname === '/auth/v1/user') return rota.fulfill({ status: 200, json: { id: PESQUISADOR } });
    const caminho = url.pathname.replace('/rest/v1/', '');
    if (caminho === 'perfis') return rota.fulfill({ status: 200, json: { papel: banco.papel } });
    if (caminho === 'rpc/listar_aplicacoes') {
      return rota.fulfill({
        status: 200,
        json: [
          aplicacao('treino-1', { aberta: true }),
          aplicacao('piloto-nov', {
            aberta: false,
            entradas: 2,
            participantes_a: 1,
            participantes_b: 1,
            sessoes: 2,
            respostas: 1,
          }),
          aplicacao('aeds1-2026', { protegida: true, entradas: 30, participantes_a: 15, participantes_b: 15 }),
        ],
      });
    }
    if (caminho.startsWith('rpc/')) {
      const funcao = caminho.slice('rpc/'.length);
      banco.chamadas.push({ funcao, corpo: pedido.postDataJSON() });
      return rota.fulfill({ status: 200, json: banco.respostas[funcao] ?? { ok: true } });
    }
    if (pedido.method() !== 'GET' && pedido.method() !== 'HEAD') {
      return rota.fulfill({ status: 400, json: { message: 'o painel não escreve em tabela' } });
    }
    const linhas = tabelas[caminho];
    if (!linhas) return rota.fulfill({ status: 400, json: { message: 'banco de mentira' } });
    // Paginado até a página vazia (D22).
    const primeira = Number(url.searchParams.get('offset') ?? '0') === 0;
    const situacao = url.searchParams.get('situacao')?.replace(/^eq\./, '');
    const filtradas = situacao ? linhas.filter((l) => (l as { situacao?: string }).situacao === situacao) : linhas;
    return rota.fulfill({ status: 200, json: primeira ? filtradas : [] });
  });
}

const linhaDa = (page: Page, codigo: string) =>
  page.locator('.tabela-das-aplicacoes tbody tr', { has: page.getByText(codigo, { exact: true }) });

test('sem o papel de pesquisador, o painel não mostra seção nenhuma', async ({ page }) => {
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, novoBanco('professor'));
  await page.goto('/#/controle');
  await expect(page.getByText('Esta conta não tem o papel de pesquisador')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aplicações do estudo' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Auditoria' })).toHaveCount(0);
});

test('o painel de métricas leva ao de controle', async ({ page }) => {
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, novoBanco());
  await page.goto('/#/metricas');
  await page.getByRole('link', { name: 'Painel de controle' }).click();
  await expect(page).toHaveURL(/#\/controle$/);
  await expect(page.getByRole('heading', { name: 'Painel de controle' })).toBeVisible();
});

test('as aplicações aparecem com os grupos, e a protegida não tem como ser limpa', async ({ page }) => {
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, novoBanco());
  await page.goto('/#/controle');
  const protegida = linhaDa(page, 'aeds1-2026');
  await expect(protegida).toContainText('protegida');
  await expect(protegida.locator('td').nth(4)).toHaveText('15');
  await expect(protegida.locator('td').nth(5)).toHaveText('15');
  await expect(protegida.getByRole('button', { name: 'Limpar' })).toHaveCount(0);
  await expect(protegida.getByRole('button', { name: 'Proteger' })).toHaveCount(0);
  await expect(linhaDa(page, 'piloto-nov')).toContainText('de teste');
  await expect(linhaDa(page, 'piloto-nov').getByRole('button', { name: 'Limpar' })).toBeVisible();
});

test('criar confere o código antes de enviar, e sem marcar teste ela vai protegida', async ({ page }) => {
  const banco = novoBanco();
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, banco);
  await page.goto('/#/controle');
  const criar = page.getByRole('button', { name: 'Criar', exact: true });
  await page.getByLabel('Código', { exact: true }).fill('AEDS 2027');
  await expect(page.getByText(/Só letras minúsculas sem acento/)).toBeVisible();
  await expect(criar).toBeDisabled();

  await page.getByLabel('Código', { exact: true }).fill('aeds1-2027');
  await criar.click();
  await expect(page.getByText('aeds1-2027 criada, protegida e aberta.')).toBeVisible();

  await page.getByLabel('Código', { exact: true }).fill('treino-2');
  await page.getByLabel(/Aplicação de teste/).check();
  await criar.click();
  await expect(page.getByText('treino-2 criada, de teste e aberta.')).toBeVisible();

  expect(banco.chamadas.filter((c) => c.funcao === 'criar_aplicacao')).toEqual([
    { funcao: 'criar_aplicacao', corpo: { p_codigo: 'aeds1-2027', p_teste: false } },
    { funcao: 'criar_aplicacao', corpo: { p_codigo: 'treino-2', p_teste: true } },
  ]);
});

test('a recusa do banco aparece com o motivo, e não como feito', async ({ page }) => {
  const banco = novoBanco();
  banco.respostas.criar_aplicacao = { ok: false, motivo: 'codigo-existente' };
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, banco);
  await page.goto('/#/controle');
  await page.getByLabel('Código', { exact: true }).fill('treino-1');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByText('Já existe uma aplicação com este código.')).toBeVisible();
  await expect(page.getByText(/criada/)).toHaveCount(0);
});

test('abrir e fechar vão pela função, e proteger pede confirmação', async ({ page }) => {
  const banco = novoBanco();
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, banco);
  await page.goto('/#/controle');
  await linhaDa(page, 'treino-1').getByRole('button', { name: 'Fechar' }).click();
  await expect.poll(() => banco.chamadas).toContainEqual({
    funcao: 'definir_aplicacao_aberta',
    corpo: { p_codigo: 'treino-1', p_aberta: false },
  });

  // Recusar a confirmação não manda nada.
  page.once('dialog', (d) => void d.dismiss());
  await linhaDa(page, 'treino-1').getByRole('button', { name: 'Proteger' }).click();
  page.once('dialog', (d) => {
    expect(d.message()).toContain('não se desfaz');
    void d.accept();
  });
  await linhaDa(page, 'treino-1').getByRole('button', { name: 'Proteger' }).click();
  await expect.poll(() => banco.chamadas.filter((c) => c.funcao === 'proteger_aplicacao')).toEqual([
    { funcao: 'proteger_aplicacao', corpo: { p_codigo: 'treino-1' } },
  ]);
});

test('limpar: o CSV antes, o botão só com o código digitado, e a aberta não limpa', async ({ page }) => {
  const banco = novoBanco();
  banco.respostas.limpar_aplicacao = { ok: true, respostas: 1, sessoes: 2, participantes: 2, entradas_antes: 2 };
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, banco);
  await page.goto('/#/controle');

  // A aberta: o painel diz que precisa fechar, e o botão não libera.
  await linhaDa(page, 'treino-1').getByRole('button', { name: 'Limpar' }).click();
  const limpeza = page.locator('.painel-da-limpeza');
  await expect(limpeza).toContainText('Feche a aplicação antes de limpar.');
  await limpeza.getByLabel(/Para confirmar/).fill('treino-1');
  await expect(limpeza.getByRole('button', { name: 'Limpar definitivamente' })).toBeDisabled();
  await limpeza.getByRole('button', { name: 'Cancelar' }).click();

  // A fechada.
  await linhaDa(page, 'piloto-nov').getByRole('button', { name: 'Limpar' }).click();
  await expect(limpeza).toContainText('Apaga 1 resposta(s), 2 sessão(ões) e 2 participante(s)');
  const baixando = page.waitForEvent('download');
  await limpeza.getByRole('button', { name: 'Exportar CSV desta aplicação' }).click();
  const baixado = await baixando;
  expect(baixado.suggestedFilename()).toBe('estudo-piloto-nov.csv');
  const [cabecalho, ...linhas] = readFileSync(await baixado.path(), 'utf8')
    .split('\r\n')
    .filter((l) => l !== '');
  expect(cabecalho).toBe(COLUNAS_DO_CSV.join(','));
  // Só a sessão desta aplicação, e não a da outra.
  expect(linhas).toHaveLength(1);
  expect(linhas[0].startsWith('piloto-nov,')).toBe(true);
  await expect(limpeza.getByText('Exportado.')).toBeVisible();

  const definitivo = limpeza.getByRole('button', { name: 'Limpar definitivamente' });
  await expect(definitivo).toBeDisabled();
  for (const quase of ['piloto', 'piloto-nov ', 'Piloto-nov']) {
    await limpeza.getByLabel(/Para confirmar/).fill(quase);
    await expect(definitivo, quase).toBeDisabled();
  }
  await limpeza.getByLabel(/Para confirmar/).fill('piloto-nov');
  await definitivo.click();
  await expect(limpeza.getByRole('status')).toContainText(
    '1 resposta(s), 2 sessão(ões) e 2 participante(s) apagados'
  );
  expect(banco.chamadas.filter((c) => c.funcao === 'limpar_aplicacao')).toEqual([
    { funcao: 'limpar_aplicacao', corpo: { p_codigo: 'piloto-nov', p_confirmacao: 'piloto-nov' } },
  ]);
});

test('o freio pede o título digitado, e vai pela função', async ({ page }) => {
  const banco = novoBanco();
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, banco);
  await page.goto('/#/controle');
  const item = page.locator('.lista-de-exercicios li', { hasText: 'Vetor de outra pessoa' });
  await item.getByRole('button', { name: 'Retirar', exact: true }).click();
  const definitivo = item.getByRole('button', { name: 'Retirar definitivamente' });
  await expect(definitivo).toBeDisabled();
  await item.getByLabel('Confirmação').fill('Vetor de outra pessoa');
  await definitivo.click();
  await expect.poll(() => banco.chamadas).toContainEqual({
    funcao: 'retirar_publicado',
    corpo: { p_id: ID_PUBLICADO },
  });
  // O interruptor está na mesma tela, com o estado atual.
  await expect(page.getByText('A seção “Propostos por professores” está oculta aos alunos.')).toBeVisible();
});

test('o mapa de rotas tem cada exercício nos dois apoios e as rotas de cada aplicação, para copiar', async ({
  page,
}) => {
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, novoBanco());
  await page.goto('/#/controle');
  const mapa = page.locator('section', { has: page.getByRole('heading', { name: 'Mapa de rotas' }) });
  for (const nivel of ['com-apoio', 'sem-apoio']) {
    await expect(mapa.locator(`a[href="#/exercicio/${catalogo[0].id}?andaime=${nivel}"]`)).toHaveCount(1);
  }
  await expect(mapa.locator('a[href^="#/exercicio/"]')).toHaveCount(catalogo.length * 2);
  await expect(mapa.locator('a[href="#/estudo/aeds1-2026"]')).toHaveCount(1);
  await expect(mapa.locator('a[href="#/estudo/aeds1-2026/conferir"]')).toHaveCount(1);

  const origem = new URL(page.url()).origin;
  const percurso = `${origem}/#/estudo/aeds1-2026`;
  await mapa.getByRole('button', { name: `Copiar ${percurso}`, exact: true }).click();
  await expect(mapa.getByRole('button', { name: `Copiar ${percurso}`, exact: true })).toHaveText('Copiado');
  expect(await page.evaluate(() => (window as unknown as { copiados: string[] }).copiados)).toEqual([percurso]);
});

test('a auditoria mostra as ações, com o motivo da recusa em texto', async ({ page }) => {
  await entrarComo(page, PESQUISADOR);
  await bancoFalso(page, novoBanco());
  await page.goto('/#/controle');
  const auditoria = page.locator('section', { has: page.getByRole('heading', { name: 'Auditoria' }) });
  const linhas = auditoria.locator('tbody tr');
  await expect(linhas).toHaveCount(2);
  await expect(linhas.nth(0)).toContainText('limpar-aplicacao');
  await expect(linhas.nth(0)).toContainText('A aplicação é protegida: o painel nunca a limpa.');
  await expect(linhas.nth(1)).toContainText('esta conta');
});
