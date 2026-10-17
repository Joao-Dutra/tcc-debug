import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LIMITE_POR_EXERCICIO_MS } from '../src/estudo/percurso';
import { ITENS_DAS_ESCALAS, VERSAO_DO_QUESTIONARIO } from '../src/estudo/questionario';
import { responderQuestionario } from './questionario-do-estudo';

/**
 * A área do estudo, sem banco (D37).
 *
 * O percurso inteiro com os controles de verdade: o consentimento que segura a
 * entrada, o tutorial que abre no aquecimento mesmo num aparelho que já o viu,
 * a tela sem caminho para fora, o apoio do plano em cada etapa, o seguir com
 * confirmação, o prazo invisível, o questionário e o fim sem resultado. O que cada sessão leva
 * — a marca e o encerramento — é lido do arquivo do aparelho.
 *
 * O aparelho deste projeto já viu o tutorial (playwright.config.ts): é o que
 * mostra que a marca não é herdada.
 */

const ESTUDO = '/#/estudo/piloto-nov';

interface SessaoLida {
  exercicioId: string;
  andaime: string;
  estudo?: { aplicacao: string; etapa: number; aquecimento: boolean; grupoNoAparelho?: string };
  eventos: { tipo: string; motivo?: string }[];
}

async function sessoesDoEstudo(page: Page): Promise<SessaoLida[]> {
  const todas: SessaoLida[] = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('depurar:sessoes-arquivadas') ?? '[]')
  );
  return todas.filter((s) => s.estudo !== undefined);
}

/** Etapa, exercício, apoio e como terminou: o resumo do que o percurso gravou. */
const descrever = (s: SessaoLida) => [
  s.estudo!.etapa,
  s.exercicioId,
  s.andaime,
  s.eventos.find((e) => e.tipo === 'encerramento')?.motivo ?? 'sem encerramento',
];

