import { useEffect, useRef, useState } from 'react';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Controla a posição atual na sequência de instantâneos.
 *
 * O reprodutor é o único lugar da aplicação que decide "qual passo está sendo
 * mostrado". Visualizadores apenas recebem o instantâneo já escolhido.
 */
export function useReprodutor(instantaneos: Instantaneo[]) {
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setIndice(0);
    setTocando(false);
  }, [instantaneos]);

  useEffect(() => {
    if (!tocando) return;
    timer.current = window.setInterval(() => {
      setIndice((i) => {
        if (i >= instantaneos.length - 1) {
          setTocando(false);
          return i;
        }
        return i + 1;
      });
    }, 600);
    return () => window.clearInterval(timer.current);
  }, [tocando, instantaneos.length]);

  return {
    indice,
    tocando,
    atual: instantaneos[indice],
    total: instantaneos.length,
    irPara: setIndice,
    avancar: () => setIndice((i) => Math.min(i + 1, instantaneos.length - 1)),
    voltar: () => setIndice((i) => Math.max(i - 1, 0)),
    alternar: () => setTocando((t) => !t),
  };
}

interface Props {
  reprodutor: ReturnType<typeof useReprodutor>;
}

export function ControlesReprodutor({ reprodutor }: Props) {
  const { indice, total, tocando, avancar, voltar, alternar, irPara } = reprodutor;
  if (total === 0) return null;

  return (
    <div className="controles">
      {/* Ícones em SVG, e não glifos: glifo depende da fonte instalada na
          máquina (D13) e muda de tamanho de uma para outra. Sem texto visível,
          o nome de cada botão vai no aria-label. */}
      <button onClick={voltar} disabled={indice === 0} aria-label="passo anterior">
        <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true">
          <path d="M9 0 L9 10 L1 5 Z" fill="currentColor" />
        </svg>
      </button>
      <button className="primario" onClick={alternar} aria-label={tocando ? 'pausar' : 'tocar'}>
        <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true">
          {tocando ? (
            <path d="M0 0 H3 V10 H0 Z M6 0 H9 V10 H6 Z" fill="currentColor" />
          ) : (
            <path d="M0 0 L9 5 L0 10 Z" fill="currentColor" />
          )}
        </svg>
      </button>
      <button onClick={avancar} disabled={indice >= total - 1} aria-label="próximo passo">
        <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true">
          <path d="M0 0 L8 5 L0 10 Z" fill="currentColor" />
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(total - 1, 0)}
        value={indice}
        onChange={(e) => irPara(Number(e.target.value))}
      />
      <span className="contador">
        passo {indice + 1} / {total}
      </span>
    </div>
  );
}
