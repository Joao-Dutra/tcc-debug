import { instrumentar } from './instrumentar';
import type { ResultadoExecucao } from './tipos';

/**
 * O Worker rodando em Node, para os testes do núcleo.
 *
 * Não é código da aplicação: existe para que os testes exercitem exatamente o
 * mesmo arquivo que roda no navegador, em vez de uma reimplementação que pode
 * divergir dele sem ninguém notar. O Worker registra o manipulador em `self`
 * quando é importado; em Node não há `self`, então um de mentira recebe o
 * manipulador e devolve a resposta.
 */

export interface PedidoDeTeste {
  codigo: string;
  variaveisObservadas: string[];
  marcadores?: string[];
  casos?: { descricao: string; expressao: string; esperado: unknown }[];
}

export type RodarNoWorker = (pedido: PedidoDeTeste) => ResultadoExecucao;

/** Importa o Worker uma vez e devolve como pedir uma execução a ele. */
export async function abrirWorker(): Promise<RodarNoWorker> {
  let saida: ResultadoExecucao | null = null;
  const falso: {
    onmessage: ((evento: { data: unknown }) => void) | null;
    postMessage: (mensagem: ResultadoExecucao) => void;
  } = {
    onmessage: null,
    postMessage: (mensagem) => {
      saida = mensagem;
    },
  };
  (globalThis as unknown as { self: typeof falso }).self = falso;
  await import('./executor.worker');

  return (pedido) => {
    saida = null;
    falso.onmessage?.({
      data: { ...pedido, codigo: instrumentar(pedido.codigo), casos: pedido.casos ?? [] },
    });
    if (saida === null) throw new Error('o Worker não respondeu');
    return saida;
  };
}