async function aceitarEEntrar(page: Page) {
  await page.goto(ESTUDO);
  await page.getByLabel('Concordo em participar').check();
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.getByRole('radio', { name: 'Estou cursando' }).check();
  await page.getByRole('radio', { name: 'Às vezes' }).check();
  await page.getByRole('radio', { name: 'Não', exact: true }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
}

/** A execução da abertura terminou: há passos no reprodutor. */
async function exercicioAberto(page: Page, rotulo: string) {
  await expect(page.locator('.posicao-no-percurso')).toHaveText(rotulo);
  await expect(page.locator('.contador')).toContainText('passo 1 /');
}

async function seguir(page: Page, ultimo = false) {
  await page.getByRole('button', { name: ultimo ? 'Concluir os exercícios' : 'Seguir para o próximo' }).click();
  await page.getByRole('button', { name: ultimo ? 'Concluir' : 'Seguir', exact: true }).click();
}

test('sem marcar "Concordo em participar", não se entra', async ({ page }) => {
  await page.goto(ESTUDO);
  await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible();
  await expect(page.getByText('A participação é voluntária e não afeta a sua nota')).toBeVisible();
  const comecar = page.getByRole('button', { name: 'Começar' });
  await expect(comecar).toBeDisabled();
  await page.getByLabel('Concordo em participar').check();
  await expect(comecar).toBeEnabled();
  await page.getByLabel('Concordo em participar').uncheck();
  await expect(comecar).toBeDisabled();
});

test('o percurso inteiro: plano do grupo A, seguir, prazo, recarga e fim', async ({ page }) => {
  await page.clock.install();
  await page.goto(ESTUDO);
  await page.getByLabel('Concordo em participar').check();
  await page.getByRole('button', { name: 'Começar' }).click();

  // O perfil só segue completo.
  await expect(page.getByRole('heading', { name: 'Sobre você' })).toBeVisible();
  const continuar = page.getByRole('button', { name: 'Continuar' });
  await page.getByRole('radio', { name: 'Já cursei' }).check();
  await page.getByRole('radio', { name: 'Nunca' }).check();
  await expect(continuar).toBeDisabled();
  await page.getByRole('radio', { name: 'Sim' }).check();
  await continuar.click();

  // Aquecimento: o tutorial abre sozinho, embora o aparelho já o tenha visto.
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await exercicioAberto(page, 'Aquecimento');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vetor: um valor negativo sobrevive');

  // Nenhum caminho para fora do percurso, nem troca de apoio.
  await expect(page.getByRole('link')).toHaveCount(0);
  await expect(page.getByText('trocar o apoio recomeça o exercício')).toHaveCount(0);

  // Seguir pede confirmação; ficar não perde nada.
  await page.getByRole('button', { name: 'Seguir para o próximo' }).click();
  await expect(page.getByText('Não dá para voltar a este exercício depois.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ficar neste exercício' })).toBeFocused();
  await page.getByRole('button', { name: 'Ficar neste exercício' }).click();
  await expect(page.locator('.posicao-no-percurso')).toHaveText('Aquecimento');
  await seguir(page);

  // Grupo A: com apoio no primeiro, sem no segundo. O tutorial não abre mais.
  await exercicioAberto(page, 'Exercício 1 de 5');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Revelar dica 1' })).toBeVisible();
  await seguir(page);
  await exercicioAberto(page, 'Exercício 2 de 5');
  await expect(page.getByRole('button', { name: 'Revelar dica 1' })).toHaveCount(0);

  // O prazo não aparece na tela; quando vence, a etapa termina.
  await expect(page.locator('.cabecalho')).not.toContainText(/\d{1,2}:\d{2}|minuto|restam/);
  await page.clock.fastForward(LIMITE_POR_EXERCICIO_MS);
  await expect(page.getByRole('heading', { name: 'O tempo deste exercício terminou' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await exercicioAberto(page, 'Exercício 3 de 5');

  // Recarregar não perde o lugar.
  await page.reload();
  await exercicioAberto(page, 'Exercício 3 de 5');
  await seguir(page);
  await exercicioAberto(page, 'Exercício 4 de 5');
  await seguir(page);
  await exercicioAberto(page, 'Exercício 5 de 5');
  await seguir(page, true);

  // Depois do último, o questionário; recarregar também não perde o lugar.
  await expect(page.getByRole('heading', { name: 'Para terminar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Para terminar' })).toBeVisible();
  await responderQuestionario(page);

  // O fim não mostra resultado nenhum.
  await expect(page.getByRole('heading', { name: 'Obrigado pela participação' })).toBeVisible();
  await expect(page.locator('main')).toHaveText(
    'As suas respostas foram registradas. Você já pode fechar esta página.'
  );

  const sessoes = await sessoesDoEstudo(page);
  expect(sessoes.map(descrever)).toEqual([
    [0, 'vetor-zerar-negativos', 'com-apoio', 'seguir'],
    [1, 'pilha-desempilhar', 'com-apoio', 'seguir'],
    [2, 'fila-atender-todos', 'sem-apoio', 'tempo-esgotado'],
    // A recarga arquivou a sessão em curso (D15), e a etapa abriu outra.
    [3, 'lista-inserir-depois', 'com-apoio', 'sem encerramento'],
    [3, 'lista-inserir-depois', 'com-apoio', 'seguir'],
    [4, 'vetor-ordenar-por-selecao', 'sem-apoio', 'seguir'],
    [5, 'vetor-ordenar', 'com-apoio', 'seguir'],
  ]);
  // Sem banco, o grupo vai na marca, dito como escolhido no aparelho.
  for (const s of sessoes) {
    expect(s.estudo).toMatchObject({ aplicacao: 'piloto-nov', grupoNoAparelho: 'A' });
    expect(s.estudo!.aquecimento).toBe(s.estudo!.etapa === 0);
  }
  // O tutorial entrou no log do aquecimento, e o encerramento é o último evento.
  expect(sessoes[0].eventos.map((e) => e.tipo)).toContain('tutorial-aberto');
  for (const s of sessoes.filter((s) => s.eventos.some((e) => e.tipo === 'encerramento'))) {
    expect(s.eventos.at(-1)!.tipo).toBe('encerramento');
  }

  // Recarregar depois do fim abre o aviso, para o próximo participante.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Antes de começar' })).toBeVisible();
});

test('o questionário: as afirmações são obrigatórias, e as abertas, não', async ({ page }) => {
  await aceitarEEntrar(page);
  await page.evaluate(() => {
    // Direto ao questionário: o caminho até ele é o do teste do percurso.
    const chave = 'depurar:percurso-do-estudo';
    const estado = JSON.parse(sessionStorage.getItem(chave)!);
    estado.passo = { tela: 'questionario' };
    sessionStorage.setItem(chave, JSON.stringify(estado));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Para terminar' })).toBeVisible();
  // Sem caminho para fora aqui também.
  await expect(page.getByRole('link')).toHaveCount(0);

  const enviar = page.getByRole('button', { name: 'Enviar respostas' });
  await expect(enviar).toBeDisabled();
  await expect(page.getByRole('status')).toHaveText('Faltam 16 afirmações para marcar.');
  // As âncoras da fonte, sob os extremos de cada afirmação.
  await expect(page.locator('.ancora', { hasText: 'Discordo fortemente' })).toHaveCount(16);
  await expect(page.locator('.ancora', { hasText: 'Concordo fortemente' })).toHaveCount(16);

  // Todas menos uma: ainda não envia.
  for (const item of ITENS_DAS_ESCALAS.slice(0, -1)) {
    await page.getByRole('group', { name: item.texto }).locator('input[value="2"]').check();
  }
  await expect(page.getByRole('status')).toHaveText('Falta 1 afirmação para marcar.');
  await expect(enviar).toBeDisabled();
  await page.getByRole('group', { name: ITENS_DAS_ESCALAS.at(-1)!.texto }).locator('input[value="5"]').check();
  await expect(enviar).toBeEnabled();

  await page.getByLabel('O que mais ajudou?').fill('  ver a fila andando  ');
  await enviar.click();
  await expect(page.getByRole('heading', { name: 'Obrigado pela participação' })).toBeVisible();

  // Sem banco, a resposta fica no aparelho, com a versão do texto.
  const guardadas = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('depurar:respostas-do-questionario') ?? '[]')
  );
  expect(guardadas).toHaveLength(1);
  expect(guardadas[0]).toMatchObject({
    aplicacao: 'piloto-nov',
    versao: VERSAO_DO_QUESTIONARIO,
    oQueAjudou: 'ver a fila andando',
    oQueAtrapalhou: null,
  });
  expect(Object.keys(guardadas[0].escalas)).toEqual(ITENS_DAS_ESCALAS.map((i) => i.id));
  expect(guardadas[0].escalas['sus-1']).toBe(2);
  expect(guardadas[0].escalas['vis-6']).toBe(5);
});

test('quem recarrega depois do prazo vai direto à tela do tempo, sem abrir sessão', async ({ page }) => {
  await aceitarEEntrar(page);
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await exercicioAberto(page, 'Aquecimento');
  await seguir(page);
  await exercicioAberto(page, 'Exercício 1 de 5');

  // O prazo da etapa vence com a página fechada.
  await page.evaluate(() => {
    const chave = 'depurar:percurso-do-estudo';
    const estado = JSON.parse(sessionStorage.getItem(chave)!);
    estado.prazos[1] = Date.now() - 1000;
    sessionStorage.setItem(chave, JSON.stringify(estado));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'O tempo deste exercício terminou' })).toBeVisible();
  // A da etapa 1 é só a que a recarga arquivou: nenhuma nasceu vencida.
  expect((await sessoesDoEstudo(page)).filter((s) => s.estudo!.etapa === 1)).toHaveLength(1);
});

test('o segundo percurso no mesmo aparelho cai no grupo B, com o apoio invertido', async ({ context }) => {
  const primeira = await context.newPage();
  await aceitarEEntrar(primeira);
  await expect(primeira.getByRole('dialog')).toBeVisible();
  await primeira.close();

  // Outra aba é outro participante: começa do aviso.
  const segunda = await context.newPage();
  await aceitarEEntrar(segunda);
  await segunda.getByRole('button', { name: 'Pular tutorial' }).click();
  await exercicioAberto(segunda, 'Aquecimento');
  // O aquecimento é com apoio para todos.
  await expect(segunda.getByRole('button', { name: 'Revelar dica 1' })).toBeVisible();
  await seguir(segunda);
  await exercicioAberto(segunda, 'Exercício 1 de 5');
  await expect(segunda.getByRole('button', { name: 'Revelar dica 1' })).toHaveCount(0);
  await seguir(segunda);
  await exercicioAberto(segunda, 'Exercício 2 de 5');
  await expect(segunda.getByRole('button', { name: 'Revelar dica 1' })).toBeVisible();

  // A sessão em curso, da etapa 2, também já está no arquivo: o StrictMode
  // do desenvolvimento desmonta e remonta a tela, e o desmonte arquiva.
  const sessoes = (await sessoesDoEstudo(segunda)).filter((s) => s.estudo!.etapa < 2);
  expect(sessoes.filter((s) => s.estudo!.grupoNoAparelho === 'B').map(descrever)).toEqual([
    [0, 'vetor-zerar-negativos', 'com-apoio', 'seguir'],
    [1, 'pilha-desempilhar', 'sem-apoio', 'seguir'],
  ]);
});

test('a conferência sem banco aponta a falha do banco, e o Worker funciona', async ({ page }) => {
  await page.goto(`${ESTUDO}/conferir`);
  const item = (nome: string) => page.locator('.conferencia li', { hasText: nome });
  await expect(item('Execução no Worker')).toContainText('ok');
  await expect(item('Leitura do banco')).toContainText('falha');
  await expect(item('Leitura do banco')).toContainText('o banco não está configurado nesta instalação');
  await expect(item('Criação de identidade anônima')).toContainText('falha');
  // Nada gravado.
  expect(await page.evaluate(() => localStorage.getItem('depurar:sessoes-arquivadas'))).toBeNull();
});
