// Só para este arquivo: o projeto de src/ carrega os tipos do Vite, e este
// teste lê arquivos do disco. Pelo ?raw do Vite não dá — o vitest desliga o
// processamento de CSS e o conteúdo chega vazio.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

/**
 * Movimento reduzido, verificado no arquivo (D20).
 *
 * Quem pede menos movimento ao sistema não pode receber animação nenhuma. A
 * regra é fácil de cumprir e fácil de esquecer: basta uma animação nova entrar
 * sem a exceção correspondente. Por isso ela é conferida aqui, e não só na
 * revisão — o mesmo motivo que levou o quadro-denúncia a virar teste (D16).
 *
 * O que este teste alcança é o arquivo: toda regra que anima precisa ter a
 * exceção escrita. Que o navegador de fato aplique a exceção, e que a
 * preferência do sistema chegue até ele, é verificação de navegador e mora nos
 * testes de ponta a ponta.
 */

interface Regra {
  seletores: string[];
  corpo: string;
  /** A regra está dentro de um @media de movimento reduzido. */
  emMovimentoReduzido: boolean;
}

/**
 * Percorre o CSS acompanhando o aninhamento. Um analisador de verdade seria
 * dependência nova para ler dois níveis de chaves; este basta porque só
 * precisa separar prelúdio de corpo e saber em que @media está.
 */
function lerRegras(fonte: string): Regra[] {
  const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '');
  const regras: Regra[] = [];

  const percorrer = (texto: string, emMovimentoReduzido: boolean) => {
    let i = 0;
    while (i < texto.length) {
      const abre = texto.indexOf('{', i);
      if (abre === -1) return;
      const prelúdio = texto.slice(i, abre).trim();

      // Fecha na chave que casa com esta, e não na primeira: dentro de um
      // @media há blocos inteiros.
      let profundidade = 1;
      let j = abre + 1;
      while (j < texto.length && profundidade > 0) {
        if (texto[j] === '{') profundidade++;
        else if (texto[j] === '}') profundidade--;
        j++;
      }
      const corpo = texto.slice(abre + 1, j - 1);

      if (prelúdio.startsWith('@keyframes')) {
        // Os quadros de uma animação não são regras que animam.
      } else if (prelúdio.startsWith('@')) {
        const reduz = /prefers-reduced-motion\s*:\s*reduce/.test(prelúdio);
        percorrer(corpo, emMovimentoReduzido || reduz);
      } else {
        regras.push({
          seletores: prelúdio.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
          corpo,
          emMovimentoReduzido,
        });
      }
      i = j;
    }
  };

  percorrer(semComentarios, false);
  return regras;
}

const regras = lerRegras(css);
const anima = (corpo: string) => /(^|[;{\s])animation\s*:\s*(?!none)/.test(corpo);
const desliga = (corpo: string) => /(^|[;{\s])animation\s*:\s*none/.test(corpo);

describe('movimento reduzido', () => {
  const desligados = new Set(
    regras
      .filter((r) => r.emMovimentoReduzido && desliga(r.corpo))
      .flatMap((r) => r.seletores)
  );

  const queAnimam = regras.filter((r) => !r.emMovimentoReduzido && anima(r.corpo));

  it('encontra as animações do arquivo', () => {
    // Guarda contra o analisador parar de enxergar as regras e o teste passar
    // por vazio. Sobe quando uma animação nova entrar — de propósito, para a
    // exceção dela ser conferida junto.
    expect(queAnimam.length).toBeGreaterThanOrEqual(5);
  });

  it.each(queAnimam.flatMap((r) => r.seletores))(
    'desliga a animação de %s com prefers-reduced-motion',
    (seletor) => {
      expect(desligados).toContain(seletor);
    }
  );

  it('mantém as transições do desenho presas à preferência do sistema', () => {
    // As animações dos visualizadores são do motion, e não do CSS: quem as
    // desliga é o MotionConfig da raiz.
    expect(main).toMatch(/reducedMotion="user"/);
  });
});
