import { describe, expect, it } from 'vitest';
import { VERSAO_DO_REGISTRO, criarSessao, sessaoValida } from './metricas';

/**
 * O tutorial do participante no log da sessão (D32).
 *
 * O que se cobra: quando ele abriu e por quê, quando fechou e como, e até que
 * passo chegou — e que nada disso mexe no que já era medido. O tutorial abre
 * dentro da sessão, então o tempo dele cai nos tempos até a primeira execução,
 * até a localização e até a correção; é pelos dois eventos que a análise o
 * desconta.
 */

function sessaoComRelogio() {
  let agora = 0;
  const sessao = criarSessao({ exercicioId: 'x', linhaDoDefeito: 3, agora: () => agora });
  return { sessao, avancar: (ms: number) => (agora += ms) };
}

describe('tutorial no registro', () => {
  it('grava a abertura com o motivo e o fechamento com o desfecho e o passo alcançado', () => {
    const { sessao, avancar } = sessaoComRelogio();
    sessao.registrarTutorialAberto('primeira-entrada');
    avancar(12_000);
    sessao.registrarTutorialFechado('pulado', 2, 6);
    avancar(30_000);
    sessao.registrarTutorialAberto('ajuda');
    avancar(40_000);
    sessao.registrarTutorialFechado('concluido', 6, 6);

    expect(sessao.registro().eventos).toEqual([
      { tipo: 'tutorial-aberto', t: 0, motivo: 'primeira-entrada' },
      { tipo: 'tutorial-fechado', t: 12_000, desfecho: 'pulado', passoAlcancado: 2, totalDePassos: 6 },
      { tipo: 'tutorial-aberto', t: 42_000, motivo: 'ajuda' },
      { tipo: 'tutorial-fechado', t: 82_000, desfecho: 'concluido', passoAlcancado: 6, totalDePassos: 6 },
    ]);
  });

  it('não muda nenhuma das métricas do resumo', () => {
    const com = sessaoComRelogio();
    com.sessao.registrarTutorialAberto('primeira-entrada');
    com.sessao.registrarTutorialFechado('concluido', 6, 6);
    const sem = sessaoComRelogio();
    expect(com.sessao.registro().resumo).toEqual(sem.sessao.registro().resumo);
  });

  // Ver o tutorial não é ação sobre o exercício: a sessão de quem só o leu e
  // saiu continua sendo de quem abriu e fechou (D22).
  it('ver o tutorial não torna a sessão válida', () => {
    const { sessao } = sessaoComRelogio();
    sessao.registrarTutorialAberto('primeira-entrada');
    sessao.registrarTutorialFechado('concluido', 6, 6);
    expect(sessaoValida(sessao.registro())).toBe(false);
  });

  it('a versão do registro marca a coleta com tutorial', () => {
    expect(VERSAO_DO_REGISTRO).toBeGreaterThanOrEqual(9);
    expect(sessaoComRelogio().sessao.registro().versao).toBe(VERSAO_DO_REGISTRO);
  });
});
