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
      <button onClick={voltar} disabled={indice === 0}>
        ◀
      </button>
      <button onClick={alternar}>{tocando ? '❚❚' : '▶'}</button>
      <button onClick={avancar} disabled={indice >= total - 1}>
        ▶
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
