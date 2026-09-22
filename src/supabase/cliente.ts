import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase, ou nada (D21).
 *
 * As chaves vêm de variáveis de ambiente e podem simplesmente não existir —
 * é o caso de quem clona o repositório para estudar o código e de qualquer
 * execução de teste. Nesse caso a função devolve `null` e a aplicação inteira
 * segue funcionando como antes de D21, gravando só no aparelho: nenhuma tela
 * do estudante pode depender de haver banco.
 *
 * A chave anônima fica no pacote entregue ao navegador por desenho. Ela
 * identifica o projeto, não autoriza nada: quem autoriza é o RLS.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!url || !chave) return null;
  // Criado uma vez só: cada cliente abre a própria escuta de autenticação, e
  // dois deles brigariam pela renovação do mesmo token.
  cliente ??= createClient(url, chave, {
    auth: {
      // A identidade precisa sobreviver a recarregar a página, senão cada
      // carga criaria um anônimo novo e as sessões do mesmo aparelho ficariam
      // espalhadas por vários participantes inexistentes.
      persistSession: true,
      autoRefreshToken: true,
      // A volta do login com Google chega pela URL. O fluxo é PKCE, que
      // devolve o código na consulta (`?code=`) e não no fragmento: é o que
      // mantém o login compatível com a navegação por hash do projeto (D8).
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  });
  return cliente;
}

/** Para a tela poder dizer que está gravando só no aparelho. */
export function supabaseConfigurado(): boolean {
  return Boolean(url && chave);
}
