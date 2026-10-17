import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { VERSAO_DO_AVISO } from '../src/estudo/aviso';
import { responderQuestionario } from './questionario-do-estudo';

/**
 * A área do estudo com banco (D37), no projeto `banco-falso`: nada sai da
 * máquina, e cada pedido é respondido aqui.
 *
 * Cobra o que a tela faz com o banco: que a entrada troca a identidade por
 * uma anônima nova, que o grupo vem do banco e decide o apoio, que a versão do
 * aviso e o perfil vão na entrada, que as sessões sobem com a aplicação e a
 * marca, e que a resposta do questionário é gravada pelo participante, antes
 * da troca de identidade do fim. O que o banco aceita ou recusa quem cobra é `npm run verificar-rls`.
 */

const BANCO = 'http://supabase-falso.invalid';

interface Banco {
  situacao: 'aberta' | 'encerrada' | 'inexistente' | 'fora-do-ar';
  grupo: 'A' | 'B';
  /** As identidades anônimas criadas, na ordem. */
  anonimas: string[];
  /** As identidades que saíram, pelo token do pedido. */
  saidas: string[];
  entradas: unknown[];
  sessoes: { participante_id: string; aplicacao: string | null; estudo: unknown; exercicio_id: string }[];
  /** A rede da gravação das sessões caiu. */
  sessoesFalham: boolean;
  /** Os pedidos de gravação da resposta, com quem pediu e quem já tinha saído. */
  respostas: { corpo: unknown; quem: string; consulta: string; prefer: string; saidasAntes: string[] }[];
  /** Como o banco responde à gravação da resposta. */
  resposta: 'gravada' | 'ja-gravada' | 'fora-do-ar';
}

function novoBanco(mudanca: Partial<Banco> = {}): Banco {
  return {
    situacao: 'aberta',
    grupo: 'B',
    anonimas: [],
    saidas: [],
    entradas: [],
    sessoes: [],
    sessoesFalham: false,
    respostas: [],
    resposta: 'gravada',
    ...mudanca,
  };
}

