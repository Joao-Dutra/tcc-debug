import { describe, expect, it } from 'vitest';
import { SEM_FILTRO, criarSessao, filtrarSessoes } from '../nucleo/metricas';
import type { MarcaDoEstudo, RegistroDeSessao } from '../nucleo/metricas';
import type { ResultadoExecucao } from '../nucleo/tipos';
import {
  COLUNAS_DO_CSV,
  apoioConfereComPlano,
  campoDoCsv,
  csvDoEstudo,
  desfechoNoEstudo,
  linhasDoEstudo,
  sessoesDoEstudo,
} from './exportacao';
import type { ParticipanteDoEstudo, RespostaLida } from './exportacao';
import { ITENS_DAS_ESCALAS } from './questionario';

/**
 * O CSV do estudo (D37). O arquivo é o que vai para a análise, e os defeitos
 * dele são todos silenciosos: uma coluna fora de ordem, um zero no lugar de um
 * ausente, um texto com vírgula que parte a linha em duas. Cada um é cobrado
 * aqui, por execução.
 */

const passou: ResultadoExecucao = {
  instantaneos: [],
  casos: [{ descricao: 'caso', esperado: 1, obtido: 1, passou: true }],
};
const falhou: ResultadoExecucao = {
  instantaneos: [],
  casos: [{ descricao: 'caso', esperado: 1, obtido: 2, passou: false }],
};

interface Roteiro {
  participanteId?: string | null;
  exercicioId?: string;
  andaime?: string;
  estudo?: MarcaDoEstudo | null;
  /** O que acontece na sessão, com o relógio que avança. */
  passos?: (s: ReturnType<typeof criarSessao>, avancar: (ms: number) => void) => void;
}

function sessao(r: Roteiro = {}): RegistroDeSessao {
  let agora = 0;
  const s = criarSessao({
    exercicioId: r.exercicioId ?? 'pilha-desempilhar',
    andaime: r.andaime ?? 'com-apoio',
    participanteId: r.participanteId === undefined ? 'uid-a' : r.participanteId,
    linhaDoDefeito: 3,
    estudo: r.estudo === null ? undefined : (r.estudo ?? { aplicacao: 'piloto-nov', etapa: 1, aquecimento: false }),
    agora: () => agora,
  });
  s.registrarExecucao('automatica', 'codigo', falhou);
  r.passos?.(s, (ms) => (agora += ms));
  return s.registro();
}

const participanteA: ParticipanteDoEstudo = {
  participanteId: 'uid-a',
  aplicacao: 'piloto-nov',
  grupo: 'A',
  ordemDeEntrada: 1,
  perfil: { aeds1: 'cursando', depurador: 'as-vezes', usouVisualizacao: 'nao' },
};

const respostaA: RespostaLida = {
  participanteId: 'uid-a',
  aplicacao: 'piloto-nov',
  versao: 1,
  escalas: Object.fromEntries(ITENS_DAS_ESCALAS.map((i) => [i.id, 3])),
  oQueAjudou: 'ver a pilha, "andando"',
  oQueAtrapalhou: null,
};

/** O CSV lido de volta, como R e pandas leriam: cabeçalho e linhas. */
function lerCsv(texto: string): Record<string, string>[] {
  const registros: string[][] = [];
  let campo = '';
  let registro: string[] = [];
  let entreAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') entreAspas = false;
      else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ',') {
      registro.push(campo);
      campo = '';
    } else if (c === '\r' && texto[i + 1] === '\n') {
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = '';
      i++;
    } else campo += c;
  }
  const [cabecalho, ...linhas] = registros;
  return linhas.map((l) => {
    expect(l).toHaveLength(cabecalho.length);
    return Object.fromEntries(cabecalho.map((c, i) => [c, l[i]]));
  });
}

