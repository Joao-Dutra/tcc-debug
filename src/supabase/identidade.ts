import { supabase } from './cliente';
import { definirParticipante } from '../nucleo/metricas';
import type { AuthError, Session, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Identidade do participante (D21).
 *
 * Três formas, e uma ordem entre elas: o primeiro acesso entra anônimo sem
 * pedir nada, e Google ou e-mail e senha podem ser VINCULADOS depois àquele
 * mesmo anônimo. Vincular preserva o `uid`, e como é o `uid` que é dono das
 * linhas em `sessoes`, as sessões já gravadas naquele aparelho continuam sendo
 * da mesma pessoa — nenhuma migração de dado, nenhuma sessão órfã.
 *
 * Nenhuma dessas formas pode aparecer antes do primeiro exercício. Mais da
 * metade das sessões dos dois pilotos foi abandonada sem ação nenhuma, e
 * qualquer pedido de cadastro na porta agravaria isso. Por isso a entrada
 * anônima é automática e não bloqueia: a tela abre enquanto ela acontece.
 *
 * Conta de teste compartilhada não existe aqui, por decisão: duas pessoas sob
 * o mesmo `uid` viram sessões indistinguíveis na análise, e o dado não se
 * separa depois.
 */

export type FormaDeIdentidade = 'nenhuma' | 'anonima' | 'google' | 'email';

export type Papel = 'participante' | 'professor' | 'pesquisador';

export interface Identidade {
  usuarioId: string | null;
  forma: FormaDeIdentidade;
  email: string | null;
  /** Lido de `perfis`; nulo enquanto não chegou ou se a leitura falhou. */
  papel: Papel | null;
  /** Última falha de autenticação, para a interface poder dizer o que houve. */
  falha: string | null;
}

const SEM_IDENTIDADE: Identidade = {
  usuarioId: null,
  forma: 'nenhuma',
  email: null,
  papel: null,
  falha: null,
};

let atual: Identidade = SEM_IDENTIDADE;
const ouvintes = new Set<(identidade: Identidade) => void>();

export function identidadeAtual(): Identidade {
  return atual;
}

export function observarIdentidade(ouvinte: (identidade: Identidade) => void): () => void {
  ouvintes.add(ouvinte);
  ouvinte(atual);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function anunciar(identidade: Identidade): void {
  atual = identidade;
  // O núcleo passa a carimbar os registros com este id. Nulo é valor legítimo:
  // sem banco configurado, a coleta continua local e sem identidade.
  definirParticipante(identidade.usuarioId);
  for (const ouvinte of ouvintes) ouvinte(identidade);
}

/**
 * Deriva a forma do que o próprio provedor diz, e não de uma marca nossa: é o
 * mesmo dado que o banco enxerga, e os dois não podem divergir.
 */
export function formaDoUsuario(usuario: User | null): FormaDeIdentidade {
  if (!usuario) return 'nenhuma';
  if (usuario.is_anonymous) return 'anonima';
  const provedores: string[] = usuario.app_metadata?.providers ?? [];
  if (provedores.includes('google')) return 'google';
  return 'email';
}

async function lerPapel(cliente: SupabaseClient, usuarioId: string): Promise<Papel | null> {
  // O gatilho do banco cria o perfil junto com o usuário. Se a leitura falhar
  // por rede, o papel fica nulo e nada mais acontece: papel não governa nada
  // do que o participante vê — só a leitura ampla do pesquisador, e essa é
  // decidida no banco, pelo RLS, não aqui.
  const { data, error } = await cliente.from('perfis').select('papel').eq('id', usuarioId).single();
  if (error || !data) return null;
  return data.papel as Papel;
}

async function aplicarSessao(cliente: SupabaseClient, sessao: Session | null): Promise<void> {
  const usuario = sessao?.user ?? null;
  if (!usuario) {
    anunciar({ ...SEM_IDENTIDADE });
    return;
  }
  // Anuncia antes de ir buscar o papel: o identificador é o que a coleta
  // precisa, e ele já está aqui. Esperar a segunda ida à rede atrasaria o
  // carimbo das sessões à toa.
  anunciar({
    usuarioId: usuario.id,
    forma: formaDoUsuario(usuario),
    email: usuario.email ?? null,
    papel: null,
    falha: null,
  });
  const papel = await lerPapel(cliente, usuario.id);
  // Outra mudança de autenticação pode ter chegado enquanto o papel vinha; se
  // chegou, este papel é de outra pessoa e não se aplica mais.
  if (atual.usuarioId === usuario.id) anunciar({ ...atual, papel });
}

const descrever = (erro: AuthError) => erro.message;

/**
 * Chamada uma vez, antes da primeira tela, e sem ser esperada: recupera a
 * identidade guardada no navegador ou cria a anônima.
 *
 * Nunca lança. Sem rede, sem chaves ou com o Supabase fora do ar, a aplicação
 * segue gravando só no aparelho, como antes de D21.
 */
export async function iniciarIdentidade(): Promise<Identidade> {
  const cliente = supabase();
  if (!cliente) return atual;

  // Toda mudança de autenticação passa por aqui, inclusive a volta do login
  // com Google e a renovação do token — assim existe um caminho só que
  // atualiza a identidade, em vez de um por forma de entrada.
  cliente.auth.onAuthStateChange((_evento, sessao) => {
    void aplicarSessao(cliente, sessao);
  });

  try {
    const { data } = await cliente.auth.getSession();
    if (data.session) {
      await aplicarSessao(cliente, data.session);
      return atual;
    }
    const { data: nova, error } = await cliente.auth.signInAnonymously();
    if (error) {
      anunciar({ ...SEM_IDENTIDADE, falha: descrever(error) });
      return atual;
    }
    await aplicarSessao(cliente, nova.session);
  } catch (e) {
    anunciar({ ...SEM_IDENTIDADE, falha: e instanceof Error ? e.message : String(e) });
  }
  return atual;
}

export interface ResultadoDeEntrada {
  erro: string | null;
}

const SEM_BANCO: ResultadoDeEntrada = {
  erro: 'O banco não está configurado nesta instalação.',
};

function registrarFalha(erro: AuthError): ResultadoDeEntrada {
  anunciar({ ...atual, falha: descrever(erro) });
  return { erro: descrever(erro) };
}

/**
 * Google. Sobre um anônimo, VINCULA: o `uid` continua o mesmo depois, e as
 * sessões daquele aparelho seguem sendo da pessoa. Sem anônimo em curso — caso
 * raro, em que a entrada anônima falhou —, entra normalmente, e aí a
 * identidade é nova mesmo.
 */
export async function entrarComGoogle(): Promise<ResultadoDeEntrada> {
  const cliente = supabase();
  if (!cliente) return SEM_BANCO;

  const options = { redirectTo: window.location.origin };
  const { error } =
    atual.forma === 'anonima'
      ? await cliente.auth.linkIdentity({ provider: 'google', options })
      : await cliente.auth.signInWithOAuth({ provider: 'google', options });
  return error ? registrarFalha(error) : { erro: null };
}

/**
 * E-mail e senha, primeira vez. Sobre um anônimo é `updateUser`, que promove
 * aquele mesmo usuário a permanente em vez de criar outro — de novo, mesmo
 * `uid`, mesmas sessões.
 */
export async function criarContaComSenha(
  email: string,
  senha: string
): Promise<ResultadoDeEntrada> {
  const cliente = supabase();
  if (!cliente) return SEM_BANCO;

  if (atual.forma === 'anonima') {
    const { error } = await cliente.auth.updateUser({ email, password: senha });
    return error ? registrarFalha(error) : { erro: null };
  }
  const { error } = await cliente.auth.signUp({ email, password: senha });
  return error ? registrarFalha(error) : { erro: null };
}

/**
 * E-mail e senha de conta que já existe. Não vincula, e não tem como: entrar
 * numa conta existente troca de identidade, e as sessões anônimas deste
 * aparelho ficam com o anônimo. É por isso que vincular acontece antes de
 * haver outra conta, e não depois.
 */
export async function entrarComSenha(email: string, senha: string): Promise<ResultadoDeEntrada> {
  const cliente = supabase();
  if (!cliente) return SEM_BANCO;

  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  return error ? registrarFalha(error) : { erro: null };
}

export async function sair(): Promise<void> {
  const cliente = supabase();
  if (!cliente) return;
  await cliente.auth.signOut();
}