/** A sessão que o supabase-js espera da entrada anônima. */
function sessaoAnonima(id: string) {
  return {
    access_token: `token-${id}`,
    refresh_token: `renovacao-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'anonymous', providers: [] },
      user_metadata: {},
      is_anonymous: true,
      created_at: '2026-11-01T10:00:00Z',
    },
  };
}

async function bancoFalso(page: Page, banco: Banco) {
  await page.route(`${BANCO}/**`, async (rota) => {
    const pedido: Request = rota.request();
    const caminho = new URL(pedido.url()).pathname;
    if (caminho === '/auth/v1/signup') {
      const id = `00000000-0000-4000-8000-${String(banco.anonimas.length + 1).padStart(12, '0')}`;
      banco.anonimas.push(id);
      return rota.fulfill({ status: 200, json: sessaoAnonima(id) });
    }
    if (caminho === '/auth/v1/logout') {
      banco.saidas.push((pedido.headers()['authorization'] ?? '').replace('Bearer token-', ''));
      return rota.fulfill({ status: 204 });
    }
    if (caminho === '/rest/v1/perfis') return rota.fulfill({ status: 200, json: { papel: 'participante' } });
    if (caminho === '/rest/v1/rpc/situacao_da_aplicacao') {
      if (banco.situacao === 'fora-do-ar') return rota.fulfill({ status: 503, json: { message: 'fora do ar' } });
      return rota.fulfill({ status: 200, json: banco.situacao });
    }
    if (caminho === '/rest/v1/rpc/entrar_no_estudo') {
      banco.entradas.push(pedido.postDataJSON());
      return rota.fulfill({ status: 200, json: [{ grupo: banco.grupo, ordem_de_entrada: 2 }] });
    }
    if (caminho === '/rest/v1/sessoes' && pedido.method() === 'POST') {
      if (banco.sessoesFalham) return rota.fulfill({ status: 503, json: { message: 'sem rede' } });
      banco.sessoes.push(...pedido.postDataJSON());
      return rota.fulfill({ status: 201, body: '' });
    }
    if (caminho === '/rest/v1/respostas_do_questionario' && pedido.method() === 'POST') {
      banco.respostas.push({
        corpo: pedido.postDataJSON(),
        quem: (pedido.headers()['authorization'] ?? '').replace('Bearer token-', ''),
        consulta: new URL(pedido.url()).search,
        prefer: pedido.headers()['prefer'] ?? '',
        saidasAntes: [...banco.saidas],
      });
      if (banco.resposta === 'fora-do-ar') return rota.fulfill({ status: 503, json: { message: 'sem rede' } });
      if (banco.resposta === 'ja-gravada') {
        return rota.fulfill({
          status: 409,
          json: { code: '23505', message: 'duplicate key value violates unique constraint' },
        });
      }
      return rota.fulfill({ status: 201, body: '' });
    }
    return rota.fulfill({ status: 400, json: { message: 'banco de mentira' } });
  });
}

test('a entrada troca de identidade, o grupo vem do banco, e as sessões sobem marcadas', async ({ page }) => {
  const banco = novoBanco({ grupo: 'B' });
  await bancoFalso(page, banco);
  await page.goto('/#/estudo/piloto-nov');

  // A identidade da abertura do aparelho.
  await expect.poll(() => banco.anonimas.length).toBe(1);
  await page.getByLabel('Concordo em participar').check();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('radio', { name: 'Já cursei' }).check();
  await page.getByRole('radio', { name: 'Frequentemente' }).check();
  await page.getByRole('radio', { name: 'Sim' }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Saiu da identidade do aparelho e entrou numa anônima nova.
  expect(banco.saidas).toEqual([banco.anonimas[0]]);
  expect(banco.anonimas).toHaveLength(2);
  const participante = banco.anonimas[1];
  expect(banco.entradas).toEqual([
    {
      p_aplicacao: 'piloto-nov',
      p_versao_do_aviso: VERSAO_DO_AVISO,
      p_aeds1: 'ja-cursou',
      p_depurador: 'frequentemente',
      p_usou_visualizacao: 'sim',
    },
  ]);

  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await expect(page.locator('.contador')).toContainText('passo 1 /');
  await page.getByRole('button', { name: 'Seguir para o próximo' }).click();
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();

  // Grupo B: o primeiro exercício da análise é sem apoio.
  await expect(page.locator('.posicao-no-percurso')).toHaveText('Exercício 1 de 5');
  await expect(page.locator('.contador')).toContainText('passo 1 /');
  await expect(page.getByRole('button', { name: 'Revelar dica 1' })).toHaveCount(0);

  await expect.poll(() => banco.sessoes.length).toBeGreaterThan(0);
  expect(banco.sessoes[0]).toMatchObject({
    participante_id: participante,
    exercicio_id: 'vetor-zerar-negativos',
    aplicacao: 'piloto-nov',
    // O grupo não vai na sessão: a fonte dele é o banco.
    estudo: { etapa: 0, aquecimento: true },
  });
});

/** Do aviso ao questionário, seguindo em cada etapa. Devolve a identidade do participante. */
async function chegarAoQuestionario(page: Page, banco: Banco): Promise<string> {
  await page.goto('/#/estudo/piloto-nov');
  await expect.poll(() => banco.anonimas.length).toBe(1);
  await page.getByLabel('Concordo em participar').check();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('radio', { name: 'Estou cursando' }).check();
  await page.getByRole('radio', { name: 'Nunca' }).check();
  await page.getByRole('radio', { name: 'Não', exact: true }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  for (let etapa = 0; etapa < 6; etapa++) {
    await expect(page.locator('.contador')).toContainText('passo 1 /');
    const ultimo = etapa === 5;
    await page.getByRole('button', { name: ultimo ? 'Concluir os exercícios' : 'Seguir para o próximo' }).click();
    await page.getByRole('button', { name: ultimo ? 'Concluir' : 'Seguir', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Para terminar' })).toBeVisible();
  return banco.anonimas[1];
}

/** Do aviso ao fim, com o questionário respondido. */
async function percorrerTudo(page: Page, banco: Banco): Promise<string> {
  const participante = await chegarAoQuestionario(page, banco);
  await responderQuestionario(page);
  await expect(page.getByRole('heading', { name: 'Obrigado pela participação' })).toBeVisible();
  return participante;
}

test('no fim, com as sessões no banco, o aparelho troca de identidade', async ({ page }) => {
  const banco = novoBanco();
  await bancoFalso(page, banco);
  const participante = await percorrerTudo(page, banco);

  // Saiu do participante, e a anônima seguinte é de quem vier depois.
  await expect.poll(() => banco.saidas).toEqual([banco.anonimas[0], participante]);
  // A anônima nova é pedida logo depois da saída, numa ida à rede própria.
  await expect.poll(() => banco.anonimas.length).toBe(3);
  const etapas = new Set(
    banco.sessoes
      .filter((l) => l.participante_id === participante)
      .map((l) => (l.estudo as { etapa: number }).etapa)
  );
  expect([...etapas].sort()).toEqual([0, 1, 2, 3, 4, 5]);
});

test('no fim, com sessão do participante sem subir, a tela chama o pesquisador e não troca', async ({ page }) => {
  const banco = novoBanco({ sessoesFalham: true });
  await bancoFalso(page, banco);
  const participante = await chegarAoQuestionario(page, banco);

  // A tela insiste sozinha antes de desistir, e só então chama o pesquisador:
  // a tentativa da chegada e mais uma por espera.
  const envios = await contarEnviosDeSessoes(page, async () => {
    await responderQuestionario(page);
    await expect(page.getByRole('heading', { name: 'Obrigado pela participação' })).toBeVisible();
    await expect(page.getByText('Não feche esta página ainda.')).toBeVisible();
    await expect(page.getByText('chame o pesquisador')).toBeVisible({ timeout: 15_000 });
  });
  expect(envios).toBe(3);
  await expect(page.getByText('Você já pode fechar esta página')).toHaveCount(0);
  await expect(page.getByText(/sessões deste participante estão só neste aparelho/)).toBeVisible();
  expect(banco.saidas).toEqual([banco.anonimas[0]]);
  expect(await page.evaluate(() => localStorage.getItem('sb-supabase-falso-auth-token'))).toContain(
    participante
  );

  // O pesquisador exporta o JSON do aparelho: as sessões do participante estão nele.
  const baixando = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON local' }).click();
  const baixado = await baixando;
  expect(baixado.suggestedFilename()).toBe('metricas-aparelho-piloto-nov.json');
  const exportado = JSON.parse(await streamParaTexto(await baixado.createReadStream()));
  const etapas = (exportado.sessoes as { participanteId: string; estudo: { etapa: number } }[])
    .filter((s) => s.participanteId === participante)
    .map((s) => s.estudo.etapa);
  expect(new Set(etapas)).toEqual(new Set([0, 1, 2, 3, 4, 5]));

  // A tentativa de novo, ainda sem rede, continua sem trocar.
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByText('chame o pesquisador')).toBeVisible();
  expect(banco.saidas).toEqual([banco.anonimas[0]]);

  // A rede volta: a fila esvazia, e só então o aparelho troca.
  banco.sessoesFalham = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByText('As suas respostas foram registradas. Você já pode fechar esta página.')).toBeVisible();
  await expect.poll(() => banco.saidas).toEqual([banco.anonimas[0], participante]);
  const subidas = new Set(banco.sessoes.filter((l) => l.participante_id === participante).map((l) => (l.estudo as { etapa: number }).etapa));
  expect(subidas).toEqual(new Set([0, 1, 2, 3, 4, 5]));
});

/** Quantos envios de sessões o navegador fez enquanto `durante` corria. */
async function contarEnviosDeSessoes(page: Page, durante: () => Promise<void>): Promise<number> {
  let n = 0;
  const contar = (pedido: Request) => {
    if (pedido.url().includes('/rest/v1/sessoes') && pedido.method() === 'POST') n++;
  };
  page.on('request', contar);
  await durante();
  page.off('request', contar);
  return n;
}

async function streamParaTexto(fluxo: NodeJS.ReadableStream): Promise<string> {
  const pedacos: Buffer[] = [];
  for await (const pedaco of fluxo) pedacos.push(Buffer.from(pedaco));
  return Buffer.concat(pedacos).toString('utf-8');
}

test('a resposta é gravada pelo participante, antes da troca, sem pedir a linha de volta', async ({ page }) => {
  const banco = novoBanco();
  await bancoFalso(page, banco);
  const participante = await chegarAoQuestionario(page, banco);
  await responderQuestionario(page, (i) => (i % 5) + 1);
  await expect(page.getByRole('heading', { name: 'Obrigado pela participação' })).toBeVisible();

  expect(banco.respostas).toHaveLength(1);
  const [pedido] = banco.respostas;
  expect(pedido.quem).toBe(participante);
  // A identidade do participante ainda não tinha saído.
  expect(pedido.saidasAntes).toEqual([banco.anonimas[0]]);
  // Insert simples: o participante não lê a tabela.
  expect(pedido.consulta).not.toContain('select');
  expect(pedido.consulta).not.toContain('on_conflict');
  expect(pedido.prefer).not.toContain('return=representation');
  expect(pedido.prefer).not.toContain('resolution=');
  expect(pedido.corpo).toMatchObject({
    aplicacao: 'piloto-nov',
    versao_do_questionario: 1,
    o_que_ajudou: null,
    o_que_atrapalhou: null,
  });
  const escalas = (pedido.corpo as { escalas: Record<string, number> }).escalas;
  expect(Object.keys(escalas)).toHaveLength(16);
  expect(escalas).toMatchObject({ 'sus-1': 1, 'sus-2': 2, 'sus-5': 5, 'sus-6': 1, 'vis-6': 1 });
  // Depois da resposta, a troca do fim.
  await expect.poll(() => banco.saidas).toEqual([banco.anonimas[0], participante]);
});

test('a resposta que já estava no banco segue para o fim, como gravada', async ({ page }) => {
  const banco = novoBanco({ resposta: 'ja-gravada' });
  await bancoFalso(page, banco);
  await percorrerTudo(page, banco);
  expect(banco.respostas).toHaveLength(1);
});

test('sem rede no envio, a resposta fica no formulário e a identidade não troca', async ({ page }) => {
  const banco = novoBanco({ resposta: 'fora-do-ar' });
  await bancoFalso(page, banco);
  const participante = await chegarAoQuestionario(page, banco);
  await page.getByLabel('O que atrapalhou ou faltou?').fill('o tempo');
  await responderQuestionario(page);
  await expect(page.getByText('Não foi possível enviar as respostas.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Para terminar' })).toBeVisible();
  expect(banco.saidas).toEqual([banco.anonimas[0]]);

  // A rede volta: o mesmo envio, com as mesmas respostas.
  banco.resposta = 'gravada';
  await page.getByRole('button', { name: 'Enviar respostas' }).click();
  await expect(page.getByRole('heading', { name: 'Obrigado pela participação' })).toBeVisible();
  expect(banco.respostas).toHaveLength(2);
  expect(banco.respostas[1].corpo).toEqual(banco.respostas[0].corpo);
  expect(banco.respostas[1]).toMatchObject({ quem: participante, corpo: { o_que_atrapalhou: 'o tempo' } });
});

for (const [situacao, titulo] of [
  ['encerrada', 'Estudo encerrado'],
  ['inexistente', 'Estudo não encontrado'],
  ['fora-do-ar', 'O estudo não abriu'],
] as const) {
  test(`aplicação ${situacao}: ninguém entra, e nenhuma vaga é pedida`, async ({ page }) => {
    const banco = novoBanco({ situacao });
    await bancoFalso(page, banco);
    await page.goto('/#/estudo/piloto-nov');
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Começar' })).toHaveCount(0);
    expect(banco.entradas).toEqual([]);
  });
}

test('a conferência passa nos três itens, sem gravar sessão nem pedir vaga', async ({ page }) => {
  const banco = novoBanco();
  await bancoFalso(page, banco);
  await page.goto('/#/estudo/piloto-nov/conferir');
  const item = (nome: string) => page.locator('.conferencia li', { hasText: nome });
  await expect(item('Leitura do banco')).toContainText('a aplicação está aberta');
  await expect(item('Criação de identidade anônima')).toContainText('ok');
  await expect(item('Execução no Worker')).toContainText('ok');

  // A identidade de teste nasceu e saiu num cliente à parte; a do aparelho
  // continua guardada, e nunca saiu. (No desenvolvimento, o StrictMode roda a
  // conferência duas vezes, e nascem duas de teste.)
  const guardada = await page.evaluate(() => localStorage.getItem('sb-supabase-falso-auth-token'));
  const doAparelho = banco.anonimas.find((id) => guardada?.includes(id));
  expect(doAparelho).toBeDefined();
  await expect.poll(() => banco.saidas.length).toBe(banco.anonimas.length - 1);
  expect(banco.saidas).not.toContain(doAparelho);
  expect(banco.entradas).toEqual([]);
  expect(banco.sessoes).toEqual([]);
});