describe('o formato do arquivo', () => {
  it('o cabeçalho tem as colunas combinadas, na ordem', () => {
    const cabecalho = csvDoEstudo([], [], []).split('\r\n')[0].split(',');
    expect(cabecalho).toEqual([...COLUNAS_DO_CSV]);
    expect(cabecalho.slice(0, 7)).toEqual([
      'aplicacao',
      'participante_id',
      'grupo',
      'ordem_de_entrada',
      'perfil_aeds1',
      'perfil_depurador',
      'perfil_visualizacao',
    ]);
    expect(cabecalho.slice(-20)).toEqual([
      'versao_do_questionario',
      'sus_1', 'sus_2', 'sus_3', 'sus_4', 'sus_5', 'sus_6', 'sus_7', 'sus_8', 'sus_9', 'sus_10',
      'sus_escore',
      'vis_1', 'vis_2', 'vis_3', 'vis_4', 'vis_5', 'vis_6',
      'ajudou',
      'atrapalhou',
    ]);
    expect(new Set(cabecalho).size).toBe(cabecalho.length);
  });

  it('CRLF no fim de cada linha, sem BOM, e uma linha por sessão', () => {
    const texto = csvDoEstudo([sessao(), sessao()], [participanteA], []);
    expect(texto.charCodeAt(0)).not.toBe(0xfeff);
    expect(texto.endsWith('\r\n')).toBe(true);
    expect(texto.split('\r\n')).toHaveLength(4);
    expect(texto.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('o campo vai entre aspas só quando precisa, com as aspas dobradas', () => {
    expect(campoDoCsv('simples')).toBe('simples');
    expect(campoDoCsv('a, b')).toBe('"a, b"');
    expect(campoDoCsv('disse "isso"')).toBe('"disse ""isso"""');
    expect(campoDoCsv('duas\nlinhas')).toBe('"duas\nlinhas"');
    expect(campoDoCsv(77.5)).toBe('77.5');
    expect(campoDoCsv(true)).toBe('true');
    expect(campoDoCsv(null)).toBe('');
    expect(campoDoCsv(undefined)).toBe('');
    expect(campoDoCsv(0)).toBe('0');
  });

  it('um texto com vírgula, aspas e quebra de linha volta inteiro, na coluna certa', () => {
    const resposta = { ...respostaA, oQueAtrapalhou: 'o tempo, "curto"\r\ne a fila' };
    const [linha] = lerCsv(csvDoEstudo([sessao()], [participanteA], [resposta]));
    expect(linha.ajudou).toBe('ver a pilha, "andando"');
    expect(linha.atrapalhou).toBe('o tempo, "curto"\r\ne a fila');
  });
});

describe('as colunas da sessão', () => {
  it('participante, perfil, sessão e questionário lado a lado', () => {
    const s = sessao({
      passos: (s, avancar) => {
        avancar(30_000);
        s.registrarDica(0);
        avancar(30_000);
        s.registrarExecucao('estudante', 'corrigido', passou);
      },
    });
    const [linha] = lerCsv(csvDoEstudo([s], [participanteA], [respostaA]));
    expect(linha).toMatchObject({
      aplicacao: 'piloto-nov',
      participante_id: 'uid-a',
      grupo: 'A',
      ordem_de_entrada: '1',
      perfil_aeds1: 'cursando',
      perfil_depurador: 'as-vezes',
      perfil_visualizacao: 'nao',
      sessao_id: s.id,
      versao_do_registro: String(s.versao),
      exercicio_id: 'pilha-desempilhar',
      etapa: '1',
      aquecimento: 'false',
      apoio: 'com-apoio',
      apoio_confere_com_plano: 'true',
      instante_de_inicio: s.instanteDeInicio,
      duracao_total_ms: String(s.duracaoTotalMs),
      sessao_valida: 'true',
      desfecho: 'corrigido',
      tempo_ate_primeira_execucao_ms: '60000',
      tempo_ate_localizacao_ms: '',
      tempo_ate_correcao_ms: '60000',
      execucoes: '1',
      execucoes_com_erro: '0',
      dicas_reveladas: '1',
      edicoes: '0',
      localizacoes_tentadas: '0',
      corrigido: 'true',
      navegacoes: '0',
      versao_do_questionario: '1',
      sus_1: '3',
      sus_10: '3',
      sus_escore: '50',
      vis_6: '3',
      atrapalhou: '',
    });
  });

  it('as métricas saem do log, e não do resumo gravado', () => {
    const s = sessao({ passos: (s) => s.registrarExecucao('estudante', 'x', passou) });
    const adulterada = { ...s, resumo: { ...s.resumo, execucoes: 99, corrigido: false } };
    const [linha] = lerCsv(csvDoEstudo([adulterada], [participanteA], []));
    expect(linha.execucoes).toBe('1');
    expect(linha.corrigido).toBe('true');
  });

  it('antes da versão 10, a navegação sai vazia, e não zero', () => {
    const antiga = { ...sessao(), versao: 9 };
    const [linha] = lerCsv(csvDoEstudo([antiga], [participanteA], []));
    expect(linha.navegacoes).toBe('');
    expect(linha.passos_distintos_visitados).toBe('');
    expect(linha.retrocessos).toBe('');
    expect(linha.tempo_ate_primeira_navegacao_ms).toBe('');
    // As outras métricas continuam.
    expect(linha.execucoes).toBe('0');
  });

  it('quem não respondeu o questionário sai com as colunas dele vazias', () => {
    const [linha] = lerCsv(csvDoEstudo([sessao()], [participanteA], []));
    for (const coluna of ['versao_do_questionario', 'sus_1', 'sus_escore', 'vis_1', 'ajudou', 'atrapalhou']) {
      expect(linha[coluna], coluna).toBe('');
    }
  });

  it('o questionário e o perfil se repetem em cada sessão do participante', () => {
    const etapa = (n: number) => sessao({ estudo: { aplicacao: 'piloto-nov', etapa: n, aquecimento: n === 0 } });
    const linhas = lerCsv(csvDoEstudo([etapa(2), etapa(0), etapa(1)], [participanteA], [respostaA]));
    expect(linhas.map((l) => l.etapa)).toEqual(['0', '1', '2']);
    expect(new Set(linhas.map((l) => l.sus_escore))).toEqual(new Set(['50']));
    expect(new Set(linhas.map((l) => l.perfil_aeds1))).toEqual(new Set(['cursando']));
  });

  it('a resposta e o perfil são os da mesma aplicação', () => {
    const outra = { ...respostaA, aplicacao: 'aeds1-2026' };
    const [linha] = lerCsv(csvDoEstudo([sessao()], [], [outra]));
    expect(linha.sus_escore).toBe('');
    expect(linha.grupo).toBe('');
    expect(linha.ordem_de_entrada).toBe('');
  });

  it('sem banco, o grupo vem da marca do aparelho', () => {
    const s = sessao({
      participanteId: null,
      estudo: { aplicacao: 'piloto-nov', etapa: 1, aquecimento: false, grupoNoAparelho: 'B' },
      andaime: 'sem-apoio',
    });
    const [linha] = lerCsv(csvDoEstudo([s], [], []));
    expect(linha).toMatchObject({ grupo: 'B', participante_id: '', apoio_confere_com_plano: 'true' });
  });

  it('as linhas saem por aplicação, ordem de entrada e etapa', () => {
    const b: ParticipanteDoEstudo = { ...participanteA, participanteId: 'uid-b', grupo: 'B', ordemDeEntrada: 2 };
    const linhas = lerCsv(
      csvDoEstudo(
        [
          sessao({ participanteId: 'uid-b' }),
          sessao({ participanteId: 'uid-a', estudo: { aplicacao: 'piloto-nov', etapa: 2, aquecimento: false } }),
          sessao({ participanteId: 'uid-a' }),
        ],
        [b, participanteA],
        []
      )
    );
    expect(linhas.map((l) => [l.participante_id, l.etapa])).toEqual([
      ['uid-a', '1'],
      ['uid-a', '2'],
      ['uid-b', '1'],
    ]);
  });

  it('a sessão de fora do estudo não entra', () => {
    expect(linhasDoEstudo([sessao({ estudo: null })], [participanteA], [])).toEqual([]);
  });
});

describe('o desfecho', () => {
  const comEncerramento = (motivo: 'seguir' | 'tempo-esgotado', corrigir: boolean) =>
    sessao({
      passos: (s) => {
        if (corrigir) s.registrarExecucao('estudante', 'x', passou);
        else s.registrarExecucao('estudante', 'x', falhou);
        s.registrarEncerramento(motivo);
      },
    });

  it('corrigir vale mais que o gesto do fim', () => {
    expect(desfechoNoEstudo(comEncerramento('seguir', true))).toBe('corrigido');
    expect(desfechoNoEstudo(comEncerramento('tempo-esgotado', true))).toBe('corrigido');
  });

  it('seguir sem corrigir é desistência; o prazo, tempo esgotado', () => {
    expect(desfechoNoEstudo(comEncerramento('seguir', false))).toBe('desistencia');
    expect(desfechoNoEstudo(comEncerramento('tempo-esgotado', false))).toBe('tempo-esgotado');
  });

  it('sem encerramento — a página recarregada ou fechada — é dito como tal', () => {
    expect(desfechoNoEstudo(sessao())).toBe('sem-encerramento');
  });

  it('a execução automática que passa não é correção', () => {
    const s = sessao({ passos: (s) => s.registrarExecucao('automatica', 'x', passou) });
    expect(desfechoNoEstudo(s)).toBe('sem-encerramento');
  });
});

describe('o apoio confere com o plano', () => {
  it('confere o exercício e o apoio da etapa para o grupo', () => {
    // Etapa 1 é pilha-desempilhar: A com apoio, B sem.
    expect(apoioConfereComPlano(sessao({ andaime: 'com-apoio' }), 'A')).toBe(true);
    expect(apoioConfereComPlano(sessao({ andaime: 'com-apoio' }), 'B')).toBe(false);
    expect(apoioConfereComPlano(sessao({ andaime: 'sem-apoio' }), 'B')).toBe(true);
    expect(apoioConfereComPlano(sessao({ exercicioId: 'fila-atender-todos' }), 'A')).toBe(false);
  });

  it('sem grupo não há com o que comparar', () => {
    expect(apoioConfereComPlano(sessao(), null)).toBeNull();
  });

  it('uma etapa que o plano não tem não confere', () => {
    expect(apoioConfereComPlano(sessao({ estudo: { aplicacao: 'x', etapa: 9, aquecimento: false } }), 'A')).toBe(
      false
    );
  });
});

describe('o recorte por aplicação', () => {
  const piloto = sessao();
  const coleta = sessao({ estudo: { aplicacao: 'aeds1-2026', etapa: 1, aquecimento: false } });
  const avulsa = sessao({ estudo: null });

  it('o filtro do painel deixa só as sessões do percurso daquela aplicação', () => {
    expect(filtrarSessoes([piloto, coleta, avulsa], { ...SEM_FILTRO, aplicacao: 'piloto-nov' })).toEqual([piloto]);
    expect(filtrarSessoes([piloto, coleta, avulsa], SEM_FILTRO)).toHaveLength(3);
  });

  it('o CSV leva as sessões do estudo da aplicação escolhida, ou de todas', () => {
    expect(sessoesDoEstudo([piloto, coleta, avulsa], 'aeds1-2026')).toEqual([coleta]);
    expect(sessoesDoEstudo([piloto, coleta, avulsa], null)).toEqual([piloto, coleta]);
  });
});
