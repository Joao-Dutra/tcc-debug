import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { vetorDobrar } from '../src/exercicios/vetor-dobrar';

/**
 * A área do professor depois de D33: o autor publica e retira, a pré-
 * visualização mostra a tela do aluno sem gravar sessão, o aviso de seção
 * oculta aparece, e o pesquisador mexe no interruptor e retira qualquer
 * publicado.
 *
 * Roda no projeto `banco-falso`: nada sai da máquina. A conta entra por uma
 * sessão posta no armazenamento do navegador, onde o supabase-js a procura, e
 * cada pedido ao banco é respondido aqui. Isto **não testa a autenticação** —
 * D31 recusou fingi-la para isso —, e sim o que a área faz com cada papel. O
 * que cada papel pode no banco quem cobra é `npm run verificar-rls`.
 */

const BANCO = 'http://supabase-falso.invalid';
const CHAVE_DA_SESSAO = 'sb-supabase-falso-auth-token';
const PROFESSOR = '0a0a0a0a-0000-4000-8000-00000000000a';
const PESQUISADOR = '0c0c0c0c-0000-4000-8000-00000000000c';
const OUTRO_PROFESSOR = '0b0b0b0b-0000-4000-8000-00000000000b';
const ID_PUBLICADO = '33333333-3333-4333-8333-333333333333';
const ID_RASCUNHO = '44444444-4444-4444-8444-444444444444';

/** O conteúdo de um exercício de professor, a partir de um do catálogo. */
function conteudo(titulo: string, publicado: boolean) {
  return {
    titulo,
    enunciado: vetorDobrar.enunciado,
    estrutura: vetorDobrar.estrutura,
    dificuldade: vetorDobrar.dificuldade,
    categoriaDefeito: vetorDobrar.categoriaDefeito,
    codigoCorreto: vetorDobrar.codigoCorreto,
    codigoComDefeito: vetorDobrar.codigoComDefeito,
    casosDeTeste: vetorDobrar.casosDeTeste,
    dicas: vetorDobrar.dicas,
    marcadores: vetorDobrar.marcadores ?? [],
    variaveisDeValor: [],
    ...(publicado ? { linhaDoDefeito: vetorDobrar.linhaDoDefeito, linhasAceitas: [vetorDobrar.linhaDoDefeito] } : {}),
  };
}

function linha(id: string, autor: string, situacao: string, titulo: string) {
  const publicado = situacao === 'publicado';
  return {
    id,
    autor_id: autor,
    situacao,
    conteudo: conteudo(titulo, publicado),
    comentario_da_revisao: null,
    criado_em: '2026-10-01T10:00:00Z',
    atualizado_em: '2026-10-02T10:00:00Z',
    publicado_em: publicado ? '2026-10-02T10:00:00Z' : null,
    retirado_em: null,
    retirado_por: null,
  };
}

interface Banco {
  papel: 'professor' | 'pesquisador';
  ocultos: boolean;
  linhas: ReturnType<typeof linha>[];
  /** As escritas que a tela mandou, na ordem. */
  escritas: { tabela: string; metodo: string; corpo: unknown }[];
}

/** Entra com uma conta de e-mail, sem ir à rede: a sessão já está guardada. */
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
      email: `${usuarioId.slice(0, 4)}@example.com`,
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
  await page.route(`${BANCO}/**`, async (rota) => {
    const pedido: Request = rota.request();
    const url = new URL(pedido.url());
    const metodo = pedido.method();
    const tabela = url.pathname.replace('/rest/v1/', '');
    if (url.pathname === '/auth/v1/user') {
      return rota.fulfill({ status: 200, json: { id: PROFESSOR } });
    }
    if (metodo !== 'GET' && metodo !== 'HEAD') {
      banco.escritas.push({ tabela, metodo, corpo: pedido.postDataJSON() });
      if (tabela === 'coleta') return rota.fulfill({ status: 200, json: [{ unica: true }] });
      return rota.fulfill({ status: 200, json: [{ id: url.searchParams.get('id')?.slice(3) }] });
    }
    // Paginado até a página vazia (D22).
    const primeira = Number(url.searchParams.get('offset') ?? '0') === 0;
    if (tabela === 'perfis') return rota.fulfill({ status: 200, json: { papel: banco.papel } });
    if (tabela === 'coleta') {
      return rota.fulfill({
        status: 200,
        json: primeira ? [{ propostos_ocultos: banco.ocultos, alterado_em: '2026-10-02T09:00:00Z' }] : [],
      });
    }
    if (tabela === 'exercicios_de_professor') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const situacao = url.searchParams.get('situacao')?.replace(/^eq\./, '');
      const filtradas = banco.linhas.filter(
        (l) => (!id || l.id === id) && (!situacao || l.situacao === situacao)
      );
      return rota.fulfill({ status: 200, json: primeira ? filtradas : [] });
    }
    return rota.fulfill({ status: 400, json: { message: 'banco de mentira' } });
  });
}

