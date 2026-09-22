import { describe, expect, it, vi } from 'vitest';
import type { DestinoRemoto, RegistroDeSessao } from './metricas';

/**
 * Envio das sessões ao banco, verificado por execução (D21).
 *
 * A regra que este arquivo protege é uma só, e é a razão de o espelho local
 * ter sobrevivido a D21: **falhar em gravar no banco não pode custar o dado.**
 * A rede da sala de aula vai cair no meio da coleta, e é fácil escrever um
 * envio que, ao falhar, marca a sessão como enviada e a perde em silêncio —
 * justamente o tipo de defeito que só se descobre depois do experimento, quando
 * não tem mais remédio.
 *
 * O módulo guarda estado próprio (arquivo, confirmações, destino), então cada
 * teste carrega uma cópia nova em vez de tentar desfazer a anterior.
 */

type Metricas = typeof import('./metricas');

async function carregarMetricas(): Promise<Metricas> {
  vi.resetModules();
  return import('./metricas');
}

/** Destino de mentira, com a rede sob controle do teste. */
function destinoDeTeste() {
  const lotes: string[][] = [];
  let derrubado = false;

  const destino: DestinoRemoto = {
    gravar(registros: RegistroDeSessao[]) {
      if (derrubado) return Promise.reject(new Error('rede caiu'));
      lotes.push(registros.map((r) => r.id));
      return Promise.resolve();
    },
  };

  return {
    destino,
    lotes,
    derrubarRede: () => {
      derrubado = true;
    },
    religarRede: () => {
      derrubado = false;
    },
  };
}

function sessaoQualquer(m: Metricas, exercicioId = 'vetor-dobrar') {
  return m.criarSessao({ exercicioId, linhaDoDefeito: 3, andaime: 'com-apoio' });
}

describe('envio das sessões ao banco', () => {
  it('a sessão que não conseguiu subir continua no aparelho e sobe no reenvio', async () => {
    const m = await carregarMetricas();
    const banco = destinoDeTeste();
    banco.derrubarRede();
    await m.ativarDestinoRemoto(banco.destino);

    const sessao = sessaoQualquer(m);
    m.arquivarSessao(sessao.registro());
    await m.sincronizarPendentes();

    // O que importa: o dado não sumiu junto com a tentativa.
    expect(m.sessoesArquivadas()).toHaveLength(1);
    expect(m.estadoDoEnvio().pendentes).toBe(1);
    expect(m.estadoDoEnvio().ultimaFalha).toContain('rede caiu');
    expect(banco.lotes).toEqual([]);

    banco.religarRede();
    await m.sincronizarPendentes();

    expect(banco.lotes).toEqual([[sessao.id]]);
    expect(m.estadoDoEnvio().pendentes).toBe(0);
    expect(m.estadoDoEnvio().ultimaFalha).toBeNull();
  });

  it('o que ficou no aparelho sobe assim que o banco é ligado', async () => {
    const m = await carregarMetricas();
    // Sessões coletadas antes de haver banco — ou recuperadas do espelho de
    // uma carga anterior da página (D15).
    const primeira = sessaoQualquer(m, 'pilha-reverter');
    const segunda = sessaoQualquer(m, 'fila-inverter');
    m.arquivarSessao(primeira.registro());
    m.arquivarSessao(segunda.registro());
    expect(m.estadoDoEnvio().ativo).toBe(false);

    const banco = destinoDeTeste();
    await m.ativarDestinoRemoto(banco.destino);

    expect(banco.lotes).toEqual([[primeira.id, segunda.id]]);
    expect(m.estadoDoEnvio().pendentes).toBe(0);
  });

  it('não reenvia o que já foi confirmado, e reenvia o que mudou depois', async () => {
    const m = await carregarMetricas();
    const banco = destinoDeTeste();
    await m.ativarDestinoRemoto(banco.destino);

    const sessao = sessaoQualquer(m);
    m.arquivarSessao(sessao.registro());
    await m.sincronizarPendentes();
    await m.sincronizarPendentes();

    expect(banco.lotes).toHaveLength(1);

    // O estudante continuou no exercício e a sessão foi rearquivada: o retrato
    // no banco está velho e precisa subir de novo.
    sessao.registrarDica(0);
    m.arquivarSessao(sessao.registro());
    await m.sincronizarPendentes();

    expect(banco.lotes).toEqual([[sessao.id], [sessao.id]]);
    // E nunca duplicada no arquivo — o id é a identidade da sessão dos dois
    // lados, e é por isso que reenviar é seguro.
    expect(m.sessoesArquivadas()).toHaveLength(1);
  });

  it('sem banco configurado, arquivar continua funcionando como antes', async () => {
    const m = await carregarMetricas();
    const sessao = sessaoQualquer(m);
    m.arquivarSessao(sessao.registro());

    expect(m.sessoesArquivadas()).toHaveLength(1);
    expect(m.estadoDoEnvio()).toEqual({ ativo: false, pendentes: 1, ultimaFalha: null });
  });
});

describe('identidade no registro', () => {
  it('a identidade que chega depois da tela abrir ainda carimba a sessão', async () => {
    const m = await carregarMetricas();
    // A entrada anônima é uma ida à rede e o primeiro exercício não espera por
    // ela: a sessão começa sem identidade nenhuma.
    const sessao = sessaoQualquer(m);
    expect(sessao.registro().participanteId).toBeNull();

    m.definirParticipante('participante-1');

    expect(sessao.registro().participanteId).toBe('participante-1');
    expect(sessao.registro().versao).toBe(m.VERSAO_DO_REGISTRO);
  });

  it('a versão do registro distingue a coleta com identidade da sem', async () => {
    const m = await carregarMetricas();
    // Sessões sem identidade existem (versão 3 e anteriores, ou banco
    // desligado); a versão é o que impede a análise de lê-las como se fossem
    // de mais um participante.
    expect(m.VERSAO_DO_REGISTRO).toBe(4);
  });

  it('limpar o aparelho não desfaz o que já subiu', async () => {
    const m = await carregarMetricas();
    const banco = destinoDeTeste();
    await m.ativarDestinoRemoto(banco.destino);

    const sessao = sessaoQualquer(m);
    m.arquivarSessao(sessao.registro());
    await m.sincronizarPendentes();

    m.limparArquivo();

    // O destino não tem operação de apagar, e o banco não tem política de
    // delete: limpar é do aparelho, e o registro que subiu está a salvo.
    expect(m.sessoesArquivadas()).toEqual([]);
    expect(banco.lotes).toEqual([[sessao.id]]);
    expect(m.estadoDoEnvio().pendentes).toBe(0);
  });
});
