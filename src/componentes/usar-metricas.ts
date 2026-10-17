import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INTERVALO_ENTRE_LOCALIZACOES_MS,
  arquivarSessao,
  criarSessao,
  localizacoesDe,
} from '../nucleo/metricas';
import type {
  DesfechoDoTutorial,
  EventoDeLocalizacao,
  MarcaDoEstudo,
  MotivoDoEncerramento,
  MotivoDoTutorial,
  ExecucaoDisparada,
  OrigemDaExecucao,
  Sessao,
} from '../nucleo/metricas';
import type { Exercicio, ResultadoExecucao } from '../nucleo/tipos';
import type { ObservadorDoReprodutor } from './Reprodutor';

/**
 * Liga o gravador de métricas ao ciclo de vida do React, no mesmo espírito do
 * useReprodutor: o núcleo não sabe que existe React, o hook faz a ponte.
 */

/** Silêncio de digitação que fecha uma rajada de edição. */
const PAUSA_DA_RAJADA_MS = 2000;

/**
 * Parada da barra que fecha um arrasto (D36), quando o ponteiro não avisa que
 * soltou — as setas do teclado sobre a barra, por exemplo. Curta de
 * propósito: quem segura a barra parada por meio segundo já está olhando o
 * passo, e o movimento seguinte é outro gesto.
 */
const PAUSA_DO_ARRASTO_MS = 500;

/** A sessão aberta dentro do percurso do estudo (D37). */
export interface SessaoDoEstudo {
  marca: MarcaDoEstudo;
  /**
   * A identidade criada na entrada do percurso. Fixada na sessão, e não lida
   * no arquivamento: no fim do percurso o aparelho troca de identidade, e a
   * última sessão não pode sair com a do próximo participante.
   */
  participanteId: string | null;
}

/**
 * `gravar` falso é a pré-visualização do autor (D33): a sessão existe, para a
 * tela funcionar igual, mas nunca é arquivada — nem no aparelho, nem no banco.
 * O que um professor faz vendo o próprio exercício não é dado do estudo.
 */
export function useMetricas(
  exercicio: Exercicio,
  andaime: string,
  gravar = true,
  estudo?: SessaoDoEstudo
) {
  // Criada uma única vez: o instante de início é o instante em que o estudante
  // passou a encarar o exercício, não o de um render qualquer. Do exercício
  // saem o id, a origem (D31) e as linhas que julgam a localização (D7, D30) —
  // estas ficam no núcleo e não voltam para a tela.
  const sessao = useRef<Sessao | null>(null);
  if (sessao.current === null) {
    sessao.current = criarSessao({
      exercicioId: exercicio.id,
      origemDoExercicio: exercicio.origem ?? 'catalogo',
      linhaDoDefeito: exercicio.linhaDoDefeito,
      linhasAceitas: exercicio.linhasAceitas,
      andaime,
      ...(estudo ? { estudo: estudo.marca, participanteId: estudo.participanteId } : {}),
    });
  }

  // Encerrada pelo percurso do estudo (D37), a sessão já foi arquivada com o
  // encerramento como último evento, e nenhum retrato posterior a substitui:
  // o que acontecesse depois — a reprodução chegando ao fim por baixo da tela
  // de tempo esgotado — ficaria depois do fim.
  const encerrada = useRef(false);
  const temporizador = useRef<number | undefined>(undefined);
  const rascunho = useRef<string | null>(null);
  const fimDoArrasto = useRef<number | undefined>(undefined);

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

  useEffect(
    () => () => {
      window.clearTimeout(fimDoIntervalo.current);
      window.clearTimeout(fimDoArrasto.current);
    },
    []
  );

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
    if (encerrada.current) return;
    fecharRajada();
    if (gravar && sessao.current) arquivarSessao(sessao.current.registro());
  }, [fecharRajada, gravar]);

  // O fim da sessão no percurso do estudo: pelo botão de seguir ou pelo
  // prazo. Uma execução ainda no Worker fica como interrompida (D23).
  const encerrar = useCallback(
    (motivo: MotivoDoEncerramento) => {
      if (encerrada.current) return;
      fecharRajada();
      window.clearTimeout(fimDoArrasto.current);
      sessao.current?.registrarEncerramento(motivo);
      arquivarRetrato();
      encerrada.current = true;
    },
    [fecharRajada, arquivarRetrato]
  );

  // Sair do exercício encerra a sessão. Uma execução ainda no Worker fica
  // gravada como interrompida, com o código que foi executado (D23): ela entra
  // no log nessa forma no disparo, e é essa forma que o retrato leva — sem
  // isso, o resultado que chegasse depois cairia numa sessão já arquivada, e
  // a execução sumiria, justamente a do laço infinito de quem desistiu.
  //
  // O desmonte não interrompe a execução em curso. Arquivado o retrato, nada
  // mais arquiva esta sessão, e o retrato não muda por baixo de quem o
  // arquivou. Interromper aqui só teria efeito onde a tela remonta com a mesma
  // sessão — o StrictMode, em desenvolvimento —, e ali o efeito era errado: a
  // execução automática da abertura ficava interrompida para sempre.
  useEffect(() => () => arquivarRetrato(), [arquivarRetrato]);

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

  // O tutorial não muda nada do que é medido além de entrar no log (D32): o
  // tempo que ele toma fica na sessão, marcado pelos dois eventos.
  const registrarTutorialAberto = useCallback((motivo: MotivoDoTutorial) => {
    sessao.current?.registrarTutorialAberto(motivo);
  }, []);

  const registrarTutorialFechado = useCallback(
    (desfecho: DesfechoDoTutorial, passoAlcancado: number, totalDePassos: number) => {
      sessao.current?.registrarTutorialFechado(desfecho, passoAlcancado, totalDePassos);
    },
    []
  );

  // A navegação no reprodutor (D36). O núcleo junta os movimentos da barra num
  // arrasto só; aqui só se decide quando ele acabou. Estável entre renders, e
  // o reprodutor o lê por referência a cada aviso.
  const observadorDoReprodutor = useMemo<ObservadorDoReprodutor>(() => {
    const encerrarArrasto = () => {
      window.clearTimeout(fimDoArrasto.current);
      sessao.current?.encerrarArrasto();
    };
    return {
      navegou(gesto, de, para, total) {
        if (gesto === 'arrastar') {
          sessao.current?.moverBarra(de, para, total);
          window.clearTimeout(fimDoArrasto.current);
          fimDoArrasto.current = window.setTimeout(encerrarArrasto, PAUSA_DO_ARRASTO_MS);
          return;
        }
        sessao.current?.registrarNavegacao(gesto, de, para, total);
      },
      parou(motivo, de, para, total) {
        sessao.current?.registrarParada(motivo, de, para, total);
      },
      soltouBarra: encerrarArrasto,
    };
  }, []);

  return {
    encerrar,
    observadorDoReprodutor,
    registrarTutorialAberto,
    registrarTutorialFechado,
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

/**
 * Entrega o texto como arquivo — o JSON das sessões ou o CSV do estudo. Vive
 * aqui porque mexe no DOM. O Blob de uma string sai em UTF-8, sem BOM.
 */
export function baixarMetricas(texto: string, nomeDoArquivo: string, tipo = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeDoArquivo;
  link.click();
  // Revogar na hora aborta o download em alguns navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
