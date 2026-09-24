import { describe, expect, it } from 'vitest';
import { INTERVALO_ENTRE_LOCALIZACOES_MS, VERSAO_DO_REGISTRO, criarSessao } from './metricas';

/**
 * Mais de uma linha aceita como localização (D30), verificado por execução.
 *
 * Na troca de ordem entre duas linhas vizinhas, as duas mudaram de lugar, e
 * apontar qualquer uma delas é achar o defeito. Até a versão 6 só a primeira
 * contava, e quem apontava a segunda ouvia um retorno falso.
 */

function sessao(linhasAceitas?: number[]) {
  let instante = 0;
  const s = criarSessao({
    exercicioId: 'lista-inserir-depois',
    linhaDoDefeito: 15,
    linhasAceitas,
    participanteId: 'p',
    agora: () => instante,
  });
  return {
    s,
    // Entre duas tentativas há o intervalo de D25.
    esperar: () => {
      instante += INTERVALO_ENTRE_LOCALIZACOES_MS;
    },
  };
}

describe('linhas aceitas como localização', () => {
  it('na troca de ordem, a segunda linha também é acerto', () => {
    const { s } = sessao([15, 16]);
    expect(s.registrarLocalizacao(16)).toEqual({ julgada: true, correta: true });
  });

  it('a primeira continua sendo', () => {
    const { s } = sessao([15, 16]);
    expect(s.registrarLocalizacao(15)).toEqual({ julgada: true, correta: true });
  });

  it('uma linha fora da troca continua sendo erro', () => {
    const { s } = sessao([15, 16]);
    expect(s.registrarLocalizacao(17)).toEqual({ julgada: true, correta: false });
  });

  it('sem a lista, só linhaDoDefeito conta', () => {
    const { s, esperar } = sessao();
    expect(s.registrarLocalizacao(16)).toMatchObject({ correta: false });
    esperar();
    expect(s.registrarLocalizacao(15)).toMatchObject({ correta: true });
  });

  it('o tempo até a localização vem da primeira linha aceita que for apontada', () => {
    const { s, esperar } = sessao([15, 16]);
    esperar();
    s.registrarLocalizacao(16);
    expect(s.registro().resumo.tempoAteLocalizacaoMs).toBe(INTERVALO_ENTRE_LOCALIZACOES_MS);
  });

  it('o registro marca a versão em que isso mudou', () => {
    expect(VERSAO_DO_REGISTRO).toBeGreaterThanOrEqual(7);
  });
});
