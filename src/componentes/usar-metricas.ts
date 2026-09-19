import { useCallback, useEffect, useRef, useState } from 'react';
import {
  arquivarSessao,
  criarSessao,
  localizacoesDe,
} from '../nucleo/metricas';
import type { EventoDeLocalizacao, OrigemDaExecucao, Sessao } from '../nucleo/metricas';
import type { ResultadoExecucao } from '../nucleo/tipos';

/**
 * Liga o gravador de métricas ao ciclo de vida do React, no mesmo espírito do
 * useReprodutor: o núcleo não sabe que existe React, o hook faz a ponte.
 */

/** Silêncio de digitação que fecha uma rajada de edição. */
const PAUSA_DA_RAJADA_MS = 2000;

export function useMetricas(exercicioId: string, linhaDoDefeito: number, andaime: string) {
  // Criada uma única vez: o instante de início é o instante em que o estudante
  // passou a encarar o exercício, não o de um render qualquer.
  const sessao = useRef<Sessao | null>(null);
  if (sessao.current === null) {
    sessao.current = criarSessao({ exercicioId, linhaDoDefeito, andaime });
  }

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

  // Arquiva o retrato atual da sessão. Os dois passos juntos, nessa ordem: uma
  // rajada em andamento é uma edição que aconteceu de verdade e precisa entrar
  // no log antes do retrato.
  const arquivarRetrato = useCallback(() => {
    fecharRajada();
    if (sessao.current) arquivarSessao(sessao.current.registro());
  }, [fecharRajada]);

  // Sair do exercício encerra a sessão.
  useEffect(() => arquivarRetrato, [arquivarRetrato]);

  // Recarregar ou fechar a aba não desmonta a tela — o React não roda o cleanup
  // quando a página vai embora —, e sem isto a sessão em curso seria justamente
  // a única que o espelho (D15) não salvaria. `pagehide`, e não `beforeunload`,
  // porque dispara também quando o navegador guarda a página em cache; se ela
  // voltar, o arquivamento seguinte atualiza o mesmo registro pelo id.
  useEffect(() => {
    window.addEventListener('pagehide', arquivarRetrato);
    return () => window.removeEventListener('pagehide', arquivarRetrato);
  }, [arquivarRetrato]);

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

  return {
    registrarExecucao,
    registrarEdicao,
    registrarDica,
    declararLocalizacao,
    localizacoes,
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