function bancoDoProfessor(ocultos: boolean): Banco {
  return {
    papel: 'professor',
    ocultos,
    linhas: [
      linha(ID_PUBLICADO, PROFESSOR, 'publicado', 'Meu publicado'),
      linha(ID_RASCUNHO, PROFESSOR, 'rascunho', 'Meu rascunho'),
    ],
    escritas: [],
  };
}

test.describe('o professor', () => {
  test('com a seção oculta, vê o aviso de que ela está oculta aos alunos', async ({ page }) => {
    await entrarComo(page, PROFESSOR);
    await bancoFalso(page, bancoDoProfessor(true));
    await page.goto('/#/autoria');
    const aviso = page.getByRole('status').filter({ hasText: 'oculta aos alunos' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('aparece para os alunos quando a seção voltar');
    await expect(page.getByText(/Fica oculto aos alunos enquanto a seção estiver oculta/)).toBeVisible();
  });

  test('com a seção visível, não vê aviso nenhum', async ({ page }) => {
    await entrarComo(page, PROFESSOR);
    await bancoFalso(page, bancoDoProfessor(false));
    await page.goto('/#/autoria');
    await expect(page.getByText('Meu publicado')).toBeVisible();
    await expect(page.getByText(/oculta aos alunos/)).toHaveCount(0);
  });

  test('retira o próprio publicado, e abre a pré-visualização dele', async ({ page }) => {
    const banco = bancoDoProfessor(true);
    await entrarComo(page, PROFESSOR);
    await bancoFalso(page, banco);
    await page.goto('/#/autoria');
    const item = page.locator('.lista-de-exercicios li', { hasText: 'Meu publicado' });
    await expect(item.getByRole('link', { name: 'Ver como o aluno veria' })).toHaveAttribute(
      'href',
      `#/previa/${ID_PUBLICADO}?andaime=com-apoio`
    );

    page.once('dialog', (d) => void d.accept());
    await item.getByRole('button', { name: 'Retirar' }).click();
    await expect.poll(() => banco.escritas).toContainEqual({
      tabela: 'exercicios_de_professor',
      metodo: 'PATCH',
      corpo: { situacao: 'retirado' },
    });
  });

  test('no editor, publicar e ver como o aluno veria só se liberam depois de verificar', async ({ page }) => {
    await entrarComo(page, PROFESSOR);
    await bancoFalso(page, bancoDoProfessor(true));
    await page.goto('/#/autoria');
    await page.locator('.lista-de-exercicios li', { hasText: 'Meu rascunho' }).getByRole('button', { name: 'Editar' }).click();

    const etapas = page.getByRole('list', { name: 'Caminho até a publicação' });
    await expect(etapas.getByRole('button')).toHaveText([
      'Salvar rascunho',
      'Verificar',
      'Ver como o aluno veria',
      'Publicar',
    ]);
    await expect(etapas.getByRole('button', { name: 'Publicar' })).toBeDisabled();
    await expect(etapas.getByRole('button', { name: 'Ver como o aluno veria' })).toBeDisabled();

    await etapas.getByRole('button', { name: 'Verificar' }).click();
    await expect(etapas.getByRole('button', { name: 'Publicar' })).toBeEnabled({ timeout: 20_000 });
    await expect(etapas.getByRole('button', { name: 'Ver como o aluno veria' })).toBeEnabled();

    // Editar depois de verificar trava de novo.
    await page.getByLabel('Título').fill('Meu rascunho, editado');
    await expect(etapas.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  });
});

test.describe('a pré-visualização', () => {
  // Aparelho limpo: na tela do aluno, o tutorial abriria sozinho aqui.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('é a tela do aluno, nos dois níveis, sem tutorial sozinho e sem gravar sessão', async ({ page }) => {
    const banco = bancoDoProfessor(true);
    await entrarComo(page, PROFESSOR);
    await bancoFalso(page, banco);
    await page.goto(`/#/previa/${ID_PUBLICADO}?andaime=com-apoio`);

    await expect(page.getByText(/Pré-visualização: é assim que o aluno verá/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Meu publicado', level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('link', { name: 'sem apoio' })).toHaveAttribute(
      'href',
      `#/previa/${ID_PUBLICADO}?andaime=sem-apoio`
    );

    // Executa, aponta uma linha e sai: nada disso fica no aparelho nem vai ao banco.
    await page.getByRole('button', { name: 'Executar', exact: true }).click();
    await page.locator('.cm-lineNumbers .cm-gutterElement', { hasText: /^1$/ }).click();
    await expect(page.locator('.apontadas li')).toHaveCount(1);
    await page.getByRole('link', { name: 'sem apoio' }).click();
    await expect(page.getByText(/Pré-visualização/)).toBeVisible();
    await page.goto('/#/autoria');
    await expect(page.getByText('Meu publicado')).toBeVisible();

    const arquivadas = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depurar:sessoes-arquivadas') ?? '[]')
    );
    expect(arquivadas.filter((s: { exercicioId: string }) => s.exercicioId === ID_PUBLICADO)).toEqual([]);
    expect(banco.escritas.filter((e) => e.tabela === 'sessoes')).toEqual([]);
  });

  test('de um rascunho, verifica de novo para ter a linha do defeito', async ({ page }) => {
    await entrarComo(page, PROFESSOR);
    await bancoFalso(page, bancoDoProfessor(true));
    await page.goto(`/#/previa/${ID_RASCUNHO}?andaime=sem-apoio`);
    await expect(page.getByRole('heading', { name: 'Meu rascunho', level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.nivel.ativo')).toHaveText('sem apoio');
  });
});

test.describe('o pesquisador', () => {
  function bancoDoPesquisador(): Banco {
    return {
      papel: 'pesquisador',
      ocultos: true,
      linhas: [linha(ID_PUBLICADO, OUTRO_PROFESSOR, 'publicado', 'Publicado de outra pessoa')],
      escritas: [],
    };
  }

  test('mexe no interruptor da coleta', async ({ page }) => {
    const banco = bancoDoPesquisador();
    await entrarComo(page, PESQUISADOR);
    await bancoFalso(page, banco);
    await page.goto('/#/autoria');
    await expect(page.getByText('A seção “Propostos por professores” está oculta aos alunos.')).toBeVisible();

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Mostrar a seção aos alunos' }).click();
    await expect.poll(() => banco.escritas).toContainEqual({
      tabela: 'coleta',
      metodo: 'PATCH',
      corpo: { propostos_ocultos: false },
    });
  });

  test('retira o publicado de outra pessoa, e não tem como publicar nem editar', async ({ page }) => {
    const banco = bancoDoPesquisador();
    await entrarComo(page, PESQUISADOR);
    await bancoFalso(page, banco);
    await page.goto('/#/autoria');
    const item = page.locator('.lista-de-exercicios li', { hasText: 'Publicado de outra pessoa' });
    await expect(item).toBeVisible();
    await expect(item.getByRole('button', { name: /Publicar|Editar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Novo exercício' })).toHaveCount(0);

    page.once('dialog', (d) => void d.accept());
    await item.getByRole('button', { name: 'Retirar' }).click();
    await expect.poll(() => banco.escritas).toContainEqual({
      tabela: 'exercicios_de_professor',
      metodo: 'PATCH',
      corpo: { situacao: 'retirado' },
    });
  });
});
