import { useCallback, useEffect, useRef } from 'react';
import { criarSessao, exportarSessoes } from '../nucleo/metricas';
import type { OrigemDaExecucao, Sessao } from '../nucleo/metricas';
import type { ResultadoExecucao } from '../nucleo/tipos';

/**
 * Liga o gravador de métricas ao ciclo de vida do React, no mesmo espírito do
 * useReprodutor: o núcleo não sabe que existe React, o hook faz a ponte.
 */

/** Silêncio de digitação que fecha uma rajada de edição. */
const PAUSA_DA_RAJADA_MS = 2000;

export function useMetricas(exercicioId: string) {
  // Criada uma única vez: o instante de início é o instante em que o estudante
  // passou a encarar o exercício, não o de um render qualquer.
  const sessao = useRef<Sessao | null>(null);
  if (sessao.current === null) sessao.current = criarSessao({ exercicioId });

  const temporizador = useRef<number | undefined>(undefined);
  const rascunho = useRef<string | null>(null);

  const fecharRajada = useCallback(() => {
    window.clearTimeout(temporizador.current);
    temporizador.current = undefined;
    if (rascunho.current !== null) {
      sessao.current?.registrarEdicao(rascunho.current);
      rascunho.current = null;
    }
  }, []);

  // Uma rajada em andamento no fim da sessão é uma edição que aconteceu de
  // verdade; perdê-la seria perder dado.
  useEffect(() => fecharRajada, [fecharRajada]);

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

  const exportar = useCallback(() => {
    fecharRajada();
    return exportarSessoes(sessao.current ? [sessao.current.registro()] : []);
  }, [fecharRajada]);

  return { registrarExecucao, registrarEdicao, registrarDica, exportar };
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
