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

/**
 * Rede contra estrutura absurdamente profunda estourar a pilha do JavaScript.
 * Não é mais o que termina a recursão — disso cuida a detecção de ciclo — e
 * por isso pode ser generoso: o limite antigo, de 5, truncava uma lista
 * encadeada legítima de seis nós.
 */
const LIMITE_DE_PROFUNDIDADE = 200;

/**
 * Percurso de serialização.
 *
 * Estruturas encadeadas são grafos, e não árvores: dois ponteiros podem
 * apontar para o mesmo nó, e um `proximo` mal atribuído fecha um ciclo. A
 * cópia profunda perdia as duas coisas — o mesmo nó virava duas cópias
 * independentes, e um ciclo virava uma lista reta truncada, escondendo
 * justamente o defeito que o exercício quer expor.
 *
 * Com `comIdentidade`, cada objeto visitado ganha `__id` e a segunda visita
 * vira `{ __ref: id }`. Vetores nunca recebem campo algum: o formato deles é
 * de que dependem os visualizadores de vetor, pilha e fila.
 */
function criarPercurso(comIdentidade: boolean) {
  const vistos = new Map<object, number>();
  let proximoId = 0;

  function percorrer(valor: unknown, profundidade: number): unknown {
    if (profundidade > LIMITE_DE_PROFUNDIDADE) return '<profundidade excedida>';
    if (valor === null || valor === undefined) return valor ?? null;
    const tipo = typeof valor;
    if (tipo === 'number' || tipo === 'string' || tipo === 'boolean') return valor;
    if (tipo === 'function') return '<função>';

    if (Array.isArray(valor)) {
      // O vetor entra no mapa apenas enquanto está sendo percorrido, para que
      // um vetor que contenha a si mesmo não recursione para sempre. Sai
      // depois: o mesmo vetor em dois ramos continua sendo copiado duas vezes,
      // como antes.
      if (vistos.has(valor)) return '<ciclo>';
      vistos.set(valor, -1);
      const saida = valor.map((v) => percorrer(v, profundidade + 1));
      vistos.delete(valor);
      return saida;
    }

    if (tipo === 'object') {
      const objeto = valor as object;
      const jaVisto = vistos.get(objeto);
      if (jaVisto !== undefined) return comIdentidade ? { __ref: jaVisto } : '<ciclo>';
      const id = proximoId;
      proximoId = proximoId + 1;
      vistos.set(objeto, id);
      const saida: Record<string, unknown> = comIdentidade ? { __id: id } : {};
      for (const [k, v] of Object.entries(objeto)) {
        saida[k] = percorrer(v, profundidade + 1);
      }
      // Sem identidade não há como referenciar um objeto já emitido, então o
      // mapa serve só para cortar ciclo e o objeto sai ao fim do ramo.
      if (!comIdentidade) vistos.delete(objeto);
      return saida;
    }

    return String(valor);
  }

  return (valor: unknown) => percorrer(valor, 0);
}

/** Estado observado num instantâneo: preserva a identidade dos nós. */
function serializarInstantaneo(valor: unknown): unknown {
  return criarPercurso(true)(valor);
}

/**
 * Resultado de um caso de teste. Sem identidade de propósito: o valor esperado
 * é escrito à mão no exercício, e um `__id` no obtido impediria a comparação.
 */
function serializarValor(valor: unknown): unknown {
  return criarPercurso(false)(valor);
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
      if (nome in variaveis) filtradas[nome] = serializarInstantaneo(variaveis[nome]);
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
      const obtido = serializarValor(obtidos[i]);
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
