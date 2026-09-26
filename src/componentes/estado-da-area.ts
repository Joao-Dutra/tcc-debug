import type { Identidade } from '../supabase/identidade';

/**
 * O que a área do professor mostra, decidido pela identidade (D29).
 *
 * Fora do componente para poder ser verificado sem navegador e sem banco: são
 * estes estados que separam quem pode escrever exercícios de quem ainda não
 * pode, e o de quem entrou sem o papel precisa dizer que aguarda liberação —
 * uma área vazia pareceria defeito.
 */
export type EstadoDaArea =
  /** Sem chaves do Supabase: a área guarda tudo no banco, e não funciona sem ele. */
  | 'sem-banco'
  /** Anônimo, ou sem identidade: é a entrada, com Google ou e-mail e senha. */
  | 'entrar'
  /** Entrou numa conta, e o papel ainda está sendo lido de `perfis`. */
  | 'conferindo'
  | 'professor'
  /** O pesquisador revisa e publica, mas não escreve por aqui (D31). */
  | 'pesquisador'
  /** Entrou, mas o perfil ainda é de participante: a liberação é à mão. */
  | 'aguardando';

export function estadoDaArea(identidade: Identidade, bancoConfigurado: boolean): EstadoDaArea {
  if (!bancoConfigurado) return 'sem-banco';
  // O aluno anônimo que chega aqui não tem nada a fazer além de entrar: ser
  // anônimo nunca dá acesso à área, qualquer que seja o papel lido.
  if (identidade.forma !== 'google' && identidade.forma !== 'email') return 'entrar';
  if (identidade.papel === null || identidade.usuarioId === null) return 'conferindo';
  if (identidade.papel === 'professor') return 'professor';
  if (identidade.papel === 'pesquisador') return 'pesquisador';
  return 'aguardando';
}
