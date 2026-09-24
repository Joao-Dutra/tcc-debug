import { instrumentar } from './instrumentar';
import { MENSAGEM_DO_TEMPO_LIMITE, TEMPO_LIMITE_MS } from './limites';
import type { Exercicio, ResultadoExecucao } from './tipos';

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
        erro: MENSAGEM_DO_TEMPO_LIMITE,
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
      marcadores: exercicio.marcadores,
      casos: exercicio.casosDeTeste.map((c) => ({
        descricao: c.descricao,
        expressao: c.expressao,
        esperado: c.esperado,
      })),
    });
  });
}
