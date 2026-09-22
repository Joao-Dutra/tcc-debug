import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INTERVALO_ENTRE_LOCALIZACOES_MS,
  arquivarSessao,
  criarSessao,
  localizacoesDe,
} from '../nucleo/metricas';
import type {
  EventoDeLocalizacao,
  ExecucaoDisparada,
  OrigemDaExecucao,
  Sessao,
} from '../nucleo/metricas';
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

  // Intervalo entre tentativas (D25). Quem decide se um clique é julgado é o
  // núcleo; isto só acompanha, para a tela dizer que é preciso esperar. A
  // rodada muda a cada tentativa julgada, e é o que faz a barra recomeçar.
  const [emIntervalo, setEmIntervalo] = useState(false);
  const [rodadaDoIntervalo, setRodadaDoIntervalo] = useState(0);
  const fimDoIntervalo = useRef<number | undefined>(undefined);

  const esperar = useCallback((ms: number) => {
    window.clearTimeout(fimDoIntervalo.current);
    setEmIntervalo(true);
    fimDoIntervalo.current = window.setTimeout(() => setEmIntervalo(false), ms);
  }, []);

  useEffect(() => () => window.clearTimeout(fimDoIntervalo.current), []);

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

  // Sair do exercício encerra a sessão. Uma execução ainda no Worker fica
  // gravada como interrompida, com o código que foi executado (D23): sem
  // isso, o resultado que chegasse depois cairia numa sessão já arquivada, e
  // a execução sumiria — justamente a do laço infinito de quem desistiu.
  useEffect(
    () => () => {
      sessao.current?.interromperExecucoesEmCurso();
      arquivarRetrato();
    },
    [arquivarRetrato]
  );

  // Recarregar ou fechar a aba não desmonta a tela — o React não roda o cleanup
  // quando a página vai embora —, e sem isto a sessão em curso seria justamente
  // a única que o espelho (D15) não salvaria. `pagehide`, e não `beforeunload`,
  // porque dispara também quando o navegador guarda a página em cache; se ela
  // voltar, o arquivamento seguinte atualiza o mesmo registro pelo id. Pela
  // mesma razão este não interrompe a execução em curso: se a página voltar,
  // o resultado ainda chega. O retrato tirado aqui já a traz como
  // interrompida, que é o que fica se a página não voltar.
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

  // Registrada no disparo, e não quando o resultado volta (D23): o que o
  // estudante fez foi clicar, e o Worker pode não responder a tempo de a
  // sessão ainda estar aberta.
  const iniciarExecucao = useCallback(
    (origem: OrigemDaExecucao, codigo: string): ExecucaoDisparada | null => {
      // Fecha a rajada antes: quem digita e clica em Executar em seguida precisa
      // aparecer no log nessa ordem, e não com a edição depois da execução.
      fecharRajada();
      return sessao.current?.iniciarExecucao(origem, codigo) ?? null;
    },
    [fecharRajada]
  );

  const concluirExecucao = useCallback(
    (execucao: ExecucaoDisparada | null, resultado: ResultadoExecucao) => {
      if (execucao !== null) sessao.current?.concluirExecucao(execucao, resultado);
    },
    []
  );

  const registrarDica = useCallback((indice: number) => {
    sessao.current?.registrarDica(indice);
  }, []);

  const declararLocalizacao = useCallback(
    (linha: number) => {
      // Mesma razão da execução: uma edição em curso vem antes do palpite na
      // sequência, senão a ordem da estratégia sai trocada no registro.
      fecharRajada();
      const declaracao = sessao.current?.registrarLocalizacao(linha);
      if (!declaracao) return;
      if (!declaracao.julgada) {
        // O núcleo é quem manda: se ele ainda conta o intervalo, a tela volta
        // a mostrar a espera pelo que falta, sem recomeçar a barra.
        esperar(declaracao.restanteMs);
        return;
      }
      const registro = sessao.current?.registro();
      setLocalizacoes(registro ? localizacoesDe(registro.eventos) : []);
      setRodadaDoIntervalo((n) => n + 1);
      esperar(INTERVALO_ENTRE_LOCALIZACOES_MS);
    },
    [fecharRajada, esperar]
  );

  return {
    iniciarExecucao,
    concluirExecucao,
    registrarEdicao,
    registrarDica,
    declararLocalizacao,
    localizacoes,
    emIntervalo,
    rodadaDoIntervalo,
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
