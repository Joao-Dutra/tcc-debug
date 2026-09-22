import { describe, expect, it } from 'vitest';
import { INTERVALO_ENTRE_LOCALIZACOES_MS } from './metricas';
import { varreduraDe } from './sinais-de-sessao';
import type { Evento } from './metricas';

/**
 * Sinal de varredura, verificado por execução (D25).
 *
 * A regra é dupla, e os testes cobram as duas metades: o sinal aparece quando
 * o log mostra apontar linha por linha sem investigar no meio, e não aparece
 * nos casos de explicação inocente — hesitar entre linhas vizinhas, ou
 * palpites espaçados com execução entre eles.
 */

const tentativa = (t: number, linha: number, correta = false): Evento => ({
  tipo: 'localizacao',
  t,
  linha,
  correta,
});

const execucao = (t: number): Evento => ({
  tipo: 'execucao',
  t,
  origem: 'estudante',
  codigo: 'codigo',
  situacao: 'concluida',
  tResultado: t + 50,
  casosPassaram: 1,
  casosTotal: 2,
  todosPassaram: false,
  erro: null,
});

/** Tentativas nas linhas dadas, espaçadas pelo intervalo de D25. */
const espacadas = (linhas: number[], inicio = 0): Evento[] =>
  linhas.map((linha, i) => tentativa(inicio + i * INTERVALO_ENTRE_LOCALIZACOES_MS, linha));

describe('sinal de varredura', () => {
  it('pega o caso que motivou o sinal: dezenas de linhas, subindo, em fração de segundo', () => {
    // 47 tentativas, linha a linha, a 300 ms uma da outra — anterior ao
    // intervalo de D25.
    const eventos = Array.from({ length: 47 }, (_, i) => tentativa(i * 300, i + 1, i === 46));
    expect(varreduraDe(eventos)).toMatchObject({
      tentativas: 47,
      primeiraLinha: 1,
      ultimaLinha: 47,
      duracaoMs: 46 * 300,
    });
  });

  it('pega a varredura ordenada mesmo no ritmo do intervalo', () => {
    // Desde D25 a pressa não é mais possível; a ordem continua denunciando.
    expect(varreduraDe(espacadas([10, 11, 12, 13, 14]))).toMatchObject({
      forma: 'ordenada',
      tentativas: 5,
    });
  });

  it('vale descendo o código, e pulando linha em branco e fecha-chave', () => {
    expect(varreduraDe(espacadas([20, 18, 17, 14, 13]))).toMatchObject({
      forma: 'ordenada',
      primeiraLinha: 20,
      ultimaLinha: 13,
    });
  });

  it('pega a rajada fora de ordem, anterior ao intervalo', () => {
    const eventos = [3, 17, 8, 22, 5].map((linha, i) => tentativa(i * 400, linha));
    expect(varreduraDe(eventos)).toMatchObject({ forma: 'rajada', tentativas: 5 });
  });

  it('o clique durante o intervalo não interrompe a sequência', () => {
    const eventos = espacadas([10, 11, 12, 13, 14]);
    eventos.splice(2, 0, { tipo: 'localizacao-no-intervalo', t: 15_000, linha: 12 });
    expect(varreduraDe(eventos)?.tentativas).toBe(5);
  });

  it('a execução automática da abertura não interrompe a sequência', () => {
    const eventos = [{ ...execucao(0), origem: 'automatica' } as Evento, ...espacadas([4, 5, 6, 7, 8], 1)];
    expect(varreduraDe(eventos)?.tentativas).toBe(5);
  });

  it('não sinaliza abaixo de cinco tentativas seguidas', () => {
    expect(varreduraDe(espacadas([10, 11, 12, 13]))).toBeNull();
  });

  it('não sinaliza quando o estudante executa, edita ou abre dica no meio', () => {
    const investigacoes: Evento[] = [
      execucao(25_000),
      { tipo: 'edicao', t: 25_000, codigo: 'x' },
      { tipo: 'dica', t: 25_000, indice: 0 },
    ];
    for (const investigacao of investigacoes) {
      const eventos = espacadas([10, 11, 12, 13, 14, 15]);
      eventos.splice(3, 0, investigacao);
      expect(varreduraDe(eventos), investigacao.tipo).toBeNull();
    }
  });

  it('não sinaliza quem vai e volta entre linhas vizinhas', () => {
    // Hesitar entre duas ou três linhas é outra coisa que descer o código.
    expect(varreduraDe(espacadas([12, 13, 12, 13, 14, 13]))).toBeNull();
  });

  it('não sinaliza palpites espaçados em linhas distantes', () => {
    // Sem ordem e sem pressa, o log não distingue palpite de hipótese testada
    // assistindo à animação — que não é registrada. Na dúvida, sem sinal.
    expect(varreduraDe(espacadas([3, 17, 8, 22, 5]))).toBeNull();
  });

  it('não sinaliza sessão sem tentativa nenhuma', () => {
    expect(varreduraDe([execucao(1000), { tipo: 'dica', t: 2000, indice: 0 }])).toBeNull();
  });
});
