import { describe, expect, it } from 'vitest';
import {
  INTERVALO_ENTRE_LOCALIZACOES_MS,
  VERSAO_DO_REGISTRO,
  criarSessao,
  localizacoesDe,
} from './metricas';

/**
 * Intervalo entre tentativas de localização, verificado por execução (D25).
 *
 * Três regras. As tentativas continuam ilimitadas e o veredito continua
 * imediato (D7) — o que o intervalo faz é só impedir a próxima de chegar
 * antes da hora. O clique que chega antes não some: entra no log sem
 * veredito, porque insistir durante a espera é dado sobre a varredura. E o
 * intervalo é o mesmo depois de acerto e de erro, senão ele próprio contaria
 * ao estudante se o palpite anterior estava certo.
 */

const LINHA_DO_DEFEITO = 6;
const INTERVALO = INTERVALO_ENTRE_LOCALIZACOES_MS;

function sessaoComRelogio() {
  let instante = 0;
  const sessao = criarSessao({
    exercicioId: 'vetor-dobrar',
    linhaDoDefeito: LINHA_DO_DEFEITO,
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

describe('intervalo entre tentativas de localização', () => {
  it('a primeira tentativa é julgada na hora', () => {
    const { sessao } = sessaoComRelogio();
    expect(sessao.registrarLocalizacao(3)).toEqual({ julgada: true, correta: false });
  });

  it('antes do intervalo, o clique não é julgado e diz quanto falta', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarLocalizacao(3);
    avancar(4000);
    expect(sessao.registrarLocalizacao(LINHA_DO_DEFEITO)).toEqual({
      julgada: false,
      restanteMs: INTERVALO - 4000,
    });
  });

  it('o clique no intervalo entra no log sem veredito, e não conta como tentativa', () => {
    const { sessao, avancar } = sessaoComRelogio();
    avancar(1000);
    sessao.registrarLocalizacao(3);
    avancar(300);
    sessao.registrarLocalizacao(4);

    const { eventos, resumo } = sessao.registro();
    expect(eventos).toEqual([
      { tipo: 'localizacao', t: 1000, linha: 3, correta: false },
      { tipo: 'localizacao-no-intervalo', t: 1300, linha: 4 },
    ]);
    expect(localizacoesDe(eventos)).toHaveLength(1);
    expect(resumo.localizacoesTentadas).toBe(1);
  });

  it('passado o intervalo, a tentativa seguinte é julgada', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarLocalizacao(3);
    avancar(INTERVALO);
    expect(sessao.registrarLocalizacao(LINHA_DO_DEFEITO)).toEqual({
      julgada: true,
      correta: true,
    });
  });

  it('clicar de novo durante a espera não a prolonga', () => {
    // Se cada clique reiniciasse o intervalo, quem clica por impaciência
    // esperaria para sempre — e a barra na tela mentiria.
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarLocalizacao(3);
    for (let i = 0; i < 9; i++) {
      avancar(1000);
      expect(sessao.registrarLocalizacao(4).julgada).toBe(false);
    }
    avancar(1000);
    expect(sessao.registrarLocalizacao(4).julgada).toBe(true);
  });

  it('vale igual depois de um acerto', () => {
    const { sessao, avancar } = sessaoComRelogio();
    expect(sessao.registrarLocalizacao(LINHA_DO_DEFEITO)).toEqual({ julgada: true, correta: true });
    avancar(INTERVALO - 1);
    expect(sessao.registrarLocalizacao(3).julgada).toBe(false);
  });

  it('as tentativas continuam ilimitadas', () => {
    const { sessao, avancar } = sessaoComRelogio();
    for (let linha = 1; linha <= 40; linha++) {
      expect(sessao.registrarLocalizacao(linha).julgada).toBe(true);
      avancar(INTERVALO);
    }
    expect(sessao.registro().resumo.localizacoesTentadas).toBe(40);
  });

  it('o tempo até a localização vem da tentativa julgada, e não de um clique no intervalo', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarLocalizacao(3);
    avancar(2000);
    // A linha certa, mas dentro do intervalo: não foi julgada, e não localizou.
    sessao.registrarLocalizacao(LINHA_DO_DEFEITO);
    expect(sessao.registro().resumo.tempoAteLocalizacaoMs).toBeNull();

    avancar(INTERVALO);
    sessao.registrarLocalizacao(LINHA_DO_DEFEITO);
    expect(sessao.registro().resumo.tempoAteLocalizacaoMs).toBe(2000 + INTERVALO);
  });

  it('o registro marca a versão em que o intervalo passou a existir', () => {
    // Da versão 6 em diante: as seguintes herdam o intervalo (D30 subiu para 7
    // por outro motivo, sem mexer nele).
    expect(VERSAO_DO_REGISTRO).toBeGreaterThanOrEqual(6);
    expect(sessaoComRelogio().sessao.registro().versao).toBe(VERSAO_DO_REGISTRO);
  });
});
