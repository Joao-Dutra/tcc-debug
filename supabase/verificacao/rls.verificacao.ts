import { createClient } from '@supabase/supabase-js';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Verificação do RLS contra o projeto Supabase de verdade (D24).
 *
 * As políticas de `supabase/migracoes/` são a única proteção do dado (D21): a
 * chave pública vai no pacote entregue ao navegador, e qualquer pessoa a
 * extrai. E um RLS errado não falha de forma visível — o participante
 * simplesmente lê o que não devia. Os testes da suíte comum não alcançam nada
 * disso, porque o RLS vive no banco. Esta verificação conversa com o projeto
 * real, pela mesma API que o navegador usa, autenticada como um participante
 * comum.
 *
 * Fica fora da suíte comum de propósito: precisa de rede, do projeto e da
 * chave secreta, e cria contas de verdade. Roda com `npm run verificar-rls`.
 * A chave secreta vem só do ambiente do shell — nunca de arquivo do
 * repositório nem de variável VITE_*, que o Vite embute no pacote (D21).
 *
 * As contas de teste nascem e morrem aqui. Remover o usuário leva junto o
 * perfil e as sessões dele (`on delete cascade`), e a última verificação
 * confere que nada ficou. Uma execução derrubada no meio deixa contas para
 * trás; a seguinte começa removendo essas sobras, reconhecidas pelo e-mail,
 * que nenhum participante real tem.
 */

const url = process.env.VITE_SUPABASE_URL ?? '';
const chavePublica = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const chaveSecreta = process.env.SUPABASE_SECRET_KEY ?? '';

if (!url || !chavePublica) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env: a verificação ' +
      'roda contra o projeto que a aplicação usa.'
  );
}
if (!chaveSecreta) {
  throw new Error(
    'Falta SUPABASE_SECRET_KEY no ambiente. É a chave secreta do projeto (Project Settings > ' +
      'API Keys), e só a verificação a usa, para criar e remover as contas de teste. Passe-a ' +
      "só para este comando — no PowerShell: $env:SUPABASE_SECRET_KEY = '...'; npm run " +
      'verificar-rls; Remove-Item Env:SUPABASE_SECRET_KEY. Nunca a ponha no .env nem em ' +
      'variável VITE_*.'
  );
}

/** Sem sessão guardada nem renovação: cada cliente vive só nesta execução. */
const semPersistencia = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * A chave secreta passa por cima do RLS. Serve para três coisas, e só elas:
 * criar e remover as contas de teste, e conferir o efeito real de cada
 * tentativa — a resposta da API a quem tentou não basta, porque uma alteração
 * barrada pelo RLS pode voltar sem erro, só sem linha nenhuma.
 */
const admin = createClient(url, chaveSecreta, semPersistencia);

/**
 * `example.com` é reservado para exemplo (RFC 2606): nenhum participante tem
 * e-mail ali, e é por esse endereço que as sobras de uma execução derrubada
 * são reconhecidas e removidas.
 */
const PREFIXO_DO_EMAIL = 'verificacao-rls-';
const DOMINIO_DO_EMAIL = '@example.com';
const EXERCICIO_DE_TESTE = 'verificacao-rls';

const carimbo = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ehContaDeTeste = (email: string | undefined) =>
  email !== undefined && email.startsWith(PREFIXO_DO_EMAIL) && email.endsWith(DOMINIO_DO_EMAIL);

interface Conta {
  id: string;
  /** Cliente com a chave pública, autenticado como esta conta: o que o navegador tem. */
  cliente: SupabaseClient;
}

/** Ids de toda conta criada nesta execução, para a limpeza não depender de nada mais. */
const criadas: string[] = [];

