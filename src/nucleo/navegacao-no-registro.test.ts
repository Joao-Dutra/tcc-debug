import { describe, expect, it } from 'vitest';
import { VERSAO_DO_REGISTRO, criarSessao, sessaoValida } from './metricas';
import type { ResultadoExecucao } from './tipos';

/**
 * A navegação no reprodutor no log da sessão (D36).
 *
 * O que se cobra: cada gesto entra com o passo de saída e o de chegada; um
 * arrasto contínuo vira um evento só, e nunca fica fora de ordem em relação
 * aos outros; e o resumo conta navegações, retrocessos e passos distintos por
 * execução — sem mexer em nada do que já era medido.
 */

function sessaoComRelogio() {
  let agora = 0;
  const sessao = criarSessao({ exercicioId: 'x', linhaDoDefeito: 3, agora: () => agora });
  return { sessao, avancar: (ms: number) => (agora += ms) };
}

const resultado: ResultadoExecucao = { casos: [], instantaneos: [] };

const semT = (eventos: { t: number }[]) => eventos.map(({ t: _t, ...resto }) => resto);

describe('navegação no registro', () => {
  it('grava cada gesto com o passo de saída, o de chegada e o total', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarNavegacao('avancar', 1, 2, 8);
    avancar(1000);
    sessao.registrarNavegacao('voltar', 2, 1, 8);
    avancar(1000);
    sessao.registrarNavegacao('tocar', 1, 1, 8);
    avancar(1800);
    sessao.registrarNavegacao('pausar', 1, 4, 8);
    sessao.registrarParada('fim', 4, 8, 8);

    expect(sessao.registro().eventos).toEqual([
      { tipo: 'navegacao', t: 0, gesto: 'avancar', de: 1, para: 2, total: 8 },
      { tipo: 'navegacao', t: 1000, gesto: 'voltar', de: 2, para: 1, total: 8 },
      { tipo: 'navegacao', t: 2000, gesto: 'tocar', de: 1, para: 1, total: 8 },
      { tipo: 'navegacao', t: 3800, gesto: 'pausar', de: 1, para: 4, total: 8 },
      { tipo: 'navegacao', t: 3800, gesto: 'parou', motivo: 'fim', de: 4, para: 8, total: 8 },
    ]);
  });

  it('junta os movimentos seguidos da barra num arrasto só, do começo ao último', () => {
    const { sessao, avancar } = sessaoComRelogio();
    avancar(500);
    for (let passo = 2; passo <= 30; passo++) {
      sessao.moverBarra(passo - 1, passo, 40);
      avancar(16);
    }
    sessao.moverBarra(30, 12, 40);
    sessao.encerrarArrasto();

    expect(sessao.registro().eventos).toEqual([
      { tipo: 'navegacao', t: 500, gesto: 'arrastar', de: 1, para: 12, total: 40, tFim: 964 },
    ]);
  });

  it('depois de encerrado, o movimento seguinte é outro arrasto', () => {
    const { sessao } = sessaoComRelogio();
    sessao.moverBarra(1, 5, 10);
    sessao.encerrarArrasto();
    sessao.moverBarra(5, 9, 10);
    sessao.encerrarArrasto();
    expect(semT(sessao.registro().eventos)).toEqual([
      { tipo: 'navegacao', gesto: 'arrastar', de: 1, para: 5, total: 10, tFim: 0 },
      { tipo: 'navegacao', gesto: 'arrastar', de: 5, para: 9, total: 10, tFim: 0 },
    ]);
  });

  it('o arrasto aberto entra no log antes de qualquer outro evento, e não depois', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.moverBarra(1, 6, 10);
    avancar(200);
    sessao.registrarLocalizacao(3);
    sessao.moverBarra(6, 2, 10);
    sessao.iniciarExecucao('estudante', 'codigo');

    expect(sessao.registro().eventos.map((e) => [e.tipo, e.t])).toEqual([
      ['navegacao', 0],
      ['localizacao', 200],
      ['navegacao', 200],
      ['execucao', 200],
    ]);
  });

  it('a barra de outra execução começa outro arrasto, mesmo sem pausa', () => {
    const { sessao } = sessaoComRelogio();
    sessao.moverBarra(1, 4, 10);
    sessao.moverBarra(1, 3, 6);
    sessao.encerrarArrasto();
    expect(sessao.registro().eventos).toHaveLength(2);
  });

  it('o retrato tirado no meio do arrasto o leva, e o arrasto continua o mesmo', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.moverBarra(1, 4, 10);
    avancar(100);
    expect(semT(sessao.registro().eventos)).toEqual([
      { tipo: 'navegacao', gesto: 'arrastar', de: 1, para: 4, total: 10, tFim: 0 },
    ]);
    sessao.moverBarra(4, 7, 10);
    sessao.encerrarArrasto();
    expect(semT(sessao.registro().eventos)).toEqual([
      { tipo: 'navegacao', gesto: 'arrastar', de: 1, para: 7, total: 10, tFim: 100 },
    ]);
  });
});

