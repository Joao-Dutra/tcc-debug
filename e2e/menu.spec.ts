import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * O menu do papel no cabeçalho (D39), com o banco falso. É conveniência: o
 * professor vê a autoria, o pesquisador vê o painel de controle, as métricas
 * e o mapa de rotas, e o participante não vê nada.
 */

const BANCO = 'http://supabase-falso.invalid';
const CHAVE_DA_SESSAO = 'sb-supabase-falso-auth-token';
const CONTA = '0d0d0d0d-0000-4000-8000-00000000000d';

async function contaCom(page: Page, papel: string, forma: 'email' | 'anonima' = 'email') {
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
      email: forma === 'email' ? 'conta@example.com' : undefined,
      app_metadata: { provider: forma, providers: [forma] },
      user_metadata: {},
      is_anonymous: forma === 'anonima',
      created_at: '2026-10-01T10:00:00Z',
    },
  };
  await page.addInitScript(
    ([chave, valor]) => window.localStorage.setItem(chave, valor),
    [CHAVE_DA_SESSAO, JSON.stringify(sessao)] as const
  );
  await page.route(`${BANCO}/**`, async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname === '/auth/v1/user') return rota.fulfill({ status: 200, json: { id: CONTA } });
    if (url.pathname === '/rest/v1/perfis') return rota.fulfill({ status: 200, json: { papel } });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return rota.fulfill({ status: 200, json: [] });
    return rota.fulfill({ status: 200, json: [] });
  });
}

const menu = (page: Page) => page.getByRole('navigation', { name: 'Suas áreas' });

test('o professor vê só a autoria, na vitrine e na própria área', async ({ page }) => {
  await contaCom(page, 'professor');
  await page.goto('/#/exercicios');
  await expect(menu(page).getByRole('link')).toHaveText(['Área do professor']);
  await menu(page).getByRole('link', { name: 'Área do professor' }).click();
  await expect(page).toHaveURL(/#\/autoria$/);
  await expect(menu(page).getByRole('link', { name: 'Área do professor' })).toHaveAttribute('aria-current', 'page');
});

test('o pesquisador vê o painel de controle, as métricas e o mapa de rotas', async ({ page }) => {
  await contaCom(page, 'pesquisador');
  await page.goto('/#/entrar');
  await expect(menu(page).getByRole('link')).toHaveText(['Painel de controle', 'Métricas', 'Mapa de rotas']);
  await menu(page).getByRole('link', { name: 'Mapa de rotas' }).click();
  await expect(page).toHaveURL(/#\/controle\?secao=rotas$/);
  await expect(page.getByRole('heading', { name: 'Mapa de rotas' })).toBeInViewport();
  // E o menu continua nas telas de conta, que têm cabeçalho próprio.
  await menu(page).getByRole('link', { name: 'Métricas' }).click();
  await expect(page).toHaveURL(/#\/metricas$/);
  await expect(menu(page).getByRole('link')).toHaveCount(3);
});

test('a conta sem papel e o anônimo não veem menu', async ({ page, context }) => {
  await contaCom(page, 'participante');
  await page.goto('/#/exercicios');
  await expect(page.getByRole('heading', { name: /exercícios/i }).first()).toBeVisible();
  await expect(menu(page)).toHaveCount(0);

  const outra = await context.newPage();
  await contaCom(outra, 'pesquisador', 'anonima');
  await outra.goto('/#/exercicios');
  await expect(outra.getByRole('heading', { name: /exercícios/i }).first()).toBeVisible();
  await expect(menu(outra)).toHaveCount(0);
});

test('na área do estudo, nem o pesquisador vê menu', async ({ page }) => {
  await contaCom(page, 'pesquisador');
  await page.goto('/#/estudo/piloto-nov/conferir');
  await expect(page.getByRole('heading', { name: 'Conferência da máquina' })).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
});
