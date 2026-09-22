import { useSyncExternalStore } from 'react';
import { identidadeAtual, observarIdentidade } from '../supabase/identidade';
import type { Identidade } from '../supabase/identidade';

/**
 * Liga a identidade (D21) ao React, no mesmo espírito de useMetricas: quem
 * fala com o Supabase não sabe que existe React, e o hook faz a ponte.
 *
 * A identidade chega depois da primeira tela — a entrada anônima é uma ida à
 * rede —, então quem usa isto precisa aguentar `usuarioId` nulo por um
 * instante no começo.
 */
function assinar(avisar: () => void): () => void {
  return observarIdentidade(() => avisar());
}

export function useIdentidade(): Identidade {
  // A identidade é substituída inteira a cada mudança, nunca alterada no
  // lugar: é o que permite comparar por referência, como o React espera aqui.
  return useSyncExternalStore(assinar, identidadeAtual, identidadeAtual);
}
