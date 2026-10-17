import { useCallback, useEffect, useState } from 'react';
import { lerDadosDoEstudo } from '../supabase/estudo';
import type { DadosDoEstudo } from '../supabase/estudo';

export interface LeituraDoEstudo {
  carregando: boolean;
  /** Nulo até a primeira leitura concluir. */
  dados: DadosDoEstudo | null;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Aplicações, participantes e respostas do estudo para o painel (D37), só
 * quando `ativa`. Como a leitura das sessões, não relê sozinha: o pesquisador
 * recarrega as duas pelo mesmo botão.
 *
 * Separada da leitura das sessões porque falha por conta própria: num projeto
 * sem a migração 0004, o painel continua mostrando as sessões, e só o CSV do
 * estudo fica indisponível.
 */
export function useDadosDoEstudo(ativa: boolean): LeituraDoEstudo {
  const [dados, setDados] = useState<DadosDoEstudo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pedido, setPedido] = useState(0);

  useEffect(() => {
    if (!ativa) return;
    let valida = true;
    setCarregando(true);
    setErro(null);
    lerDadosDoEstudo()
      .then((lidos) => {
        if (valida) setDados(lidos);
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

  return { carregando, dados: ativa ? dados : null, erro: ativa ? erro : null, recarregar };
}
