/**
 * Geometria do arco que mostra o valor mudando de lugar (D27).
 *
 * Fica fora do componente porque é cálculo, e cálculo se verifica sem
 * navegador: o arco precisa caber no quadro em qualquer par de pontas, e a
 * primeira versão não cabia — numa cópia entre pontas distantes a curva subia
 * acima do viewBox e aparecia partida ao meio.
 *
 * O valor copiado fica parado no meio do arco, em todo quadro em que o arco
 * aparece (D32). Antes ele percorria o arco numa animação, e o passo a passo,
 * que é o modo principal, mostrava o quadro parado — sem o valor. Por isso a
 * altura do arco também é escolhida aqui: é ela que decide onde fica o meio, e
 * o meio não pode cair em cima da caixa de uma variável nem de um marcador.
 */

export interface Ponto {
  x: number;
  y: number;
}

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Folga entre o alto do arco e a borda de cima do quadro. */
export const MARGEM_DO_ARCO = 8;

const ALTURA_MINIMA = 26;
const ALTURA_MAXIMA = 70;

/**
 * Até onde a procura de um meio livre pode achatar ou erguer o arco. Achatado
 * demais, ele deixa de se ler como curva; erguido demais, encosta na margem —
 * e ali o controle para de subir, então tentar mais alto não muda nada.
 */
const ALTURA_MINIMA_NA_PROCURA = 8;
const ALTURA_MAXIMA_NA_PROCURA = 220;
const PASSO_DA_PROCURA = 2;

/**
 * Medidas da etiqueta do valor. A fonte é monoespaçada (D19), então a largura
 * sai do número de caracteres; a constante é a largura de um caractere a 12 px
 * na Atkinson Hyperlegible Mono em negrito, arredondada para cima.
 */
export const FONTE_DO_VALOR = 12;
const LARGURA_DO_CARACTERE = 7.6;
const RESPIRO_LATERAL = 5;
export const ALTURA_DA_ETIQUETA = 17;

/** Distância mínima entre a etiqueta e qualquer outra coisa desenhada. */
export const FOLGA_DA_ETIQUETA = 3;

/** A altura que o arco teria sem nada no caminho do meio dele. */
export function alturaNatural(de: Ponto, para: Ponto): number {
  return Math.min(Math.max(ALTURA_MINIMA, Math.abs(para.x - de.x) / 3), ALTURA_MAXIMA);
}

/**
 * O arco sobe por cima da fileira, e não corta as células: o caminho do valor
 * precisa ser lido sem se confundir com o conteúdo por onde passa. Quanto mais
 * longe as pontas, mais alto o arco — até onde ele ainda cabe no quadro.
 */
export function controleDoArco(
  de: Ponto,
  para: Ponto,
  altura: number = alturaNatural(de, para)
): Ponto {
  // O alto da curva fica em (de.y + 2·controle.y + para.y) / 4; daí o controle
  // que põe esse alto exatamente na margem.
  const controleNaMargem = (4 * MARGEM_DO_ARCO - de.y - para.y) / 2;
  return {
    x: (de.x + para.x) / 2,
    y: Math.max(Math.min(de.y, para.y) - altura, controleNaMargem),
  };
}

export const caminhoDoArco = (de: Ponto, para: Ponto, controle = controleDoArco(de, para)): string =>
  `M ${de.x} ${de.y} Q ${controle.x} ${controle.y} ${para.x} ${para.y}`;

/** O meio da curva, que é onde o valor fica. */
export function meioDoArco(de: Ponto, para: Ponto, controle = controleDoArco(de, para)): Ponto {
  return { x: (de.x + 2 * controle.x + para.x) / 4, y: (de.y + 2 * controle.y + para.y) / 4 };
}

/** Ponta de seta no destino, na direção em que a curva chega nele. */
export function pontaDoArco(de: Ponto, para: Ponto, controle = controleDoArco(de, para)): string {
  const angulo = Math.atan2(para.y - controle.y, para.x - controle.x);
  const aba = (giro: number) =>
    `${para.x - Math.cos(angulo + giro) * 9} ${para.y - Math.sin(angulo + giro) * 9}`;
  return `M ${para.x} ${para.y} L ${aba(0.42)} L ${aba(-0.42)} Z`;
}

/** O retângulo que a etiqueta do valor ocupa, centrada num ponto. */
export function etiquetaDoValor(centro: Ponto, texto: string): Retangulo {
  const largura = texto.length * LARGURA_DO_CARACTERE + 2 * RESPIRO_LATERAL;
  return {
    x: centro.x - largura / 2,
    y: centro.y - ALTURA_DA_ETIQUETA / 2,
    largura,
    altura: ALTURA_DA_ETIQUETA,
  };
}

export function seSobrepoem(a: Retangulo, b: Retangulo, folga = 0): boolean {
  return (
    a.x < b.x + b.largura + folga &&
    b.x < a.x + a.largura + folga &&
    a.y < b.y + b.altura + folga &&
    b.y < a.y + a.altura + folga
  );
}

export function contem(fora: Retangulo, dentro: Retangulo): boolean {
  return (
    dentro.x >= fora.x &&
    dentro.y >= fora.y &&
    dentro.x + dentro.largura <= fora.x + fora.largura &&
    dentro.y + dentro.altura <= fora.y + fora.altura
  );
}

export interface ArcoComValor {
  controle: Ponto;
  /** Centro da etiqueta: sempre o meio da curva desenhada. */
  meio: Ponto;
  etiqueta: Retangulo;
  /** Falso quando nenhuma altura deixou o meio livre; o teste cobra que não aconteça. */
  livre: boolean;
}

/**
 * O arco com o valor parado no meio dele, sem a etiqueta cair em cima de nada.
 *
 * A etiqueta fica sempre no meio da curva; o que se ajusta é a altura do arco.
 * Parte da altura natural e se afasta dela aos poucos — um degrau mais baixo,
 * um mais alto, e assim por diante —, para o arco mudar o mínimo que livra o
 * meio. Mover a etiqueta ao longo da curva também livraria, mas o estudante
 * aprende onde procurar o valor, e "no meio do arco" é uma regra que se
 * aprende de uma vez.
 */
export function arcoComValor(
  de: Ponto,
  para: Ponto,
  texto: string,
  obstaculos: readonly Retangulo[],
  quadro: Retangulo
): ArcoComValor {
  const tentar = (altura: number) => {
    const controle = controleDoArco(de, para, altura);
    const meio = meioDoArco(de, para, controle);
    const etiqueta = etiquetaDoValor(meio, texto);
    const livre =
      contem(quadro, etiqueta) &&
      obstaculos.every((o) => !seSobrepoem(etiqueta, o, FOLGA_DA_ETIQUETA));
    return { controle, meio, etiqueta, livre };
  };

  const natural = alturaNatural(de, para);
  const primeira = tentar(natural);
  if (primeira.livre) return primeira;

  const alcance = Math.max(natural - ALTURA_MINIMA_NA_PROCURA, ALTURA_MAXIMA_NA_PROCURA - natural);
  for (let passo = PASSO_DA_PROCURA; passo <= alcance; passo += PASSO_DA_PROCURA) {
    for (const altura of [natural - passo, natural + passo]) {
      if (altura < ALTURA_MINIMA_NA_PROCURA || altura > ALTURA_MAXIMA_NA_PROCURA) continue;
      const tentativa = tentar(altura);
      if (tentativa.livre) return tentativa;
    }
  }
  return primeira;
}
