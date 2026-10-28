import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

/**
 * A entrada do professor com o banco falso (D31, D39): o que a tela diz
 * quando entrar dá errado, e o que mostra enquanto espera o servidor.
 */

const BANCO = 'http://supabase-falso.invalid';

/** O erro como o servidor de autenticação o devolve, com o código que a tela lê. */
const erroDoServidor = (rota: Route, status: number, codigo: string, mensagem: string) =>
  rota.fulfill({
    status,
    headers: { 'x-supabase-api-version': '2024-01-01' },
    json: { code: codigo, error_code: codigo, msg: mensagem, message: mensagem },
  });

test('credenciais erradas: a mensagem em português, ligada aos dois campos', async ({ page }) => {
  let liberar: () => void = () => {};
  const resposta = new Promise<void>((r) => (liberar = r));
  await page.route(`${BANCO}/**`, async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname === '/auth/v1/token') {
      // Segura a resposta para o teste ver o estado de carregamento.
      await resposta;
      return erroDoServidor(rota, 400, 'invalid_credentials', 'Invalid login credentials');
    }
    return erroDoServidor(rota, 500, 'unexpected_failure', 'banco de mentira');
  });

  await page.goto('/#/entrar');
  const professor = page.locator('section', { has: page.getByRole('heading', { name: 'Sou professor' }) });
  await professor.getByLabel('E-mail').fill('prof@exemplo.br');
  await professor.getByLabel('Senha').fill('senha-comprida');
  await professor.getByRole('button', { name: 'Entrar com e-mail' }).click();

  const entrando = professor.getByRole('button', { name: 'Entrando…' });
  await expect(entrando).toBeDisabled();
  await expect(entrando).toHaveAttribute('aria-busy', 'true');
  await expect(professor.getByRole('button', { name: 'Entrar com Google' })).toBeDisabled();
  liberar();

  const erro = professor.getByRole('alert');
  await expect(erro).toHaveText('E-mail ou senha incorretos. Confira os dois e tente de novo.');
  await expect(professor.getByText('Invalid login credentials')).toHaveCount(0);
  for (const campo of ['E-mail', 'Senha']) {
    await expect(professor.getByLabel(campo)).toHaveAttribute('aria-invalid', 'true');
    await expect(professor.getByLabel(campo)).toHaveAccessibleDescription(
      'E-mail ou senha incorretos. Confira os dois e tente de novo.'
    );
  }
  await expect(professor.getByRole('button', { name: 'Entrar com e-mail' })).toBeEnabled();
});

test('senha fraca ao criar conta: só a senha fica marcada', async ({ page }) => {
  await page.route(`${BANCO}/**`, async (rota) => {
    const url = new URL(rota.request().url());
    const corpo = rota.request().postDataJSON() as { email?: string } | null;
    // O cadastro com e-mail; a entrada anônima da abertura cai no erro genérico.
    if (url.pathname === '/auth/v1/signup' && corpo?.email) {
      return erroDoServidor(rota, 422, 'weak_password', 'Password should be at least 8 characters.');
    }
    return erroDoServidor(rota, 500, 'unexpected_failure', 'banco de mentira');
  });

  await page.goto('/#/entrar');
  const professor = page.locator('section', { has: page.getByRole('heading', { name: 'Sou professor' }) });
  await professor.getByRole('button', { name: 'Não tenho conta' }).click();
  await professor.getByLabel('E-mail').fill('prof@exemplo.br');
  await professor.getByLabel('Senha').fill('12345678');
  await professor.getByRole('button', { name: 'Criar conta' }).click();

  await expect(professor.getByRole('alert')).toContainText('A senha é fraca demais');
  await expect(professor.getByLabel('Senha')).toHaveAttribute('aria-invalid', 'true');
  await expect(professor.getByLabel('E-mail')).not.toHaveAttribute('aria-invalid', 'true');
});
