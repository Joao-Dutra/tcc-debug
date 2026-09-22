import { useCallback, useEffect, useState } from 'react';
import { lerSessoesDoBanco } from '../supabase/sessoes-remotas';
import type { RegistroDeSessao } from '../nucleo/metricas';

export interface SessoesDoBanco {
  carregando: boolean;
  /** Nulo até a primeira leitura concluir. */
  sessoes: RegistroDeSessao[] | null;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Leitura das sessões do banco para o painel (D22), só quando `ativa`.
 *
 * Não relê sozinha: o painel é instrumento de conferência, e uma tabela que se
 * reordena enquanto o pesquisador lê é pior do que um botão de recarregar.
 */
export function useSessoesDoBanco(ativa: boolean): SessoesDoBanco {
  const [sessoes, setSessoes] = useState<RegistroDeSessao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pedido, setPedido] = useState(0);

  useEffect(() => {
    if (!ativa) return;
    // Uma resposta que chega depois de o painel ter trocado de identidade, ou
    // de outra leitura ter sido pedida, é de uma pergunta que ninguém fez mais.
    let valida = true;
    setCarregando(true);
    setErro(null);
    lerSessoesDoBanco()
      .then((lidas) => {
        if (valida) setSessoes(lidas);
      })
      .catch((e: unknown) => {
        if (valida) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (valida) setCarregando(false);
      });
    return () => {
      valida = false;
    };
  }, [ativa, pedido]);

  const recarregar = useCallback(() => setPedido((n) => n + 1), []);

  return { carregando, sessoes: ativa ? sessoes : null, erro: ativa ? erro : null, recarregar };
}
