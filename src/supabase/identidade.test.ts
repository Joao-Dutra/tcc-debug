import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Identidade, verificada por execução (D21, D29).
 *
 * O aluno entra anônimo sozinho e fica assim: a identidade guardada no
 * aparelho é o que agrupa as sessões dele. A regra que D21 cobrava aqui —
 * vincular Google ou e-mail ao anônimo — se inverteu com D29: a entrada é do
 * professor, e **nunca vincula**. Vincular (`linkIdentity`, `updateUser`)
 * levaria para a conta do professor as sessões anônimas do aparelho em que ele
 * entrou; entrar (`signInWithOAuth`, `signUp`, `signInWithPassword`) deixa
 * cada identidade com as suas.
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
  vi.stubGlobal('window', { location: { origin: 'https://exemplo.br', pathname: '/' } });
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

// D29 inverteu o que D21 cobrava aqui. O aluno não tem conta, e a entrada do
// professor NUNCA vincula ao anônimo do aparelho: vincular levaria para a conta
// dele as sessões de quem usou o aparelho antes. A propriedade que o teste
// cobra é a ausência do vínculo, com o anônimo em curso — que é o caso de
// todo aparelho.
describe('a entrada do professor não vincula ao anônimo (D29)', () => {
  it('Google entra numa conta própria, e não vincula', async () => {
    const identidade = await comAnonimoJaEntrado();
    await identidade.entrarComGoogle('#/autoria');

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://exemplo.br/#/autoria' },
    });
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('a conta nova com e-mail e senha é outro usuário, e não o anônimo promovido', async () => {
    const identidade = await comAnonimoJaEntrado();
    auth.signUp.mockResolvedValue({ data: { session: { user: { id: 'uid-novo' } } }, error: null });
    const resultado = await identidade.criarContaDeProfessor('prof@exemplo.br', 'senha-comprida');

    expect(auth.signUp).toHaveBeenCalledWith({ email: 'prof@exemplo.br', password: 'senha-comprida' });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(resultado).toEqual({ erro: null, confirmarPorEmail: false });
  });

  it('quando o projeto pede confirmação por e-mail, a tela fica sabendo', async () => {
    const identidade = await comAnonimoJaEntrado();
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'uid-novo' } }, error: null });
    const resultado = await identidade.criarContaDeProfessor('prof@exemplo.br', 'senha-comprida');

    expect(resultado.confirmarPorEmail).toBe(true);
  });

  it('entrar com senha também não vincula', async () => {
    const identidade = await comAnonimoJaEntrado();
    auth.signInWithPassword.mockResolvedValue(semErro);
    await identidade.entrarComSenha('prof@exemplo.br', 'senha-comprida');

    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(auth.linkIdentity).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
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
