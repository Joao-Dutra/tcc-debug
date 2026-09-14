import { beforeAll, describe, expect, it } from 'vitest';
import { catalogo } from './catalogo';
import { instrumentar } from '../nucleo/instrumentar';
import type { Exercicio, Instantaneo, ResultadoExecucao } from '../nucleo/tipos';

/**
 * Quadro-denúncia verificado por execução (D16, skill criar-exercicio).
 *
 * Roda cada exercício do catálogo com e sem o defeito, pela mesma lógica do
 * Worker, e compara as sequências de instantâneos restritas às
 * `variaveisObservadas` — que é tudo o que a visualização recebe. Recusa o
 * exercício por qualquer um de dois critérios:
 *
 * 1. as sequências são idênticas, ou divergem em um único quadro;
 * 2. as trajetórias de estados são idênticas. Trajetória é a sequência de
 *    estados sem as repetições consecutivas: ignora em que linha e em que
 *    momento o estado muda e fica só com quais estados ocorrem, em ordem.
 *
 * O segundo critério existe porque o primeiro não pegou o caso que motivou a
 * verificação: o defeito da pilha diverge em dois quadros, um por chamada, mas
 * a pilha atravessa exatamente os mesmos estados. O defeito muda quando o topo
 * desce em relação à linha, não o que o desenho mostra.
 */

/**
 * Reprovados na auditoria de D16 e ainda não corrigidos. Cada um precisa
 * continuar reprovado: quando for corrigido, o teste falha e pede que saia
 * daqui. Assim a pendência não some em silêncio.
 */
const PENDENTES = new Set(['pilha-desempilhar']);

let rodarNoWorker: (pedido: unknown) => ResultadoExecucao;

beforeAll(async () => {
  // O Worker registra o manipulador em `self` quando é importado. Em Node não
  // há Worker: um `self` de mentira recebe o manipulador, e o código que roda é
  // o mesmo do navegador.
  let saida: ResultadoExecucao | null = null;
  const falso: {
    onmessage: ((evento: { data: unknown }) => void) | null;
    postMessage: (mensagem: ResultadoExecucao) => void;
  } = {
    onmessage: null,
    postMessage: (mensagem) => {
      saida = mensagem;
    },
  };
  (globalThis as unknown as { self: typeof falso }).self = falso;
  await import('../nucleo/executor.worker');
  rodarNoWorker = (pedido) => {
    saida = null;
    falso.onmessage?.({ data: pedido });
    if (saida === null) throw new Error('o Worker não respondeu');
    return saida;
  };
});

function executar(exercicio: Exercicio, codigo: string): Instantaneo[] {
  return rodarNoWorker({
    codigo: instrumentar(codigo),
    variaveisObservadas: exercicio.variaveisObservadas,
    casos: exercicio.casosDeTeste.map(({ descricao, expressao, esperado }) => ({
      descricao,
      expressao,
      esperado,
    })),
  }).instantaneos;
}

/** O estado que a visualização recebe num quadro, em forma comparável. */
function estado(exercicio: Exercicio, instantaneo: Instantaneo): string {
  return JSON.stringify(
    exercicio.variaveisObservadas.map((nome) => [
      nome,
      nome in instantaneo.variaveis ? instantaneo.variaveis[nome] : '(ausente)',
    ])
  );
}

const trajetoria = (estados: string[]) =>
  estados.filter((atual, i) => i === 0 || atual !== estados[i - 1]);

export function compararVersoes(exercicio: Exercicio) {
  const comDefeito = executar(exercicio, exercicio.codigoComDefeito).map((i) => estado(exercicio, i));
  const correto = executar(exercicio, exercicio.codigoCorreto).map((i) => estado(exercicio, i));

  const emComum = Math.min(comDefeito.length, correto.length);
  let quadrosDivergentes = Math.abs(comDefeito.length - correto.length);
  for (let i = 0; i < emComum; i++) if (comDefeito[i] !== correto[i]) quadrosDivergentes++;

  const td = trajetoria(comDefeito);
  const tc = trajetoria(correto);
  const trajetoriasIdenticas = td.length === tc.length && td.every((e, i) => e === tc[i]);

  return {
    quadrosDivergentes,
    trajetoriasIdenticas,
    reprovado: quadrosDivergentes <= 1 || trajetoriasIdenticas,
  };
}

describe.each(catalogo)('$id', (exercicio) => {
  if (PENDENTES.has(exercicio.id)) {
    it('continua reprovado, pendente de correção (D16)', () => {
      expect(compararVersoes(exercicio).reprovado).toBe(true);
    });
  } else {
    it('diverge da versão correta em estado observável', () => {
      const r = compararVersoes(exercicio);
      expect(r.trajetoriasIdenticas, 'trajetórias de estados idênticas').toBe(false);
      expect(r.quadrosDivergentes, 'quadros divergentes').toBeGreaterThan(1);
    });
  }
});
