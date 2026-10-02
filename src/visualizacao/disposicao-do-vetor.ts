import { arcoComValor } from './arco-da-escrita';
import { DESTAQUE, MARCADOR } from './estilos';
import type { ArcoComValor, Ponto, Retangulo } from './arco-da-escrita';
import type { Instantaneo, LugarDoValor } from '../nucleo/tipos';

/**
 * Onde cada peça do desenho do vetor fica, calculado sem React.
 *
 * Saiu do componente quando o valor da escrita passou a ficar parado no meio
 * do arco (D32): a regra de que ele não cai em cima da caixa de uma variável
 * nem de um marcador só se verifica sabendo onde estão as caixas e os
 * marcadores, e isso precisava ser cálculo que um teste alcança — em cada
 * quadro dos exercícios do catálogo, e não num punhado escolhido à mão.
 *
 * O componente continua puro, e este módulo também: recebe o instantâneo e o
 * que o nível de apoio revela, e devolve coordenadas.
 */

export const ALTURA_DO_QUADRO = 220;

export const LARGURA_CELULA = 42;
export const ALTURA_CELULA = 46;
const ESPACO = 6;
export const X_INICIAL = 56;
export const Y_CELULA = 66;

/** Acima disto a fileira não cabe no viewBox; o excedente vira um "+N". */
export const LIMITE_DE_CELULAS = 8;
const MAX_CARACTERES = 7;

/** Faixa do primeiro marcador e distância entre duas faixas. */
const Y_PRIMEIRA_FAIXA = 120;
const ALTURA_DA_FAIXA = 26;
/** Altura da cabeça da seta, do ápice à base. */
export const ALTURA_DA_CABECA = 12;
/**
 * Deslocamento lateral entre marcadores vizinhos. Sem ele, dois marcadores na
 * mesma posição — `inicio == meio`, que é o fim de toda busca binária —
 * sobreporiam as hastes num traço só.
 */
const DESVIO_ENTRE_MARCADORES = 10;

/**
 * Caixas das variáveis que guardam valor. Ficam sempre ao lado da fileira, na
 * altura das células e numa linha só: perto do vetor, o caminho de um valor
 * entre a caixa e uma posição é curto, e a miniatura (D20), que se enquadra
 * pelo que foi desenhado, não encolhe o vetor para alcançar uma caixa lá no
 * canto.
 *
 * Até D32, com a fileira ocupando a largura toda, elas subiam para cima dela —
 * que é a faixa por onde o arco da escrita passa, e onde o valor dele passou a
 * ficar parado. Agora é o quadro que alarga. A largura sai do que o exercício
 * observa, e não do que existe no quadro, para o desenho não mudar de escala
 * de um passo para o outro quando uma variável aparece; pela mesma razão, cada
 * caixa tem uma vaga fixa, na ordem das variáveis observadas.
 *
 * Entre a fileira e a primeira caixa fica a vaga de uma posição a mais: é ali
 * que o marcador que passou da última posição estaciona, e a haste dele, logo
 * abaixo de uma caixa, pareceria apontar para ela.
 */
export const ALTURA_CAIXA = 30;
export const LARGURA_CAIXA = 46;
const ESPACO_ENTRE_CAIXAS = 10;
const DISTANCIA_DA_FILEIRA = LARGURA_CELULA + ESPACO + 6;
const Y_CAIXA_AO_LADO = Y_CELULA + (ALTURA_CELULA - ALTURA_CAIXA) / 2;
/** Largura mínima do quadro, que é a de sempre para uma fileira curta. */
const LARGURA_MINIMA_DO_QUADRO = 480;
const MARGEM_DIREITA = 8;
/** Espaço do "+N" depois da última caixa, quando há mais variáveis que vagas. */
const ESPACO_DO_EXCEDENTE = 26;
const MAX_CAIXAS = 3;

