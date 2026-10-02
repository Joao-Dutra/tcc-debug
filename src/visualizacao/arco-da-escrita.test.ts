import { describe, expect, it } from 'vitest';
import {
  FOLGA_DA_ETIQUETA,
  MARGEM_DO_ARCO,
  arcoComValor,
  controleDoArco,
  etiquetaDoValor,
  meioDoArco,
  pontaDoArco,
  seSobrepoem,
} from './arco-da-escrita';
import type { Ponto } from './arco-da-escrita';

/**
 * O arco da escrita (D27), verificado por cálculo.
 *
 * A regra que a primeira versão quebrou: **o arco cabe no quadro**. Entre
 * pontas distantes — a ponta da fileira e a caixa de uma variável — a curva
 * subia acima do viewBox e era desenhada partida ao meio, com um buraco bem no
 * alto. Um teste de cálculo pega isso; olhar o desenho só pegou por sorte.
 */

/** O alto da curva quadrática, que é onde ela chega mais perto da borda. */
const altoDaCurva = (de: Ponto, para: Ponto) => meioDoArco(de, para).y;

const topoDaCelula = (x: number): Ponto => ({ x, y: 66 });
const baseDaCaixa = (x: number): Ponto => ({ x, y: 50 });

describe('o arco cabe no quadro', () => {
  it.each([
    ['entre células vizinhas', topoDaCelula(77), topoDaCelula(125)],
    ['entre as duas pontas da fileira', topoDaCelula(77), topoDaCelula(413)],
    ['da célula para a caixa de uma variável', topoDaCelula(77), baseDaCaixa(417)],
    ['da caixa para a célula', baseDaCaixa(417), topoDaCelula(77)],
    ['entre pontas absurdamente distantes', topoDaCelula(0), baseDaCaixa(4000)],
  ])('%s', (_, de, para) => {
    expect(altoDaCurva(de, para)).toBeGreaterThanOrEqual(MARGEM_DO_ARCO - 0.001);
  });
});

describe('a forma do arco', () => {
  it('sobe acima das duas pontas', () => {
    const de = topoDaCelula(77);
    const para = topoDaCelula(221);
    expect(altoDaCurva(de, para)).toBeLessThan(Math.min(de.y, para.y));
  });

  it('sobe mais quanto mais longe as pontas', () => {
    const perto = altoDaCurva(topoDaCelula(77), topoDaCelula(125));
    const longe = altoDaCurva(topoDaCelula(77), topoDaCelula(365));
    expect(longe).toBeLessThan(perto);
  });

  it('o controle fica no meio, na horizontal', () => {
    expect(controleDoArco(topoDaCelula(80), topoDaCelula(200)).x).toBe(140);
  });

  it('a ponta de seta fecha no destino', () => {
    const para = topoDaCelula(221);
    expect(pontaDoArco(topoDaCelula(77), para)).toMatch(
      new RegExp(`^M ${para.x} ${para.y} L .+ L .+ Z$`)
    );
  });
});

describe('o valor no meio do arco (D32)', () => {
  const quadro = { x: 0, y: 0, largura: 480, altura: 220 };
  const de = topoDaCelula(77);
  const para = topoDaCelula(125);

  it('sem nada no caminho, o arco fica na altura natural', () => {
    const arco = arcoComValor(de, para, '5', [], quadro);
    expect(arco.livre).toBe(true);
    expect(arco.controle).toEqual(controleDoArco(de, para));
  });

  it('com algo no meio, o arco muda de altura e o valor continua no meio dele', () => {
    const natural = arcoComValor(de, para, '5', [], quadro);
    const obstaculo = { ...natural.etiqueta };
    const arco = arcoComValor(de, para, '5', [obstaculo], quadro);
    expect(arco.livre).toBe(true);
    expect(arco.controle.y).not.toBe(natural.controle.y);
    expect(arco.meio).toEqual(meioDoArco(de, para, arco.controle));
    expect(seSobrepoem(arco.etiqueta, obstaculo, FOLGA_DA_ETIQUETA)).toBe(false);
  });

  it('a etiqueta cresce com o texto, que é monoespaçado', () => {
    const curta = etiquetaDoValor({ x: 0, y: 0 }, '5');
    const longa = etiquetaDoValor({ x: 0, y: 0 }, '1234567');
    expect(longa.largura).toBeGreaterThan(curta.largura);
    expect(longa.x + longa.largura / 2).toBeCloseTo(0);
  });
});
