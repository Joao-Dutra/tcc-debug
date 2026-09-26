import { describe, expect, it } from 'vitest';
import { estadoDaArea } from './estado-da-area';
import type { Identidade } from '../supabase/identidade';

/**
 * Os estados da área do professor (D29), verificados sem navegador.
 *
 * A regra que mais importa: entrar não concede nada. Uma conta sem o papel de
 * professor vê que aguarda liberação, e um anônimo nunca passa da entrada.
 */

const identidade = (mudancas: Partial<Identidade>): Identidade => ({
  usuarioId: 'uid',
  forma: 'email',
  email: 'prof@exemplo.br',
  papel: 'participante',
  falha: null,
  ...mudancas,
});

describe('o estado da área do professor', () => {
  it('sem banco, a área não funciona, e diz por quê', () => {
    expect(estadoDaArea(identidade({ papel: 'professor' }), false)).toBe('sem-banco');
  });

  it('o anônimo do aparelho vê a entrada', () => {
    expect(estadoDaArea(identidade({ forma: 'anonima', email: null }), true)).toBe('entrar');
  });

  it('sem identidade nenhuma, também a entrada', () => {
    expect(estadoDaArea(identidade({ forma: 'nenhuma', usuarioId: null }), true)).toBe('entrar');
  });

  it('o anônimo nunca passa da entrada, qualquer que seja o papel lido', () => {
    expect(estadoDaArea(identidade({ forma: 'anonima', papel: 'professor' }), true)).toBe('entrar');
  });

  it('conta aberta com o papel ainda por ler: conferindo', () => {
    expect(estadoDaArea(identidade({ papel: null }), true)).toBe('conferindo');
  });

  it('conta de participante — quem acabou de entrar — aguarda liberação', () => {
    expect(estadoDaArea(identidade({}), true)).toBe('aguardando');
    expect(estadoDaArea(identidade({ forma: 'google' }), true)).toBe('aguardando');
  });

  it('só o papel de professor abre a área', () => {
    expect(estadoDaArea(identidade({ papel: 'professor' }), true)).toBe('professor');
  });

  it('o pesquisador tem estado próprio: revisa, mas não escreve por aqui', () => {
    expect(estadoDaArea(identidade({ papel: 'pesquisador' }), true)).toBe('pesquisador');
  });
});
