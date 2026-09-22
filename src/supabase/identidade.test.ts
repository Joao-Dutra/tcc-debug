import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Vínculo de conta, verificado por execução (D21).
 *
 * A regra: **vincular Google ou e-mail a um anônimo preserva as sessões já
 * gravadas naquele aparelho.** Isso só vale enquanto a chamada for de vínculo
 * (`linkIdentity`, `updateUser`), que mantém o mesmo `uid`. Trocar por uma
 * entrada comum (`signInWithOAuth`, `signUp`) cria outro usuário, e as sessões
 * do anônimo ficam órfãs — sem dono que as enxergue, já que o RLS as prende ao
 * `uid` que as gravou.
 *
 * É uma linha de diferença, e o prejuízo aparece só depois da coleta. Por isso
 * vira teste.
 */

const auth = {
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  onAuthStateChange: vi.fn(),
  linkIdentity: vi.fn(),
  signInWithOAuth: vi.fn(),
  updateUser: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};

const perfilDoUsuario = { papel: 'participante' };

const clienteFalso = {
  auth,
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: perfilDoUsuario, error: null }),
      }),
    }),
  }),
};

vi.mock('./cliente', () => ({
  supabase: () => clienteFalso,
  supabaseConfigurado: () => true,
}));

type Identidade = typeof import('./identidade');

const usuarioAnonimo = {
  id: 'uid-do-anonimo',
  is_anonymous: true,
  app_metadata: { providers: ['anonymous'] },
  email: null,
};

const semErro = { error: null };

async function comAnonimoJaEntrado(): Promise<Identidade> {
  vi.resetModules();
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.signInAnonymously.mockResolvedValue({
    data: { session: { user: usuarioAnonimo } },
    error: null,
  });
  const modulo = await import('./identidade');
  await modulo.iniciarIdentidade();
  return modulo;
}

beforeEach(() => {
  // A suíte rápida roda sem navegador; o endereço de retorno do login com
  // Google é a única coisa que o módulo pede ao `window`.
  vi.stubGlobal('window', { location: { origin: 'https://exemplo.br' } });
  for (const espiao of Object.values(auth)) espiao.mockReset();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe() {} } } });
  auth.linkIdentity.mockResolvedValue(semErro);
  auth.signInWithOAuth.mockResolvedValue(semErro);
  auth.updateUser.mockResolvedValue(semErro);
  auth.signUp.mockResolvedValue(semErro);
  auth.signOut.mockResolvedValue(semErro);
});

describe('primeiro acesso', () => {
  it('entra anônimo sozinho, sem pedir nada', async () => {
    const identidade = await comAnonimoJaEntrado();

    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(identidade.identidadeAtual().forma).toBe('anonima');
    expect(identidade.identidadeAtual().usuarioId).toBe('uid-do-anonimo');
  });

  it('o núcleo passa a carimbar as sessões com o identificador', async () => {
    await comAnonimoJaEntrado();
    const { participante } = await import('../nucleo/metricas');

    expect(participante()).toBe('uid-do-anonimo');
  });

  it('a identidade guardada é reaproveitada, sem criar outro anônimo', async () => {
    vi.resetModules();
    auth.getSession.mockResolvedValue({ data: { session: { user: usuarioAnonimo } } });
    const identidade = await import('./identidade');
    await identidade.iniciarIdentidade();

    expect(auth.signInAnonymously).not.toHaveBeenCalled();
    expect(identidade.identidadeAtual().usuarioId).toBe('uid-do-anonimo');
  });

  it('falhar em identificar não derruba nada: a coleta segue sem identidade', async () => {
    vi.resetModules();
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error: { message: 'sem rede' },
    });
    const identidade = await import('./identidade');
    await identidade.iniciarIdentidade();

    expect(identidade.identidadeAtual().usuarioId).toBeNull();
    expect(identidade.identidadeAtual().falha).toBe('sem rede');
  });
});

describe('vincular conta a um anônimo', () => {
  it('Google sobre anônimo vincula, e não entra em outra identidade', async () => {
    const identidade = await comAnonimoJaEntrado();
    await identidade.entrarComGoogle();

    expect(auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://exemplo.br' },
    });
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('e-mail e senha sobre anônimo promovem o mesmo usuário', async () => {
    const identidade = await comAnonimoJaEntrado();
    await identidade.criarContaComSenha('participante@exemplo.br', 'senha-comprida');

    expect(auth.updateUser).toHaveBeenCalledWith({
      email: 'participante@exemplo.br',
      password: 'senha-comprida',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('sem anônimo em curso, entra normalmente', async () => {
    vi.resetModules();
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error: { message: 'sem rede' },
    });
    const identidade = await import('./identidade');
    await identidade.iniciarIdentidade();

    await identidade.entrarComGoogle();

    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });
});

describe('sair da conta', () => {
  it('volta na hora a um anônimo novo, e não fica sob a conta nem sem identidade', async () => {
    // O pesquisador entrou no computador do laboratório (D22).
    vi.resetModules();
    auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'uid-do-pesquisador',
            is_anonymous: false,
            app_metadata: { providers: ['email'] },
            email: 'pesquisador@exemplo.br',
          },
        },
      },
    });
    const identidade = await import('./identidade');
    await identidade.iniciarIdentidade();
    const { participante } = await import('../nucleo/metricas');
    expect(participante()).toBe('uid-do-pesquisador');

    auth.signInAnonymously.mockResolvedValue({
      data: { session: { user: { ...usuarioAnonimo, id: 'uid-do-anonimo-novo' } } },
      error: null,
    });
    await identidade.sair();

    // O próximo participante a sentar ali grava sob uma identidade só dele.
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(identidade.identidadeAtual().forma).toBe('anonima');
    expect(participante()).toBe('uid-do-anonimo-novo');
  });
});

describe('forma da identidade', () => {
  it('sai do que o provedor diz, e não de marca nossa', async () => {
    const { formaDoUsuario } = await import('./identidade');

    expect(formaDoUsuario(null)).toBe('nenhuma');
    expect(
      formaDoUsuario({ is_anonymous: true, app_metadata: { providers: ['anonymous'] } } as never)
    ).toBe('anonima');
    expect(
      formaDoUsuario({
        is_anonymous: false,
        app_metadata: { providers: ['anonymous', 'google'] },
      } as never)
    ).toBe('google');
    expect(
      formaDoUsuario({ is_anonymous: false, app_metadata: { providers: ['email'] } } as never)
    ).toBe('email');
  });
});