async function criarConta(rotulo: string): Promise<Conta> {
  const email = `${PREFIXO_DO_EMAIL}${rotulo}-${carimbo}${DOMINIO_DO_EMAIL}`;
  // Letra maiúscula, minúscula, algarismo e símbolo: passa em qualquer regra de
  // senha que o projeto tenha ligado.
  const senha = `Aa1!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { verificacao_rls: true },
  });
  if (error || !data.user) {
    throw new Error(`não foi possível criar a conta de teste ${rotulo}: ${error?.message}`);
  }
  criadas.push(data.user.id);

  const cliente = createClient(url, chavePublica, semPersistencia);
  const entrada = await cliente.auth.signInWithPassword({ email, password: senha });
  if (entrada.error) {
    throw new Error(`a conta de teste ${rotulo} não conseguiu entrar: ${entrada.error.message}`);
  }
  return { id: data.user.id, cliente };
}

/**
 * Remove a conta, e com ela o perfil e as sessões. Se a remoção esbarrar numa
 * chave estrangeira — o `on delete cascade` foi tirado de alguma tabela —, as
 * linhas daquela conta são removidas antes e a remoção é tentada de novo: só
 * as linhas da conta de teste, e nenhuma outra.
 */
async function removerConta(id: string): Promise<void> {
  const primeira = await admin.auth.admin.deleteUser(id);
  if (!primeira.error) return;
  await admin.from('sessoes').delete().eq('participante_id', id);
  await admin.from('perfis').delete().eq('id', id);
  const segunda = await admin.auth.admin.deleteUser(id);
  if (segunda.error && !/not found/i.test(segunda.error.message)) {
    throw new Error(`não foi possível remover a conta de teste ${id}: ${segunda.error.message}`);
  }
}

/**
 * Contas de teste que existem no projeto agora, desta execução ou de uma
 * anterior. Vai até a página vazia, e não até a primeira página curta: se o
 * servidor limitar a página abaixo do pedido, parar na curta deixaria sobras
 * das páginas seguintes sem ninguém ver — o mesmo corte silencioso de D22.
 */
async function contasDeTesteNoProjeto(): Promise<string[]> {
  const encontradas: string[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error(`não foi possível listar as contas: ${error.message}`);
    if (data.users.length === 0) return encontradas;
    for (const usuario of data.users) if (ehContaDeTeste(usuario.email)) encontradas.push(usuario.id);
  }
}

/** Consulta por cima do RLS que não pode falhar calada: sem dado, um erro viraria "nada ficou". */
async function linhasNoBanco(
  consulta: PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>
): Promise<unknown[]> {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function removerTodasAsContasDeTeste(): Promise<void> {
  const ids = new Set([...criadas, ...(await contasDeTesteNoProjeto())]);
  for (const id of ids) await removerConta(id);
}

/** Uma linha de `sessoes` que não se confunde com dado do estudo em hipótese nenhuma. */
function linhaDeSessao(id: string, participanteId: string) {
  return {
    id,
    participante_id: participanteId,
    // Versão 0 e um exercício que não existe: mesmo que sobrasse, esta linha
    // não entraria na análise por engano.
    versao: 0,
    exercicio_id: EXERCICIO_DE_TESTE,
    andaime: null,
    instante_de_inicio: new Date().toISOString(),
    duracao_total_ms: 0,
    eventos: [],
    resumo: {},
  };
}

/** Lida por cima do RLS: é o que de fato está no banco. */
async function sessaoNoBanco(id: string) {
  const { data, error } = await admin
    .from('sessoes')
    .select('id, participante_id, duracao_total_ms')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function papelNoBanco(id: string): Promise<string | null> {
  const { data, error } = await admin.from('perfis').select('papel').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.papel as string | undefined) ?? null;
}

/**
 * Recusa pelo RLS, e não por outro motivo. Sem conferir o código, uma
 * tentativa com a linha malformada — uma coluna com nome errado — também
 * "falharia", e a verificação passaria sem ter testado política nenhuma.
 */
function recusadaPeloRls(error: PostgrestError | null) {
  expect(error, 'a operação deveria ter sido recusada').not.toBeNull();
  expect(error?.code, `recusada por outro motivo: ${error?.message}`).toBe('42501');
}

let a: Conta;
let b: Conta;
const sessaoDeA = `${EXERCICIO_DE_TESTE}-a-${carimbo}`;
const sessaoDeB = `${EXERCICIO_DE_TESTE}-b-${carimbo}`;

beforeAll(async () => {
  // Sobras de uma execução derrubada no meio saem antes de tudo.
  await removerTodasAsContasDeTeste();
  a = await criarConta('a');
  b = await criarConta('b');
});

// Rede de segurança: se algo acima derrubar a execução antes da última
// verificação, as contas saem mesmo assim.
afterAll(async () => {
  await removerTodasAsContasDeTeste();
});

describe('preparação', () => {
  it('as duas contas nascem com perfil de participante', async () => {
    // O gatilho do banco cria o perfil junto com o usuário (D21).
    expect(await papelNoBanco(a.id)).toBe('participante');
    expect(await papelNoBanco(b.id)).toBe('participante');
  });

  it('cada participante grava a própria sessão', async () => {
    // Controle positivo: a mesma forma de linha que as tentativas abaixo usam
    // é aceita quando o dono é quem grava. Sem isto, uma recusa lá embaixo
    // poderia ser da linha, e não da política.
    const deB = await b.cliente.from('sessoes').upsert(linhaDeSessao(sessaoDeB, b.id));
    expect(deB.error).toBeNull();
    const deA = await a.cliente.from('sessoes').upsert(linhaDeSessao(sessaoDeA, a.id));
    expect(deA.error).toBeNull();
    expect((await sessaoNoBanco(sessaoDeB))?.participante_id).toBe(b.id);
  });
});

describe('sessoes, autenticado como o participante A', () => {
  it('consultar a tabela inteira devolve só as linhas de A', async () => {
    const { data, error } = await a.cliente.from('sessoes').select('id, participante_id');
    expect(error).toBeNull();
    const linhas = data ?? [];
    // A presença da própria sessão impede que a verificação passe por vazio:
    // uma consulta que não devolvesse nada também "não mostraria" as de B.
    expect(linhas.map((l) => l.id)).toContain(sessaoDeA);
    expect(linhas.map((l) => l.id)).not.toContain(sessaoDeB);
    expect(linhas.filter((l) => l.participante_id !== a.id)).toEqual([]);
  });

  it('gravar uma sessão com o participante_id de B é recusado', async () => {
    const forjada = `${EXERCICIO_DE_TESTE}-forjada-${carimbo}`;
    const { error } = await a.cliente.from('sessoes').insert(linhaDeSessao(forjada, b.id));
    recusadaPeloRls(error);
    expect(await sessaoNoBanco(forjada)).toBeNull();
  });

  it('regravar a sessão de B pelo id é recusado', async () => {
    // O navegador grava por upsert (D21). Com o id da sessão de B e o próprio
    // participante_id, a inserção passaria no `with check` — é a política de
    // update, aplicada à linha que já existe, que precisa barrar.
    const { error } = await a.cliente
      .from('sessoes')
      .upsert({ ...linhaDeSessao(sessaoDeB, a.id), duracao_total_ms: 999 }, { onConflict: 'id' });
    recusadaPeloRls(error);
    expect(await sessaoNoBanco(sessaoDeB)).toMatchObject({
      participante_id: b.id,
      duracao_total_ms: 0,
    });
  });

  it('alterar a sessão de B não altera nada', async () => {
    // Controle positivo: a mesma alteração, na própria sessão, passa. Assim o
    // vazio de baixo é do RLS, e não de uma consulta malformada.
    const propria = await a.cliente
      .from('sessoes')
      .update({ duracao_total_ms: 1 })
      .eq('id', sessaoDeA)
      .select('id');
    expect(propria.error).toBeNull();
    expect(propria.data ?? []).toHaveLength(1);

    // Update barrado pelo RLS não é erro: a linha simplesmente não está ao
    // alcance, e a resposta volta vazia. É o banco que diz se algo mudou.
    const { data } = await a.cliente
      .from('sessoes')
      .update({ duracao_total_ms: 999 })
      .eq('id', sessaoDeB)
      .select('id');
    expect(data ?? []).toEqual([]);
    expect((await sessaoNoBanco(sessaoDeB))?.duracao_total_ms).toBe(0);
  });

  it('apagar a própria sessão não apaga nada', async () => {
    // Não há política de delete: dado de pesquisa não se apaga pelo navegador.
    const { data } = await a.cliente.from('sessoes').delete().eq('id', sessaoDeA).select('id');
    expect(data ?? []).toEqual([]);
    expect(await sessaoNoBanco(sessaoDeA)).not.toBeNull();
  });
});

// A mais importante de todas. Se um participante conseguir mudar o próprio
// papel para pesquisador, a política de leitura do pesquisador (D22) passa a
// valer para ele, e qualquer aluno lê as sessões da turma inteira — com o
// código que cada um escreveu.
describe('perfis, autenticado como o participante A', () => {
  it('alterar o próprio papel para pesquisador é recusado', async () => {
    const { data, error } = await a.cliente
      .from('perfis')
      .update({ papel: 'pesquisador' })
      .eq('id', a.id)
      .select('papel');
    if (error) recusadaPeloRls(error);
    else expect(data ?? []).toEqual([]);
    expect(await papelNoBanco(a.id)).toBe('participante');
  });

  it('regravar o próprio perfil como pesquisador é recusado', async () => {
    const { error } = await a.cliente
      .from('perfis')
      .upsert({ id: a.id, papel: 'pesquisador' }, { onConflict: 'id' });
    recusadaPeloRls(error);
    expect(await papelNoBanco(a.id)).toBe('participante');
  });

  it('consultar os perfis devolve só o de A', async () => {
    const { data, error } = await a.cliente.from('perfis').select('id');
    expect(error).toBeNull();
    expect((data ?? []).map((l) => l.id)).toEqual([a.id]);
  });

  it('depois das tentativas, A continua lendo só as próprias sessões', async () => {
    // A leitura é a consequência que importa. Se alguma das tentativas acima
    // tivesse promovido A por um caminho que a conferência do papel não viu,
    // é aqui que as sessões de B apareceriam.
    const { data } = await a.cliente.from('sessoes').select('participante_id');
    expect((data ?? []).filter((l) => l.participante_id !== a.id)).toEqual([]);
  });
});

describe('visitante sem sessão nenhuma', () => {
  // A chave pública sozinha, sem entrar: é o que qualquer pessoa que abra o
  // site e extraia a chave do pacote tem na mão.
  const visitante = createClient(url, chavePublica, semPersistencia);

  it('não lê sessões nem perfis', async () => {
    for (const tabela of ['sessoes', 'perfis']) {
      const { data, error } = await visitante.from(tabela).select('*');
      if (error) recusadaPeloRls(error);
      else expect(data ?? [], tabela).toEqual([]);
    }
  });

  it('não grava sessão', async () => {
    const { error } = await visitante
      .from('sessoes')
      .insert(linhaDeSessao(`${EXERCICIO_DE_TESTE}-visitante-${carimbo}`, a.id));
    recusadaPeloRls(error);
  });
});

describe('limpeza', () => {
  it('não deixa resíduo no banco do estudo', async () => {
    await removerTodasAsContasDeTeste();

    expect(await contasDeTesteNoProjeto(), 'contas de teste').toEqual([]);
    if (criadas.length > 0) {
      const perfis = await linhasNoBanco(admin.from('perfis').select('id').in('id', criadas));
      expect(perfis, 'perfis das contas de teste').toEqual([]);
    }
    // Pelo exercício, e não só pelas contas: pega também a linha que tivesse
    // escapado de uma recusa e ficado sob outra identidade.
    const sessoes = await linhasNoBanco(
      admin.from('sessoes').select('id').eq('exercicio_id', EXERCICIO_DE_TESTE)
    );
    expect(sessoes, 'sessões de teste').toEqual([]);
  });
});