/**
 * Distância mínima entre as duas pontas para o arco da escrita ser desenhado.
 * Abaixo disso as pontas caem no mesmo lugar do desenho — é o que acontece em
 * `inicio = meio`, em que o movimento já é o próprio marcador mudando de
 * posição — e o arco seria um rabisco sem sentido.
 */
const DISTANCIA_MINIMA_DO_ARCO = 14;

/**
 * Tamanhos dos textos que dividem o quadro com o valor do arco, para medir a
 * área que eles ocupam. Fonte monoespaçada (D19): a largura vem do número de
 * caracteres, com a largura de um caractere arredondada para cima.
 */
const TEXTO = {
  nomeDaCaixa: { tamanho: 9, caractere: 5.7 },
  rotuloDoMarcador: { tamanho: 11, caractere: 7 },
  foraDaFileira: { tamanho: 9, caractere: 5.7 },
  excedente: { tamanho: 11, caractere: 7 },
  legenda: { tamanho: 10, caractere: 6.3 },
} as const;

export const TEXTO_DA_LEGENDA = 'as posições são numeradas a partir de 0';
export const TEXTO_FORA_DA_FILEIRA = 'fora da fileira';

/** Valores chegam já serializados pelo Worker e podem ser objetos aninhados. */
export function textoDoValor(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (valor === null) return 'null';
  if (valor === undefined) return 'vazio';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export function encurtar(texto: string): string {
  return texto.length > MAX_CARACTERES ? `${texto.slice(0, MAX_CARACTERES - 1)}…` : texto;
}

export const xDaCelula = (i: number) => X_INICIAL + i * (LARGURA_CELULA + ESPACO);
export const centroDaCelula = (i: number) => xDaCelula(i) + LARGURA_CELULA / 2;
const apiceDaFaixa = (faixa: number) => Y_PRIMEIRA_FAIXA + faixa * ALTURA_DA_FAIXA;

/**
 * A área de um texto de uma linha. `y` é a linha de base, como no SVG; a área
 * vai do alto das maiúsculas até um pouco abaixo da base.
 */
function areaDoTexto(
  x: number,
  base: number,
  texto: string,
  medida: { tamanho: number; caractere: number },
  ancora: 'start' | 'middle' | 'end'
): Retangulo {
  const largura = texto.length * medida.caractere;
  const inicio = ancora === 'start' ? x : ancora === 'middle' ? x - largura / 2 : x - largura;
  return { x: inicio, y: base - medida.tamanho, largura, altura: medida.tamanho * 1.25 };
}

/**
 * A forma de cada marcador, na ordem em que o exercício os declarou. Seta
 * cheia, seta vazada (D19) e losango: a diferença é de silhueta, que sobrevive
 * à escala de cinza e ao nível sem apoio, onde os rótulos somem. Do quarto em
 * diante a forma se repete, e o que separa os marcadores é a faixa.
 */
function formaDoMarcador(ordem: number): { classe: string; desenho: string } {
  const cabeca = ALTURA_DA_CABECA;
  if (ordem === 0) {
    return { classe: MARCADOR.primeiro, desenho: `M -6 ${cabeca} L 6 ${cabeca} L 0 0 Z` };
  }
  if (ordem === 1) {
    return { classe: MARCADOR.segundo, desenho: `M -6 ${cabeca} L 6 ${cabeca} L 0 0 Z` };
  }
  return {
    classe: MARCADOR.primeiro,
    desenho: `M 0 0 L 6 ${cabeca / 2} L 0 ${cabeca} L -6 ${cabeca / 2} Z`,
  };
}

export interface CelulaDisposta {
  indice: number;
  x: number;
  /** O valor por extenso, para o título da posição. */
  completo: string;
  texto: string;
}

export interface CaixaDisposta {
  nome: string;
  texto: string;
  x: number;
  y: number;
}

export interface MarcadorDisposto {
  nome: string;
  indice: number;
  faixa: number;
  /** Centro da haste, já com o desvio lateral da faixa. */
  x: number;
  apice: number;
  /** Aponta para além de uma das pontas da fileira. */
  fora: boolean;
  /** Perto da ponta direita, o rótulo vira para a esquerda em vez de vazar. */
  rotuloAEsquerda: boolean;
  classe: string;
  desenho: string;
}

export interface MovimentoDisposto extends ArcoComValor {
  de: Ponto;
  para: Ponto;
  /** O valor que chegou ao destino, já encurtado como nas células. */
  valor: string;
}

export interface DisposicaoDoVetor {
  /** Largura do quadro: maior que a mínima só quando a fileira é longa. */
  largura: number;
  /** Quantas posições o vetor tem, desenhadas ou não. */
  tamanho: number;
  celulas: CelulaDisposta[];
  /** Posições além do limite, que viram um "+N". */
  ocultas: number;
  /** Fim do contorno da fileira, que é o que a caixa não pode invadir. */
  fimDaFileira: number;
  caixas: CaixaDisposta[];
  caixasOcultas: number;
  /** Onde o "+N" das caixas é escrito, quando há. */
  excedenteDasCaixas: Ponto;
  marcadores: MarcadorDisposto[];
  /** A posição que o marcador principal aponta, quando está na fileira. */
  apontada: number | null;
  /** A escrita que produziu o quadro, quando as duas pontas estão no desenho. */
  movimento: MovimentoDisposto | null;
  /** Tudo o que o valor do arco não pode cobrir; exportado para o teste. */
  obstaculos: Retangulo[];
}

export interface OpcoesDaDisposicao {
  rotulos: boolean;
  legendas: boolean;
}

export function disporVetor(
  instantaneo: Instantaneo | undefined,
  { rotulos, legendas }: OpcoesDaDisposicao
): DisposicaoDoVetor {
  const variaveis = instantaneo?.variaveis ?? {};
  const bruto = variaveis.itens;
  const itens = Array.isArray(bruto) ? (bruto as unknown[]) : [];

  const desenhadas = Math.min(itens.length, LIMITE_DE_CELULAS);
  const ocultas = itens.length - desenhadas;

  const celulas: CelulaDisposta[] = itens.slice(0, LIMITE_DE_CELULAS).map((valor, indice) => {
    const completo = textoDoValor(valor);
    return { indice, x: xDaCelula(indice), completo, texto: encurtar(completo) };
  });

  // Os marcadores são os que o exercício declarou, na ordem declarada, e só os
  // que já existem neste quadro: nos primeiros instantâneos nem toda variável
  // foi declarada ainda.
  const declarados = instantaneo?.marcadores ?? [];
  const presentes = declarados.filter((nome) => typeof variaveis[nome] === 'number');
  const marcadores: MarcadorDisposto[] = presentes.map((nome, faixa) => {
    const indice = variaveis[nome] as number;
    // O marcador vai até uma posição além de cada ponta: é lá que ele aparece
    // quando aponta para fora da fileira, e isso precisa ser visto.
    const limitado = Math.min(Math.max(indice, -1), desenhadas);
    const desvio = (faixa - (presentes.length - 1) / 2) * DESVIO_ENTRE_MARCADORES;
    return {
      nome,
      indice,
      faixa,
      x: centroDaCelula(limitado) + desvio,
      apice: apiceDaFaixa(faixa),
      fora: indice < 0 || indice >= desenhadas,
      rotuloAEsquerda: centroDaCelula(limitado) > 300,
      ...formaDoMarcador(faixa),
    };
  });

  // Toda variável observada que não é a estrutura nem marcador guarda um
  // valor: a temporária de uma troca, por exemplo. Sem a caixa, o valor que
  // sai de uma posição e volta para outra some do desenho no meio do caminho.
  // Quadro sem a lista das observadas — montado à mão, ou de antes de D32 —
  // reserva vaga só para o que tem.
  const ehCaixa = (nome: string) => nome !== 'itens' && !declarados.includes(nome);
  const reservadas = (instantaneo?.observadas ?? Object.keys(variaveis)).filter(ehCaixa);
  const comVaga = reservadas.slice(0, MAX_CAIXAS);
  const fimDaFileira = X_INICIAL + Math.max(desenhadas, 1) * (LARGURA_CELULA + ESPACO);
  const xDaPrimeiraCaixa = fimDaFileira + DISTANCIA_DA_FILEIRA;
  const passoDaCaixa = LARGURA_CAIXA + ESPACO_ENTRE_CAIXAS;
  const fimDasVagas = xDaPrimeiraCaixa + comVaga.length * passoDaCaixa - ESPACO_ENTRE_CAIXAS;
  const largura = Math.max(
    LARGURA_MINIMA_DO_QUADRO,
    fimDasVagas + (reservadas.length > MAX_CAIXAS ? ESPACO_DO_EXCEDENTE : 0) + MARGEM_DIREITA
  );
  const caixas: CaixaDisposta[] = comVaga.flatMap((nome, vaga) =>
    variaveis[nome] === undefined
      ? []
      : [
          {
            nome,
            texto: textoDoValor(variaveis[nome]),
            x: xDaPrimeiraCaixa + vaga * passoDaCaixa,
            y: Y_CAIXA_AO_LADO,
          },
        ]
  );
  const caixasOcultas = reservadas
    .slice(MAX_CAIXAS)
    .filter((nome) => variaveis[nome] !== undefined).length;

  // O anel envolve a posição que o marcador principal aponta. Quando ele
  // aponta para fora do vetor não há anel, e é essa ausência que denuncia o
  // estado — nada aqui sabe qual posição seria a certa.
  const principal = marcadores[0];
  const apontada =
    principal !== undefined && principal.indice >= 0 && principal.indice < desenhadas
      ? principal.indice
      : null;

  const excedenteDasCaixas = { x: fimDasVagas + 6, y: Y_CAIXA_AO_LADO + 20 };

  // Tudo o que já está no quadro e que o valor do arco não pode cobrir. As
  // células entram porque o valor por cima de uma delas se confundiria com o
  // conteúdo dela; o contorno tracejado da fileira não entra — é moldura, e
  // passar por cima dele não esconde nada.
  const obstaculos: Retangulo[] = [
    ...celulas.map((c) => ({ x: c.x, y: Y_CELULA, largura: LARGURA_CELULA, altura: ALTURA_CELULA })),
    ...caixas.map((c) => ({ x: c.x, y: c.y, largura: LARGURA_CAIXA, altura: ALTURA_CAIXA })),
    ...(rotulos
      ? caixas.map((c) =>
          areaDoTexto(c.x + LARGURA_CAIXA / 2, c.y - 5, c.nome, TEXTO.nomeDaCaixa, 'middle')
        )
      : []),
    ...marcadores.flatMap((m) => {
      const areas: Retangulo[] = [
        // A cabeça e a haste inteira, da fileira até a faixa.
        { x: m.x - 6, y: Y_CELULA + ALTURA_CELULA, largura: 12, altura: m.apice + ALTURA_DA_CABECA - (Y_CELULA + ALTURA_CELULA) },
      ];
      if (rotulos) {
        const xDoRotulo = m.rotuloAEsquerda ? m.x - 12 : m.x + 12;
        const ancora = m.rotuloAEsquerda ? 'end' : 'start';
        areas.push(
          areaDoTexto(xDoRotulo, m.apice + ALTURA_DA_CABECA - 1, `${m.nome} = ${m.indice}`, TEXTO.rotuloDoMarcador, ancora)
        );
        if (m.fora) {
          areas.push(
            areaDoTexto(xDoRotulo, m.apice + ALTURA_DA_CABECA + 10, TEXTO_FORA_DA_FILEIRA, TEXTO.foraDaFileira, ancora)
          );
        }
      }
      return areas;
    }),
    ...(apontada !== null
      ? [
          {
            x: xDaCelula(apontada) - DESTAQUE.folga - DESTAQUE.espessura / 2,
            y: Y_CELULA - DESTAQUE.folga - DESTAQUE.espessura / 2,
            largura: LARGURA_CELULA + 2 * DESTAQUE.folga + DESTAQUE.espessura,
            altura: ALTURA_CELULA + 2 * DESTAQUE.folga + DESTAQUE.espessura,
          },
        ]
      : []),
    ...(ocultas > 0
      ? [areaDoTexto(xDaCelula(LIMITE_DE_CELULAS) + 4, Y_CELULA + ALTURA_CELULA / 2 + 5, `+${ocultas}`, TEXTO.excedente, 'start')]
      : []),
    ...(caixasOcultas > 0
      ? [areaDoTexto(excedenteDasCaixas.x, excedenteDasCaixas.y, `+${caixasOcultas}`, TEXTO.excedente, 'start')]
      : []),
    ...(legendas ? [areaDoTexto(X_INICIAL - 6, 212, TEXTO_DA_LEGENDA, TEXTO.legenda, 'start')] : []),
  ];

  // Onde cada lugar do valor está no desenho, para o arco da escrita (D27).
  // Uma posição fora da fileira desenhada não tem ponto, e aí não há arco:
  // apontar para onde não se desenhou nada seria inventar.
  const pontoDoLugar = (lugar: LugarDoValor): Ponto | null => {
    if ('vetor' in lugar) {
      if (lugar.vetor !== 'itens' || lugar.indice < 0 || lugar.indice >= desenhadas) return null;
      return { x: centroDaCelula(lugar.indice), y: Y_CELULA };
    }
    const caixa = caixas.find((c) => c.nome === lugar.variavel);
    if (caixa) {
      // O caminho entra pela lateral voltada para a fileira. Pelo alto não,
      // que é onde fica o nome da variável — a ponta da seta caía em cima dele.
      return { x: caixa.x, y: caixa.y + ALTURA_CAIXA / 2 };
    }
    const marcador = marcadores.find((m) => m.nome === lugar.variavel);
    return marcador ? { x: marcador.x, y: marcador.apice } : null;
  };

  const valorDoLugar = (lugar: LugarDoValor): unknown => {
    if ('vetor' in lugar) {
      const vetor = variaveis[lugar.vetor];
      return Array.isArray(vetor) ? (vetor as unknown[])[lugar.indice] : undefined;
    }
    return variaveis[lugar.variavel];
  };

  const escrita = instantaneo?.escrita;
  const de = escrita ? pontoDoLugar(escrita.origem) : null;
  const para = escrita ? pontoDoLugar(escrita.destino) : null;
  // Entre dois marcadores não há arco: `inicio = meio` move o marcador, e o
  // movimento já é o próprio marcador indo para a posição do outro (D27). As
  // faixas ficam a alturas diferentes, então a distância sozinha não pegava
  // esse caso, e o arco saía das faixas cortando a fileira de baixo para cima.
  const ehMarcador = (lugar: LugarDoValor) =>
    'variavel' in lugar && presentes.includes(lugar.variavel);
  const entreMarcadores = escrita !== undefined && ehMarcador(escrita.origem) && ehMarcador(escrita.destino);
  let movimento: MovimentoDisposto | null = null;
  if (
    escrita &&
    de &&
    para &&
    !entreMarcadores &&
    Math.hypot(para.x - de.x, para.y - de.y) >= DISTANCIA_MINIMA_DO_ARCO
  ) {
    const valor = encurtar(textoDoValor(valorDoLugar(escrita.destino)));
    const quadro = { x: 0, y: 0, largura, altura: ALTURA_DO_QUADRO };
    movimento = { de, para, valor, ...arcoComValor(de, para, valor, obstaculos, quadro) };
  }

  return {
    largura,
    tamanho: itens.length,
    celulas,
    ocultas,
    fimDaFileira,
    caixas,
    caixasOcultas,
    excedenteDasCaixas,
    marcadores,
    apontada,
    movimento,
    obstaculos,
  };
}
