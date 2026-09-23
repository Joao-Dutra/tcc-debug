/**
 * Geometria do arco que mostra o valor mudando de lugar (D27).
 *
 * Fica fora do componente porque é cálculo, e cálculo se verifica sem
 * navegador: o arco precisa caber no quadro em qualquer par de pontas, e a
 * primeira versão não cabia — numa cópia entre pontas distantes a curva subia
 * acima do viewBox e aparecia partida ao meio.
 */

export interface Ponto {
  x: number;
  y: number;
}

/** Folga entre o alto do arco e a borda de cima do quadro. */
export const MARGEM_DO_ARCO = 8;

const ALTURA_MINIMA = 26;
const ALTURA_MAXIMA = 70;

/**
 * O arco sobe por cima da fileira, e não corta as células: o caminho do valor
 * precisa ser lido sem se confundir com o conteúdo por onde passa. Quanto mais
 * longe as pontas, mais alto o arco — até onde ele ainda cabe no quadro.
 */
export function controleDoArco(de: Ponto, para: Ponto): Ponto {
  const altura = Math.min(Math.max(ALTURA_MINIMA, Math.abs(para.x - de.x) / 3), ALTURA_MAXIMA);
  // O alto da curva fica em (de.y + 2·controle.y + para.y) / 4; daí o controle
  // que põe esse alto exatamente na margem.
  const controleNaMargem = (4 * MARGEM_DO_ARCO - de.y - para.y) / 2;
  return {
    x: (de.x + para.x) / 2,
    y: Math.max(Math.min(de.y, para.y) - altura, controleNaMargem),
  };
}

export const caminhoDoArco = (de: Ponto, para: Ponto): string => {
  const c = controleDoArco(de, para);
  return `M ${de.x} ${de.y} Q ${c.x} ${c.y} ${para.x} ${para.y}`;
};

/** O meio da curva, por onde o valor passa a caminho do destino. */
export function meioDoArco(de: Ponto, para: Ponto): Ponto {
  const c = controleDoArco(de, para);
  return { x: (de.x + 2 * c.x + para.x) / 4, y: (de.y + 2 * c.y + para.y) / 4 };
}

/** Ponta de seta no destino, na direção em que a curva chega nele. */
export function pontaDoArco(de: Ponto, para: Ponto): string {
  const c = controleDoArco(de, para);
  const angulo = Math.atan2(para.y - c.y, para.x - c.x);
  const aba = (giro: number) =>
    `${para.x - Math.cos(angulo + giro) * 9} ${para.y - Math.sin(angulo + giro) * 9}`;
  return `M ${para.x} ${para.y} L ${aba(0.42)} L ${aba(-0.42)} Z`;
}
