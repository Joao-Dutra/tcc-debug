import { beforeEach, describe, expect, it } from 'vitest';
import {
  VERSAO_DO_REGISTRO,
  arquivarSessao,
  ativarDestinoRemoto,
  criarSessao,
  haPendentesDe,
  limparArquivo,
  resumirSessao,
  sincronizarPendentes,
} from './metricas';
import type { MarcaDoEstudo } from './metricas';

/**
 * A sessão aberta no percurso do estudo (D37): a marca vai no registro, o
 * encerramento entra no log, e a sessão de fora do estudo não muda de forma.
 */

const marca: MarcaDoEstudo = { aplicacao: 'piloto-nov', etapa: 2, aquecimento: false };

function sessaoComRelogio(estudo?: MarcaDoEstudo) {
  let agora = 0;
  const sessao = criarSessao({ exercicioId: 'x', linhaDoDefeito: 3, agora: () => agora, estudo });
  return { sessao, avancar: (ms: number) => (agora += ms) };
}

describe('a marca do estudo no registro', () => {
  it('vai no registro da sessão do percurso', () => {
    expect(sessaoComRelogio(marca).sessao.registro().estudo).toEqual(marca);
  });

  it('fora do estudo, o registro não ganha o campo', () => {
    expect(sessaoComRelogio().sessao.registro()).not.toHaveProperty('estudo');
  });

  it('a versão do registro marca a coleta com a área do estudo', () => {
    expect(VERSAO_DO_REGISTRO).toBeGreaterThanOrEqual(11);
  });
});

describe('o encerramento', () => {
  it('entra no log com o motivo, e o arrasto aberto vem antes dele', () => {
    const { sessao, avancar } = sessaoComRelogio(marca);
    sessao.moverBarra(1, 4, 10);
    avancar(480_000);
    sessao.registrarEncerramento('tempo-esgotado');
    expect(sessao.registro().eventos.map((e) => e.tipo)).toEqual(['navegacao', 'encerramento']);
    expect(sessao.registro().eventos[1]).toEqual({ tipo: 'encerramento', t: 480_000, motivo: 'tempo-esgotado' });
  });

  it('não muda nenhuma das métricas do resumo', () => {
    const { sessao } = sessaoComRelogio(marca);
    sessao.registrarEncerramento('seguir');
    expect(sessao.registro().resumo).toEqual(resumirSessao([]));
  });
});

describe('pendentes de uma identidade', () => {
  beforeEach(() => limparArquivo());

  it('diz se ainda há sessão daquela identidade sem confirmação do banco', async () => {
    let recusar = true;
    await ativarDestinoRemoto({
      gravar: (registros) =>
        recusar ? Promise.reject(new Error('sem rede')) : Promise.resolve(registros.map((r) => r.id)),
    });
    const sessao = criarSessao({ exercicioId: 'x', linhaDoDefeito: 3, participanteId: 'uid-a', estudo: marca });
    arquivarSessao(sessao.registro());
    await sincronizarPendentes();
    expect(haPendentesDe('uid-a')).toBe(true);
    expect(haPendentesDe('uid-b')).toBe(false);

    recusar = false;
    await sincronizarPendentes();
    expect(haPendentesDe('uid-a')).toBe(false);
  });
});
