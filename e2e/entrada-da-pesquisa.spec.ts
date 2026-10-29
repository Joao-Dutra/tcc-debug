import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * O acesso da pesquisa (D39), com o banco falso: entrar não concede papel.
 * Quem tem o papel vai para o painel de controle; quem não tem vê o mesmo
 * aviso de liberação da área do professor, com a frase da pesquisa.
 */

const BANCO = 'http://supabase-falso.invalid';
const CHAVE_DA_SESSAO = 'sb-supabase-falso-auth-token';
const CONTA = '0c0c0c0c-0000-4000-8000-00000000000c';

/** Uma conta de e-mail já entrada, sem ir à rede: a sessão está guardada. */
async function entrarComo(page: Page) {
  const agora = Math.floor(Date.now() / 1000);
  const sessao = {
    access_token: 'token-de-mentira',
    refresh_token: 'renovacao-de-mentira',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: agora + 3600,
    user: {
      id: CONTA,
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

/** O banco responde só o papel; o resto, vazio. */
async function bancoComPapel(page: Page, papel: string) {
  await page.route(`${BANCO}/**`, async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname === '/auth/v1/user') return rota.fulfill({ status: 200, json: { id: CONTA } });
    if (url.pathname === '/rest/v1/perfis') return rota.fulfill({ status: 200, json: { papel } });
    return rota.fulfill({ status: 200, json: [] });
  });
}

test('sem conta, o acesso mostra só e-mail e senha, sem Google nem criar conta', async ({ page }) => {
  await bancoComPapel(page, 'participante');
  await page.goto('/#/entrar/pesquisa');
  await expect(page.getByRole('heading', { name: 'Acesso da pesquisa', level: 1 })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar como pesquisador' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Google/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Não tenho conta' })).toHaveCount(0);
});

for (const papel of ['participante', 'professor']) {
  test(`conta de ${papel} vê que aguarda liberação, com a frase da pesquisa`, async ({ page }) => {
    await entrarComo(page);
    await bancoComPapel(page, papel);
    await page.goto('/#/entrar/pesquisa');
    const aviso = page.getByRole('status').filter({ hasText: 'Aguardando liberação' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('ainda não tem acesso aos dados nem ao painel da pesquisa');
    await expect(aviso).not.toContainText('escrever exercícios');
    await expect(page).toHaveURL(/#\/entrar\/pesquisa$/);
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  });
}

test('conta de pesquisador vai para o painel de controle', async ({ page }) => {
  await entrarComo(page);
  await bancoComPapel(page, 'pesquisador');
  await page.goto('/#/entrar/pesquisa');
  await expect(page).toHaveURL(/#\/controle$/);
});
