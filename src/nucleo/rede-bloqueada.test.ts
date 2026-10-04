import { beforeAll, describe, expect, it } from 'vitest';
import { MENSAGEM_DA_REDE, NOMES_DA_REDE, bloquearRede } from './rede-bloqueada';
import { abrirWorker } from './worker-em-teste';
import type { RodarNoWorker } from './worker-em-teste';

/**
 * O Worker sem rede (D33).
 *
 * Duas frentes. O bloqueio num escopo de mentira, onde dá para conferir que o
 * original sumiu de toda a cadeia de protótipos e que a troca não se desfaz.
 * E o Worker de verdade — o mesmo arquivo do navegador —, executando código de
 * exercício que tenta cada caminho: é o que o aluno teria se um professor
 * publicasse um exercício que manda dado para fora.
 */

describe('o bloqueio num escopo de mentira', () => {
  function escopoComRede() {
    const original = () => 'rede';
    const prototipo: Record<string, unknown> = {};
    const escopo: Record<string, unknown> = Object.create(prototipo);
    for (const nome of NOMES_DA_REDE) {
      // Um no protótipo e outro no próprio objeto, como pode vir de um
      // navegador ou de outro.
      prototipo[nome] = original;
      escopo[nome] = original;
    }
    return { escopo, prototipo };
  }

  it.each(NOMES_DA_REDE)('%s recusa ao ser chamado e ao ser construído', (nome) => {
    const { escopo } = escopoComRede();
    bloquearRede(escopo);
    const recusado = escopo[nome] as () => unknown;
    expect(() => recusado()).toThrow(MENSAGEM_DA_REDE);
    expect(() => new (recusado as unknown as new () => unknown)()).toThrow(MENSAGEM_DA_REDE);
  });

  it('o original some também do protótipo', () => {
    const { escopo, prototipo } = escopoComRede();
    bloquearRede(escopo);
    for (const nome of NOMES_DA_REDE) expect(prototipo).not.toHaveProperty(nome);
  });

  it('a troca não se desfaz: nem atribuindo, nem redefinindo', () => {
    const { escopo } = escopoComRede();
    bloquearRede(escopo);
    expect(() => {
      escopo.fetch = () => 'de volta';
    }).toThrow();
    expect(() => Object.defineProperty(escopo, 'fetch', { value: () => 'de volta' })).toThrow();
    expect(() => (escopo.fetch as () => unknown)()).toThrow(MENSAGEM_DA_REDE);
  });
});

describe('o código de exercício, no Worker', () => {
  let rodar: RodarNoWorker;
  beforeAll(async () => {
    rodar = await abrirWorker();
  });

  const TENTATIVAS: [string, string][] = [
    ['fetch', 'fetch("http://exemplo.invalid/");'],
    ['XMLHttpRequest', 'var pedido = new XMLHttpRequest();'],
    ['WebSocket', 'var canal = new WebSocket("ws://exemplo.invalid/");'],
    ['EventSource', 'var fonte = new EventSource("http://exemplo.invalid/");'],
    ['importScripts', 'importScripts("http://exemplo.invalid/a.js");'],
    // Pelo escopo global, e não pelo nome solto: o mesmo bloqueio.
    ['fetch pelo escopo', 'globalThis.fetch("http://exemplo.invalid/");'],
  ];

  it.each(TENTATIVAS)('%s é recusado, com a mensagem em português', (_, codigo) => {
    const resultado = rodar({ codigo: `var itens = [1];\n${codigo}`, variaveisObservadas: ['itens'] });
    expect(resultado.erro).toContain(MENSAGEM_DA_REDE);
  });

  // Sem este, o teste acima passaria com qualquer erro — inclusive com o
  // Worker quebrado para todo código.
  it('código sem rede continua rodando', () => {
    const resultado = rodar({ codigo: 'var itens = [1, 2];', variaveisObservadas: ['itens'] });
    expect(resultado.erro).toBeUndefined();
    expect(resultado.instantaneos.length).toBeGreaterThan(0);
  });
});
