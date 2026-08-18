import { instrumentar } from './instrumentar';
import type { Exercicio, ResultadoExecucao } from './tipos';

/** Tempo máximo que esperamos pelo Worker antes de desistir. */
const TEMPO_LIMITE_MS = 5000;

/**
 * Instrumenta e executa o código de um exercício, devolvendo os instantâneos e
 * o resultado dos casos de teste.
 *
 * `codigo` permite executar a versão editada pelo estudante em vez da original.
 */
export function executar(
  exercicio: Exercicio,
  codigo: string = exercicio.codigoComDefeito
): Promise<ResultadoExecucao> {
  return new Promise((resolve) => {
    let instrumentado: string;
    try {
      instrumentado = instrumentar(codigo);
    } catch (e) {
      resolve({
        instantaneos: [],
        casos: [],
        erro: `Erro de sintaxe: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }

    const worker = new Worker(new URL('./executor.worker.ts', import.meta.url), {
      type: 'module',
    });

    const cronometro = setTimeout(() => {
      worker.terminate();
      resolve({
        instantaneos: [],
        casos: [],
        erro: 'Tempo limite de execução excedido.',
      });
    }, TEMPO_LIMITE_MS);

    worker.onmessage = (evento: MessageEvent<ResultadoExecucao>) => {
      clearTimeout(cronometro);
      worker.terminate();
      resolve(evento.data);
    };

    worker.onerror = (evento) => {
      clearTimeout(cronometro);
      worker.terminate();
      resolve({ instantaneos: [], casos: [], erro: evento.message });
    };

    worker.postMessage({
      codigo: instrumentado,
      variaveisObservadas: exercicio.variaveisObservadas,
      casos: exercicio.casosDeTeste.map((c) => ({
        descricao: c.descricao,
        expressao: c.expressao,
        esperado: c.esperado,
      })),
    });
  });
}
