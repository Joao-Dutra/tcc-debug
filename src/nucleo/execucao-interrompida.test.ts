import { describe, expect, it } from 'vitest';
import { VERSAO_DO_REGISTRO, criarSessao, sessaoValida } from './metricas';
import type { Evento } from './metricas';
import type { ResultadoExecucao } from './tipos';

/**
 * Execução registrada no disparo, verificada por execução (D23).
 *
 * A regra: **sair do exercício com uma execução no Worker não apaga a
 * execução.** Até D22 ela só entrava no log quando o resultado voltava, e o
 * resultado que chegava depois do encerramento caía numa sessão já arquivada.
 * O caso provável é o laço infinito: o estudante desiste antes do tempo
 * limite, e some justamente a execução que mais diz sobre a investigação dele.
 */

const aprovado: ResultadoExecucao = {
  instantaneos: [],
  casos: [
    { descricao: 'a', esperado: 1, obtido: 1, passou: true },
    { descricao: 'b', esperado: 2, obtido: 2, passou: true },
  ],
};

/** Sessão com relógio controlado pelo teste. */
function sessaoComRelogio() {
  let instante = 0;
  const sessao = criarSessao({
    exercicioId: 'vetor-dobrar',
    linhaDoDefeito: 3,
    participanteId: 'p',
    agora: () => instante,
  });
  return {
    sessao,
    avancar: (ms: number) => {
      instante += ms;
    },
  };
}

type EventoDeExecucao = Extract<Evento, { tipo: 'execucao' }>;
const execucoesDe = (eventos: Evento[]) =>
  eventos.filter((e): e is EventoDeExecucao => e.tipo === 'execucao');

describe('execução registrada no disparo', () => {
  it('aparece no log no instante do clique, antes de haver resultado', () => {
    const { sessao, avancar } = sessaoComRelogio();
    avancar(1000);
    sessao.iniciarExecucao('estudante', 'while (true) {}');

    const [execucao] = execucoesDe(sessao.registro().eventos);
    expect(execucao).toMatchObject({
      t: 1000,
      origem: 'estudante',
      codigo: 'while (true) {}',
      situacao: 'interrompida',
      tResultado: null,
    });
  });

  it('o resultado completa o mesmo evento, sem criar outro', () => {
    const { sessao, avancar } = sessaoComRelogio();
    avancar(1000);
    const disparo = sessao.iniciarExecucao('estudante', 'codigo');
    avancar(250);
    sessao.concluirExecucao(disparo, aprovado);

    const execucoes = execucoesDe(sessao.registro().eventos);
    expect(execucoes).toHaveLength(1);
    expect(execucoes[0]).toMatchObject({
      t: 1000,
      tResultado: 1250,
      situacao: 'concluida',
      casosPassaram: 2,
      casosTotal: 2,
      todosPassaram: true,
    });
  });

  it('encerrada a sessão, fica interrompida com o código, e o resultado tardio não a altera', () => {
    const { sessao, avancar } = sessaoComRelogio();
    const disparo = sessao.iniciarExecucao('estudante', 'for (;;) {}');
    avancar(3000);
    // O estudante desistiu e saiu do exercício.
    sessao.interromperExecucoesEmCurso();
    const arquivado = sessao.registro();

    // O Worker estoura o tempo limite e responde, tarde demais.
    sessao.concluirExecucao(disparo, { instantaneos: [], casos: [], erro: 'Tempo limite' });

    for (const retrato of [arquivado, sessao.registro()]) {
      expect(execucoesDe(retrato.eventos)).toEqual([
        expect.objectContaining({
          codigo: 'for (;;) {}',
          situacao: 'interrompida',
          tResultado: null,
          erro: null,
        }),
      ]);
    }
  });

  it('o retrato tirado antes do resultado não muda quando o resultado chega', () => {
    const { sessao } = sessaoComRelogio();
    const disparo = sessao.iniciarExecucao('estudante', 'codigo');
    // O arquivamento do `pagehide`: a página pode voltar do cache.
    const retrato = sessao.registro();
    sessao.concluirExecucao(disparo, aprovado);

    expect(execucoesDe(retrato.eventos)[0].situacao).toBe('interrompida');
    expect(execucoesDe(sessao.registro().eventos)[0].situacao).toBe('concluida');
  });

  it('interromper não trava a sessão: execuções disparadas depois concluem', () => {
    // O StrictMode desmonta e remonta a tela com a mesma sessão.
    const { sessao } = sessaoComRelogio();
    sessao.interromperExecucoesEmCurso();
    const disparo = sessao.iniciarExecucao('estudante', 'codigo');
    sessao.concluirExecucao(disparo, aprovado);

    expect(execucoesDe(sessao.registro().eventos)[0].situacao).toBe('concluida');
  });

  it('edição feita durante a execução entra depois dela no log', () => {
    const { sessao, avancar } = sessaoComRelogio();
    const disparo = sessao.iniciarExecucao('estudante', 'codigo');
    avancar(100);
    sessao.registrarEdicao('codigo editado enquanto rodava');
    sessao.concluirExecucao(disparo, aprovado);

    expect(sessao.registro().eventos.map((e) => e.tipo)).toEqual(['execucao', 'edicao']);
  });
});

describe('a execução interrompida nas métricas', () => {
  it('conta como execução do estudante para o critério de sessão válida', () => {
    const { sessao } = sessaoComRelogio();
    sessao.iniciarExecucao('estudante', 'while (true) {}');
    sessao.interromperExecucoesEmCurso();

    expect(sessaoValida(sessao.registro())).toBe(true);
  });

  it('entra na contagem de execuções e no tempo até a primeira, e não conta como erro nem correção', () => {
    const { sessao, avancar } = sessaoComRelogio();
    avancar(4000);
    sessao.iniciarExecucao('estudante', 'while (true) {}');
    sessao.interromperExecucoesEmCurso();

    const { resumo } = sessao.registro();
    expect(resumo.execucoes).toBe(1);
    expect(resumo.tempoAtePrimeiraExecucaoMs).toBe(4000);
    expect(resumo.execucoesComErro).toBe(0);
    expect(resumo.corrigido).toBe(false);
  });

  it('a automática interrompida continua fora das métricas do estudante', () => {
    const { sessao } = sessaoComRelogio();
    sessao.iniciarExecucao('automatica', 'codigo');
    sessao.interromperExecucoesEmCurso();

    expect(sessaoValida(sessao.registro())).toBe(false);
    expect(sessao.registro().resumo.execucoes).toBe(0);
  });

  it('a mudança de sentido do `t` está marcada na versão', () => {
    expect(VERSAO_DO_REGISTRO).toBe(5);
  });
});
