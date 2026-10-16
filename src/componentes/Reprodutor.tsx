import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/20/solid';
import type { GestoDeNavegacao, MotivoDaParada } from '../nucleo/metricas';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Quem quer saber o que o estudante fez no reprodutor (D36). Os passos chegam
 * contados a partir de 1, como o contador da tela os mostra.
 *
 * O reprodutor só avisa; quem decide o que vira registro, e como juntar os
 * movimentos de um arrasto, é quem escuta.
 */
export interface ObservadorDoReprodutor {
  navegou(gesto: GestoDeNavegacao, de: number, para: number, total: number): void;
  parou(motivo: MotivoDaParada, de: number, para: number, total: number): void;
  /** O ponteiro soltou a barra: o arrasto acabou, mesmo sem pausa depois. */
  soltouBarra(): void;
}

/**
 * Controla a posição atual na sequência de instantâneos.
 *
 * O reprodutor é o único lugar da aplicação que decide "qual passo está sendo
 * mostrado". Visualizadores apenas recebem o instantâneo já escolhido.
 */
export function useReprodutor(instantaneos: Instantaneo[], observador?: ObservadorDoReprodutor) {
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Espelhos do estado para quem é chamado fora do render — o temporizador da
  // reprodução e os avisos —, que leriam valores velhos no fechamento.
  const indiceAtual = useRef(0);
  const tocandoAgora = useRef(false);
  /** Onde a reprodução em curso começou: é o `de` da pausa que a fechar. */
  const inicioDoTrecho = useRef(0);
  const exibidos = useRef(instantaneos);
  const ouvinte = useRef(observador);
  useEffect(() => {
    ouvinte.current = observador;
  });

  const total = instantaneos.length;

  const mover = (i: number) => {
    indiceAtual.current = i;
    setIndice(i);
  };

  const definirTocando = (valor: boolean) => {
    tocandoAgora.current = valor;
    setTocando(valor);
  };

  useEffect(() => {
    // Um resultado novo substitui o que estava tocando. Não é gesto, mas sem
    // este aviso o trecho assistido ficaria sem fim no registro.
    if (tocandoAgora.current && exibidos.current !== instantaneos) {
      ouvinte.current?.parou(
        'nova-execucao',
        inicioDoTrecho.current + 1,
        indiceAtual.current + 1,
        exibidos.current.length
      );
    }
    // E o arrasto do resultado anterior acaba aqui.
    ouvinte.current?.soltouBarra();
    exibidos.current = instantaneos;
    mover(0);
    definirTocando(false);
  }, [instantaneos]);

  useEffect(() => {
    if (!tocando) return;
    timer.current = window.setInterval(() => {
      const i = indiceAtual.current;
      if (i >= instantaneos.length - 1) {
        definirTocando(false);
        ouvinte.current?.parou('fim', inicioDoTrecho.current + 1, i + 1, instantaneos.length);
        return;
      }
      mover(i + 1);
    }, 600);
    return () => window.clearInterval(timer.current);
  }, [tocando, instantaneos.length]);

  /** Um passo dado à mão; durante a reprodução, o trecho recomeça dali. */
  const irA = (gesto: 'avancar' | 'voltar' | 'arrastar', para: number) => {
    const de = indiceAtual.current;
    mover(para);
    if (tocandoAgora.current) inicioDoTrecho.current = para;
    ouvinte.current?.navegou(gesto, de + 1, para + 1, total);
  };

  return {
    indice,
    tocando,
    atual: instantaneos[indice],
    total,
    irPara: (i: number) => irA('arrastar', i),
    avancar: () => irA('avancar', Math.min(indiceAtual.current + 1, total - 1)),
    voltar: () => irA('voltar', Math.max(indiceAtual.current - 1, 0)),
    alternar: () => {
      const passo = indiceAtual.current + 1;
      if (tocandoAgora.current) {
        definirTocando(false);
        ouvinte.current?.navegou('pausar', inicioDoTrecho.current + 1, passo, total);
      } else {
        inicioDoTrecho.current = indiceAtual.current;
        definirTocando(true);
        ouvinte.current?.navegou('tocar', passo, passo, total);
      }
    },
    soltarBarra: () => ouvinte.current?.soltouBarra(),
  };
}

interface Props {
  reprodutor: ReturnType<typeof useReprodutor>;
}

export function ControlesReprodutor({ reprodutor }: Props) {
  const { indice, total, tocando, avancar, voltar, alternar, irPara, soltarBarra } = reprodutor;
  if (total === 0) return null;

  return (
    <div className="controles">
      {/* Ícones em SVG do pacote Heroicons, embutidos no build, e não glifos:
          glifo depende da fonte instalada na máquina (D13) e muda de tamanho
          de uma para outra. Sem texto visível, o nome de cada botão vai no
          aria-label. */}
      <button onClick={voltar} disabled={indice === 0} aria-label="passo anterior">
        <ChevronLeftIcon className="icone" aria-hidden="true" />
      </button>
      <button className="primario" onClick={alternar} aria-label={tocando ? 'pausar' : 'tocar'}>
        {tocando ? (
          <PauseIcon className="icone" aria-hidden="true" />
        ) : (
          <PlayIcon className="icone" aria-hidden="true" />
        )}
      </button>
      <button onClick={avancar} disabled={indice >= total - 1} aria-label="próximo passo">
        <ChevronRightIcon className="icone" aria-hidden="true" />
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(total - 1, 0)}
        value={indice}
        onChange={(e) => irPara(Number(e.target.value))}
        onPointerUp={soltarBarra}
      />
      <span className="contador">
        passo {indice + 1} / {total}
      </span>
    </div>
  );
}
