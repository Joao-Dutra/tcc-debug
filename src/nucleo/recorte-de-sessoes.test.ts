import { describe, expect, it } from 'vitest';
import {
  SEM_FILTRO,
  criarSessao,
  exportarSessoes,
  filtrarSessoes,
  sessaoValida,
} from './metricas';
import type { ExportacaoDeMetricas, RegistroDeSessao } from './metricas';
import type { ResultadoExecucao } from './tipos';

/**
 * Critério de sessão válida e recorte das sessões, verificados por execução
 * (D22).
 *
 * Duas regras. A primeira é o próprio critério: a execução automática, que
 * roda ao abrir o exercício, não conta — senão toda sessão aberta seria
 * válida, e o critério não separaria nada. A segunda é que recortar não apaga:
 * o filtro devolve outra lista, o dado bruto continua inteiro, e o arquivo
 * exportado diz que recorte foi aplicado.
 */

const execucaoQualquer: ResultadoExecucao = {
  instantaneos: [],
  casos: [{ descricao: 'caso', esperado: 1, obtido: 1, passou: true }],
};

function sessao(
  opcoes: { exercicioId?: string; andaime?: string; participanteId?: string | null } = {}
) {
  return criarSessao({
    exercicioId: opcoes.exercicioId ?? 'vetor-dobrar',
    andaime: opcoes.andaime ?? 'com-apoio',
    participanteId: opcoes.participanteId ?? 'participante-a',
    linhaDoDefeito: 3,
  });
}

/** Quem abriu o exercício e saiu: só a execução automática da abertura. */
function abriuEFechou(opcoes?: Parameters<typeof sessao>[0]): RegistroDeSessao {
  const s = sessao(opcoes);
  s.registrarExecucao('automatica', 'codigo', execucaoQualquer);
  return s.registro();
}

/** Quem executou ao menos uma vez por conta própria. */
function executou(opcoes?: Parameters<typeof sessao>[0]): RegistroDeSessao {
  const s = sessao(opcoes);
  s.registrarExecucao('automatica', 'codigo', execucaoQualquer);
  s.registrarExecucao('estudante', 'codigo editado', execucaoQualquer);
  return s.registro();
}

describe('sessão válida', () => {
  it('a execução automática da abertura não torna a sessão válida', () => {
    expect(sessaoValida(abriuEFechou())).toBe(false);
  });

  it('uma execução do estudante basta', () => {
    expect(sessaoValida(executou())).toBe(true);
  });

  it('ler dica ou editar sem executar não basta', () => {
    const s = sessao();
    s.registrarDica(0);
    s.registrarEdicao('outro codigo');
    expect(sessaoValida(s.registro())).toBe(false);
  });

  it('uma execução que deu erro também conta: é tentativa do estudante', () => {
    const s = sessao();
    s.registrarExecucao('estudante', 'codigo quebrado', {
      instantaneos: [],
      casos: [],
      erro: 'SyntaxError',
    });
    expect(sessaoValida(s.registro())).toBe(true);
  });
});

describe('recorte das sessões', () => {
  const todas = [
    executou({ participanteId: 'a', exercicioId: 'pilha-reverter', andaime: 'com-apoio' }),
    abriuEFechou({ participanteId: 'a', exercicioId: 'fila-inverter', andaime: 'sem-apoio' }),
    executou({ participanteId: 'b', exercicioId: 'pilha-reverter', andaime: 'sem-apoio' }),
    abriuEFechou({ participanteId: 'b', exercicioId: 'pilha-reverter', andaime: 'com-apoio' }),
  ];

  it('sem filtro, tudo', () => {
    expect(filtrarSessoes(todas, SEM_FILTRO)).toEqual(todas);
  });

  it('cada critério recorta pelo seu campo', () => {
    const ids = (lista: RegistroDeSessao[]) => lista.map((r) => r.id);

    expect(ids(filtrarSessoes(todas, { ...SEM_FILTRO, participanteId: 'b' }))).toEqual(
      ids([todas[2], todas[3]])
    );
    expect(ids(filtrarSessoes(todas, { ...SEM_FILTRO, exercicioId: 'fila-inverter' }))).toEqual(
      ids([todas[1]])
    );
    expect(ids(filtrarSessoes(todas, { ...SEM_FILTRO, andaime: 'sem-apoio' }))).toEqual(
      ids([todas[1], todas[2]])
    );
    expect(ids(filtrarSessoes(todas, { ...SEM_FILTRO, apenasValidas: true }))).toEqual(
      ids([todas[0], todas[2]])
    );
  });

  it('os critérios se combinam', () => {
    const recorte = filtrarSessoes(todas, {
      participanteId: 'b',
      exercicioId: 'pilha-reverter',
      andaime: null,
      origemDoExercicio: null,
      apenasValidas: true,
    });
    expect(recorte.map((r) => r.id)).toEqual([todas[2].id]);
  });

  it('recortar não apaga: a lista de origem fica inteira', () => {
    const antes = [...todas];
    filtrarSessoes(todas, { ...SEM_FILTRO, apenasValidas: true });
    expect(todas).toEqual(antes);
  });

  it('o arquivo exportado leva só o recorte, e diz qual foi', () => {
    const filtro = { ...SEM_FILTRO, apenasValidas: true };
    const recorte = filtrarSessoes(todas, filtro);
    const arquivo = JSON.parse(
      exportarSessoes(recorte, { origem: 'banco', filtro, totalNaOrigem: todas.length })
    ) as ExportacaoDeMetricas;

    expect(arquivo.sessoes.map((r) => r.id)).toEqual(recorte.map((r) => r.id));
    expect(arquivo.recorte).toEqual({ origem: 'banco', filtro, totalNaOrigem: 4 });
  });
});
