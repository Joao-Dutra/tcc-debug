import { useLayoutEffect, useSyncExternalStore } from 'react';
import { aplicarTema, assinarTema, temaDaTela, temaEscolhido } from './tema';
import type { Tema } from './tema';

/** O tema escolhido nesta aba, para o seletor. */
export function useTemaEscolhido(): Tema {
  return useSyncExternalStore(assinarTema, temaEscolhido);
}

/**
 * Põe na raiz o tema que vale na tela: o escolhido, ou o padrão na área do
 * estudo (D39). Antes da pintura, para a troca de tela não piscar no tema
 * errado.
 */
export function useTemaDaTela(tela: string): void {
  const escolhido = useTemaEscolhido();
  useLayoutEffect(() => {
    aplicarTema(document.documentElement, temaDaTela(tela, escolhido));
  }, [tela, escolhido]);
}
