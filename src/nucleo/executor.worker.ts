/// <reference lib="webworker" />
import type { Instantaneo, ResultadoCaso, ResultadoExecucao } from './tipos';

/**
 * Executa o código já instrumentado dentro do Worker.
 *
 * O Worker existe por dois motivos: não travar a interface durante laços longos
 * e isolar o código do estudante do restante da aplicação. Não é uma sandbox de
 * segurança — o código executado é o do próprio catálogo, não código arbitrário
 * vindo da internet.
 */

const LIMITE_DE_PASSOS = 5000;

interface Pedido {
  codigo: string;
  variaveisObservadas: string[];
  casos: { descricao: string; expressao: string; esperado: unknown }[];
}

/** Converte um valor para algo transferível e comparável. */
function serializar(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 5) return '…';
  if (valor === null || valor === undefined) return valor ?? null;
  const tipo = typeof valor;
  if (tipo === 'number' || tipo === 'string' || tipo === 'boolean') return valor;
  if (tipo === 'function') return '<função>';
  if (Array.isArray(valor)) return valor.map((v) => serializar(v, profundidade + 1));
  if (tipo === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as object)) {
      saida[k] = serializar(v, profundidade + 1);
    }
    return saida;
  }
  return String(valor);
}

self.onmessage = (evento: MessageEvent<Pedido>) => {
  const { codigo, variaveisObservadas, casos } = evento.data;
  const instantaneos: Instantaneo[] = [];
  const resultados: ResultadoCaso[] = [];
  let erro: string | undefined;

  const passo = (linha: number, variaveis: Record<string, unknown>) => {
    if (instantaneos.length >= LIMITE_DE_PASSOS) {
      throw new Error(
        'Limite de passos excedido — o programa provavelmente entrou em laço infinito.'
      );
    }
    const filtradas: Record<string, unknown> = {};
    for (const nome of variaveisObservadas) {
      if (nome in variaveis) filtradas[nome] = serializar(variaveis[nome]);
    }
    instantaneos.push({ ordem: instantaneos.length, linha, variaveis: filtradas });
  };

  try {
    const expressoes = casos.map((c) => c.expressao);
    const corpo = `${codigo}\nreturn [${expressoes.join(',')}];`;
    // eslint-disable-next-line no-new-func
    const fabrica = new Function('__passo', corpo);
    const obtidos = fabrica(passo) as unknown[];

    casos.forEach((caso, i) => {
      const obtido = serializar(obtidos[i]);
      resultados.push({
        descricao: caso.descricao,
        esperado: caso.esperado,
        obtido,
        passou: JSON.stringify(obtido) === JSON.stringify(caso.esperado),
      });
    });
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
  }

  const resposta: ResultadoExecucao = { instantaneos, casos: resultados, erro };
  self.postMessage(resposta);
};
