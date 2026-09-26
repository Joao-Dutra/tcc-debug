import { supabase } from './cliente';
import { definirParticipante } from '../nucleo/metricas';
import type { AuthError, Session, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Identidade (D21, D29).
 *
 * O aluno é só anônimo: o primeiro acesso entra sem pedir nada, e a
 * identidade fica guardada no aparelho, que é o que agrupa as sessões de uma
 * pessoa. Não há conta de aluno nem vínculo nenhum (D29). Mais da metade das
 * sessões dos dois pilotos foi abandonada sem ação nenhuma, e qualquer pedido
 * de cadastro na porta agravaria isso. Por isso a entrada anônima é
 * automática e não bloqueia: a tela abre enquanto ela acontece.
 *
 * Google e e-mail e senha são a entrada do professor, e o pesquisador entra
 * por e-mail e senha no painel (D22). Nenhuma das duas vincula ao anônimo do
 * aparelho: cada conta é uma identidade própria.
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
 * Google, para o professor (D29). **Nunca vincula** ao anônimo do aparelho: o
 * professor entra numa conta própria, e as sessões anônimas que estavam aqui
 * ficam com o anônimo. Vincular levaria para a conta dele as sessões de quem
 * usou o aparelho antes — a mesma razão pela qual o pesquisador nunca
 * vinculou (D22).
 *
 * `destino` é para onde o navegador volta depois do Google. O código de
 * retorno chega na consulta (`?code=`, fluxo PKCE) e o destino fica no hash,
 * então os dois convivem no mesmo endereço (D8). O endereço precisa estar na
 * lista de retorno do projeto Supabase.
 */
export async function entrarComGoogle(destino: string): Promise<ResultadoDeEntrada> {
  const cliente = supabase();
  if (!cliente) return SEM_BANCO;

  const { error } = await cliente.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${window.location.pathname}${destino}` },
  });
  return error ? registrarFalha(error) : { erro: null };
}

export interface ResultadoDoCadastro extends ResultadoDeEntrada {
  /**
   * O projeto pede confirmação por e-mail: a conta existe, mas só entra depois
   * de o professor clicar no link. A tela precisa dizer isso, e não parecer
   * que nada aconteceu.
   */
  confirmarPorEmail: boolean;
}

/**
 * Conta nova com e-mail e senha, para o professor (D29). Também **nunca
 * vincula**: é `signUp`, que cria outro usuário, e não `updateUser`, que
 * promoveria o anônimo do aparelho. A conta nasce como participante, como todo
 * perfil (D21), e o papel professor é concedido à mão.
 */
export async function criarContaDeProfessor(
  email: string,
  senha: string
): Promise<ResultadoDoCadastro> {
  const cliente = supabase();
  if (!cliente) return { ...SEM_BANCO, confirmarPorEmail: false };

  const { data, error } = await cliente.auth.signUp({ email, password: senha });
  if (error) return { ...registrarFalha(error), confirmarPorEmail: false };
  // Sem sessão depois do cadastro é o projeto pedindo confirmação.
  return { erro: null, confirmarPorEmail: !data.session };
}

/**
 * E-mail e senha de conta que já existe: a do professor e a do pesquisador.
 * Não vincula, e não tem como: entrar numa conta existente troca de
 * identidade, e as sessões anônimas deste aparelho ficam com o anônimo.
 */
export async function entrarComSenha(email: string, senha: string): Promise<ResultadoDeEntrada> {
  const cliente = supabase();
  if (!cliente) return SEM_BANCO;

  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  return error ? registrarFalha(error) : { erro: null };
}

/**
 * Sai da conta e volta na hora a uma identidade anônima NOVA (D22).
 *
 * Sair sem isso deixaria o aparelho sem identidade até recarregar, e o
 * contrário — não sair — é pior: o pesquisador que entra no computador do
 * laboratório e o entrega a um participante faria as sessões dele serem
 * gravadas sob a conta do pesquisador, misturadas e inseparáveis. Anônimo
 * novo, e não o anterior: o anterior pode ter sido de outra pessoa.
 */
export async function sair(): Promise<void> {
  const cliente = supabase();
  if (!cliente) return;
  await cliente.auth.signOut();
  const { data, error } = await cliente.auth.signInAnonymously();
  if (error) {
    anunciar({ ...SEM_IDENTIDADE, falha: descrever(error) });
    return;
  }
  await aplicarSessao(cliente, data.session);
}