describe('navegação no resumo', () => {
  it('conta os gestos, sem as paradas sozinhas, e o instante do primeiro', () => {
    const { sessao, avancar } = sessaoComRelogio();
    avancar(4000);
    sessao.registrarNavegacao('tocar', 1, 1, 8);
    sessao.registrarParada('fim', 1, 8, 8);
    sessao.registrarNavegacao('voltar', 8, 7, 8);
    sessao.moverBarra(7, 9, 12);
    sessao.moverBarra(9, 3, 12);
    sessao.encerrarArrasto();
    sessao.moverBarra(3, 5, 12);
    sessao.encerrarArrasto();

    const resumo = sessao.registro().resumo;
    expect(resumo.navegacoes).toBe(4);
    // Voltar, e o arrasto que terminou antes de onde começou.
    expect(resumo.retrocessos).toBe(2);
    expect(resumo.tempoAtePrimeiraNavegacaoMs).toBe(4000);
  });

  it('sem navegação, o tempo até a primeira é nulo, e não zero', () => {
    const resumo = sessaoComRelogio().sessao.registro().resumo;
    expect(resumo.navegacoes).toBe(0);
    expect(resumo.passosDistintosVisitados).toBe(0);
    expect(resumo.tempoAtePrimeiraNavegacaoMs).toBeNull();
  });

  it('conta os passos distintos por execução, e o trecho tocado inteiro', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarExecucao('automatica', 'a', resultado);
    avancar(100);
    sessao.registrarNavegacao('tocar', 1, 1, 10);
    sessao.registrarNavegacao('pausar', 1, 4, 10); // 1, 2, 3, 4
    sessao.registrarNavegacao('voltar', 4, 3, 10); // já visitado
    sessao.moverBarra(3, 9, 10);
    sessao.encerrarArrasto(); // 9 — os do meio não
    expect(sessao.registro().resumo.passosDistintosVisitados).toBe(5);

    // Na execução seguinte, o mesmo passo é outro passo.
    avancar(100);
    sessao.registrarExecucao('estudante', 'b', resultado);
    avancar(100);
    sessao.registrarNavegacao('avancar', 1, 2, 10);
    expect(sessao.registro().resumo.passosDistintosVisitados).toBe(6);
  });

  it('o trecho fechado pela execução nova é do resultado anterior', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarExecucao('automatica', 'a', resultado);
    avancar(100);
    sessao.registrarNavegacao('avancar', 1, 2, 10);
    sessao.registrarNavegacao('tocar', 2, 2, 10);
    const disparo = sessao.iniciarExecucao('estudante', 'b');
    avancar(1200);
    sessao.concluirExecucao(disparo, resultado);
    // O reprodutor avisa da parada depois que o resultado novo chegou.
    avancar(5);
    sessao.registrarParada('nova-execucao', 2, 4, 10);
    // Passos 2, 3 e 4 da primeira execução, e nenhum da segunda.
    expect(sessao.registro().resumo.passosDistintosVisitados).toBe(3);
    sessao.registrarNavegacao('avancar', 1, 2, 10);
    expect(sessao.registro().resumo.passosDistintosVisitados).toBe(4);
  });

  it('não muda nenhuma das métricas que já eram medidas', () => {
    const com = sessaoComRelogio();
    com.sessao.registrarNavegacao('avancar', 1, 2, 8);
    com.sessao.moverBarra(2, 6, 8);
    com.sessao.encerrarArrasto();
    const sem = sessaoComRelogio();
    const {
      navegacoes: _n,
      passosDistintosVisitados: _p,
      retrocessos: _r,
      tempoAtePrimeiraNavegacaoMs: _t,
      ...anteriores
    } = com.sessao.registro().resumo;
    const {
      navegacoes: _n2,
      passosDistintosVisitados: _p2,
      retrocessos: _r2,
      tempoAtePrimeiraNavegacaoMs: _t2,
      ...anterioresSem
    } = sem.sessao.registro().resumo;
    expect(anteriores).toEqual(anterioresSem);
  });

  // Navegar no resultado da execução automática não é ação sobre o código:
  // continua sendo a sessão de quem abriu e fechou (D22).
  it('navegar não torna a sessão válida', () => {
    const { sessao } = sessaoComRelogio();
    sessao.registrarNavegacao('tocar', 1, 1, 8);
    expect(sessaoValida(sessao.registro())).toBe(false);
  });

  it('a versão do registro marca a coleta com navegação', () => {
    expect(VERSAO_DO_REGISTRO).toBeGreaterThanOrEqual(10);
    expect(sessaoComRelogio().sessao.registro().versao).toBe(VERSAO_DO_REGISTRO);
  });
});
