import { useCallback, useEffect, useRef, useState } from 'react';
import {
  arquivarSessao,
  criarSessao,
  exportarSessoes,
  localizacoesDe,
  sessoesArquivadas,
} from '../nucleo/metricas';
import type { EventoDeLocalizacao, OrigemDaExecucao, Sessao } from '../nucleo/metricas';
import type { ResultadoExecucao } from '../nucleo/tipos';

/**
 * Liga o gravador de métricas ao ciclo de vida do React, no mesmo espírito do
 * useReprodutor: o núcleo não sabe que existe React, o hook faz a ponte.
 */

/** Silêncio de digitação que fecha uma rajada de edição. */
const PAUSA_DA_RAJADA_MS = 2000;

export function useMetricas(exercicioId: string, linhaDoDefeito: number) {
  // Criada uma única vez: o instante de início é o instante em que o estudante
  // passou a encarar o exercício, não o de um render qualquer.
  const sessao = useRef<Sessao | null>(null);
  if (sessao.current === null) sessao.current = criarSessao({ exercicioId, linhaDoDefeito });

  const temporizador = useRef<number | undefined>(undefined);
  const rascunho = useRef<string | null>(null);

  // Espelho das tentativas para a tela poder redesenhar. É preenchido lendo o
  // log da sessão, nunca montado à parte: o log é a única versão do dado.
  const [localizacoes, setLocalizacoes] = useState<EventoDeLocalizacao[]>([]);

  const fecharRajada = useCallback(() => {
    window.clearTimeout(temporizador.current);
    temporizador.current = undefined;
    if (rascunho.current !== null) {
      sessao.current?.registrarEdicao(rascunho.current);
      rascunho.current = null;
    }
  }, []);

  // Sair do exercício encerra a sessão. Os dois passos ficam no mesmo cleanup
  // para garantir a ordem: uma rajada em andamento é uma edição que aconteceu
  // de verdade e precisa entrar no log antes do retrato final.
  useEffect(
    () => () => {
      fecharRajada();
      if (sessao.current) arquivarSessao(sessao.current.registro());
    },
    [fecharRajada]
  );

  const registrarEdicao = useCallback(
    (codigo: string) => {
      rascunho.current = codigo;
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(fecharRajada, PAUSA_DA_RAJADA_MS);
    },
    [fecharRajada]
  );

  const registrarExecucao = useCallback(
    (origem: OrigemDaExecucao, codigo: string, resultado: ResultadoExecucao) => {
      // Fecha a rajada antes: quem digita e clica em Executar em seguida precisa
      // aparecer no log nessa ordem, e não com a edição depois da execução.
      fecharRajada();
      sessao.current?.registrarExecucao(origem, codigo, resultado);
    },
    [fecharRajada]
  );

  const registrarDica = useCallback((indice: number) => {
    sessao.current?.registrarDica(indice);
  }, []);

  const declararLocalizacao = useCallback(
    (linha: number) => {
      // Mesma razão da execução: uma edição em curso vem antes do palpite na
      // sequência, senão a ordem da estratégia sai trocada no registro.
      fecharRajada();
      sessao.current?.registrarLocalizacao(linha);
      const registro = sessao.current?.registro();
      setLocalizacoes(registro ? localizacoesDe(registro.eventos) : []);
    },
    [fecharRajada]
  );

  // Arquiva antes de exportar em vez de concatenar: como arquivar é idempotente
  // por id, existe um caminho só para montar a lista e nenhuma sessão sai
  // duplicada nem de fora.
  const exportar = useCallback(() => {
    fecharRajada();
    if (sessao.current) arquivarSessao(sessao.current.registro());
    return exportarSessoes(sessoesArquivadas());
  }, [fecharRajada]);

  return {
    registrarExecucao,
    registrarEdicao,
    registrarDica,
    declararLocalizacao,
    localizacoes,
    exportar,
  };
}

/** Entrega o JSON como arquivo. Vive aqui porque mexe no DOM. */
export function baixarMetricas(json: string, nomeDoArquivo: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeDoArquivo;
  link.click();
  // Revogar na hora aborta o download em alguns navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
