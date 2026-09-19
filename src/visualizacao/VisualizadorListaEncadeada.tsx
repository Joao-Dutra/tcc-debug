import { motion } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { CELULA, DESTAQUE, MARCADOR } from './estilos';
import type { EstadoDaCelula } from './estilos';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Representa a lista encadeada como nós em fileira, cada um com a anatomia
 * aberta em dois compartimentos rotulados — o do valor e o da ligação —, e com
 * os ponteiros desenhados acima e fora dos nós (direção 2a, ver D14).
 *
 * Os rótulos dos compartimentos vêm do próprio instantâneo, e não de nomes
 * fixos aqui dentro. O recurso só se justifica se o desenho corresponder ao
 * código que o estudante lê: um exercício que chame o campo de `seguinte` tem
 * de ver `seguinte` no nó. Qual campo é a ligação é inferido — é o campo que,
 * em algum nó do mesmo instantâneo, aponta para outro nó. Quando a inferência
 * não fecha, o nó é desenhado em bloco, com uma linha por campo, em vez de
 * adivinhar (limitação registrada em D14).
 *
 * Diferente das outras estruturas, esta é um grafo, e o desenho o reconstrói
 * a partir da identidade que o instantâneo preserva (D12). Nada é saneado:
 * ponteiro nulo, nó fora da cadeia e ciclo são desenhados como o que são.
 * O aterramento marca ausência de destino onde quer que apareça, inclusive no
 * fim normal da cadeia — o desenho registra o estado e não opina sobre ele.
 *
 * Convenção lida do instantâneo: `cabeca` é a raiz da cadeia e `atual` é o
 * ponteiro de trabalho, que recebe o anel. Qualquer outra variável que seja nó,
 * referência ou nula vira ponteiro, sem anel.
 *
 * Este componente é PURO: recebe um instantâneo e desenha.
 */

const LARGURA_NO = 118;
const ALTURA_NO = 68;
/** Faixa do topo do nó onde ficam os nomes dos campos. */
const FAIXA_ROTULO = 22;
/** Largura do compartimento do valor; o resto é o da ligação. */
const DIVISAO = 62;
const GAP = 32;
const X_INICIAL = 60;
const Y_NO = 84;
const Y_SOLTO = 240;
/** Altura em que as setas de ligação saem e chegam. */
const Y_LIGACAO = Y_NO + 46;
const BASE_DO_NO = Y_NO + ALTURA_NO;

/**
 * Nós desenhados por fileira. Com o nó de 118 px da 2a, três é o que cabe no
 * painel sem os rótulos de 9 px ficarem ilegíveis; além disso o desenho mostra
 * reticências no lugar do quarto nó (ver D14).
 */
const LIMITE_DE_NOS = 3;
const MAX_VALOR = 5;
const MAX_ROTULO = 9;
const MAX_LINHA_BLOCO = 17;
const ALTURA_LINHA_BLOCO = 15;

/** Onde ficam os ponteiros nulos: fora da fileira, à esquerda. */
const X_NULO = 30;
/** Onde fica o ponteiro para um nó que não coube: depois do último desenhado. */
const X_ALEM = X_INICIAL + LIMITE_DE_NOS * (LARGURA_NO + GAP) - GAP + 22;

type Objeto = Record<string, unknown>;

function ehObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoDoValor(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (valor === null) return 'null';
  if (valor === undefined) return 'vazio';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function encurtar(texto: string, maximo: number): string {
  return texto.length > maximo ? texto.slice(0, maximo - 1) + '…' : texto;
}

/** Reúne todo objeto que carrega identidade, venha de qual ponteiro vier. */
function indexar(valor: unknown, mapa: Map<number, Objeto>, vistos: Set<unknown>): void {
  if (!ehObjeto(valor) || vistos.has(valor)) return;
  vistos.add(valor);
  if (typeof valor.__id === 'number') mapa.set(valor.__id, valor);
  for (const campo of Object.values(valor)) indexar(campo, mapa, vistos);
}

/** Segue uma referência até o nó, ou devolve null quando não há para onde ir. */
function resolver(valor: unknown, mapa: Map<number, Objeto>): Objeto | null {
  if (!ehObjeto(valor)) return null;
  if (typeof valor.__ref === 'number') return mapa.get(valor.__ref) ?? null;
  if (typeof valor.__id === 'number') return valor;
  return null;
}

/**
 * Campos que o instantâneo mostra funcionando como ligação: em algum nó, o
 * conteúdo deles é outro nó. Um `null` não conta como prova — por isso um nó
 * sozinho, cuja ligação é nula, não tem campo de ligação reconhecível.
 */
function camposDeLigacao(nos: Objeto[], mapa: Map<number, Objeto>): Set<string> {
  const ligacoes = new Set<string>();
  for (const no of nos) {
    for (const [campo, conteudo] of Object.entries(no)) {
      if (campo !== '__id' && resolver(conteudo, mapa)) ligacoes.add(campo);
    }
  }
  return ligacoes;
}

interface Anatomia {
  campos: string[];
  /** Presente quando o nó tem exatamente um campo de ligação. */
  campoLigacao: string | null;
  campoValor: string | null;
  /** Um campo de valor e um de ligação: cabe nos dois compartimentos. */
  compartimentado: boolean;
  /** Mais de uma ligação: não dá para saber qual a fileira segue. */
  variasLigacoes: boolean;
}

function anatomiaDe(no: Objeto, ligacoes: Set<string>): Anatomia {
  const campos = Object.keys(no).filter((campo) => campo !== '__id');
  const deLigacao = campos.filter((campo) => ligacoes.has(campo));
  const deValor = campos.filter((campo) => !ligacoes.has(campo));
  return {
    campos,
    campoLigacao: deLigacao.length === 1 ? deLigacao[0] : null,
    campoValor: deValor.length === 1 ? deValor[0] : null,
    compartimentado: deLigacao.length === 1 && deValor.length === 1,
    variasLigacoes: deLigacao.length > 1,
  };
}

function alturaDoNo(anatomia: Anatomia): number {
  if (anatomia.compartimentado) return ALTURA_NO;
  return Math.max(ALTURA_NO, 14 + anatomia.campos.length * ALTURA_LINHA_BLOCO);
}

const xDoNo = (i: number) => X_INICIAL + i * (LARGURA_NO + GAP);
const centroDoNo = (i: number) => xDoNo(i) + LARGURA_NO / 2;

/** Ponto de onde a seta de ligação sai: do compartimento, ou da borda do bloco. */
const saidaDaLigacao = (x: number, anatomia: Anatomia) =>
  anatomia.compartimentado ? x + DIVISAO + (LARGURA_NO - DIVISAO) / 2 : x + LARGURA_NO;

/** Ponta de seta triangular, orientada pela direção do segmento que termina nela. */
function pontaDeSeta(x1: number, y1: number, x2: number, y2: number): string {
  const angulo = Math.atan2(y2 - y1, x2 - x1);
  const tras = (dx: number) => [
    x2 - 10 * Math.cos(angulo) + dx * Math.sin(angulo),
    y2 - 10 * Math.sin(angulo) - dx * Math.cos(angulo),
  ];
  const [ax, ay] = tras(6);
  const [bx, by] = tras(-6);
  return `M ${ax} ${ay} L ${x2} ${y2} L ${bx} ${by} Z`;
}

/** Aterramento: dois traços paralelos, o de cima mais longo. Marca ausência de destino. */
function Aterramento({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line className="svg-ligacao" x1={x - 12} y1={y} x2={x + 12} y2={y} strokeWidth={1.75} />
      <line className="svg-ligacao" x1={x - 6} y1={y + 6} x2={x + 6} y2={y + 6} strokeWidth={1.75} />
    </g>
  );
}

/** Ligação nula saindo de um nó: a seta desce até o aterramento. */
function LigacaoAterrada({ saida, y, borda }: { saida: number; y: number; borda: number }) {
  const gx = borda + 18;
  return (
    <g>
      <path
        className="svg-ligacao"
        d={`M ${saida} ${y} L ${gx - 12} ${y} Q ${gx} ${y} ${gx} ${y + 12} L ${gx} ${y + 22}`}
        fill="none"
        strokeWidth={1.75}
      />
      <Aterramento x={gx} y={y + 24} />
    </g>
  );
}

interface Props {
  instantaneo?: Instantaneo;
  nivelAndaime?: NivelDeAndaime;
}

export function VisualizadorListaEncadeada({
  instantaneo,
  nivelAndaime = ANDAIME_PADRAO,
}: Props) {
  const variaveis: Objeto = instantaneo?.variaveis ?? {};
  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const mapa = new Map<number, Objeto>();
  const vistos = new Set<unknown>();
  for (const valor of Object.values(variaveis)) indexar(valor, mapa, vistos);

  const ligacoes = camposDeLigacao([...mapa.values()], mapa);
  const anatomias = new Map<number, Anatomia>();
  for (const [id, no] of mapa) anatomias.set(id, anatomiaDe(no, ligacoes));
  const anatomiaDo = (no: Objeto) => anatomias.get(no.__id as number) as Anatomia;

  // Caminhada completa a partir da cabeça, seguindo a única ligação de cada
  // nó. Vai além do que cabe no desenho: é ela que diz o que está na cadeia, e
  // o desenho mostra só uma janela. Para no nulo, no primeiro nó repetido — onde
  // o ciclo se fecha — ou num nó com mais de uma ligação, onde não há como
  // saber qual caminho a fileira segue.
  const alcancaveis: Objeto[] = [];
  const naCadeia = new Set<number>();
  let cicloPara: number | null = null;
  let alcanceIncerto = false;
  let corrente = resolver(variaveis.cabeca, mapa);
  while (corrente) {
    const id = corrente.__id as number;
    if (naCadeia.has(id)) {
      cicloPara = id;
      break;
    }
    naCadeia.add(id);
    alcancaveis.push(corrente);
    const anatomia = anatomiaDo(corrente);
    if (anatomia.variasLigacoes) {
      alcanceIncerto = true;
      break;
    }
    corrente = anatomia.campoLigacao ? resolver(corrente[anatomia.campoLigacao], mapa) : null;
  }

  const excedeu = alcancaveis.length > LIMITE_DE_NOS;
  const cadeia = alcancaveis.slice(0, LIMITE_DE_NOS);

  // Nó que existe no instantâneo mas não é alcançável pela cabeça. Quando a
  // caminhada parou por incerteza, não dá para afirmar que ele saiu da cadeia,
  // e ele é desenhado sem o traço de consumido.
  const soltos = [...mapa.values()].filter((no) => !naCadeia.has(no.__id as number));
  const estadoDoSolto: EstadoDaCelula = alcanceIncerto ? 'ativa' : 'consumida';

  const posicaoNaCadeia = new Map<number, number>();
  cadeia.forEach((no, i) => posicaoNaCadeia.set(no.__id as number, i));
  const posicaoSolta = new Map<number, number>();
  soltos.forEach((no, i) => posicaoSolta.set(no.__id as number, i));

  /** Onde um ponteiro deve ser desenhado: sobre um nó, além da janela, ou no vazio. */
  const alvoDoPonteiro = (valor: unknown) => {
    const no = resolver(valor, mapa);
    if (!no) return { x: X_NULO, yBase: Y_NO, nulo: true, fora: false, altura: ALTURA_NO };
    const id = no.__id as number;
    const altura = alturaDoNo(anatomiaDo(no));
    const naFila = posicaoNaCadeia.get(id);
    if (naFila !== undefined) {
      return { x: centroDoNo(naFila), yBase: Y_NO, nulo: false, fora: false, altura };
    }
    // Alcançável, mas além da janela desenhada: o ponteiro não se perdeu, só
    // aponta para fora do que coube.
    if (naCadeia.has(id)) return { x: X_ALEM, yBase: Y_NO, nulo: false, fora: true, altura };
    const solto = posicaoSolta.get(id);
    if (solto !== undefined) {
      return { x: centroDoNo(solto), yBase: Y_SOLTO, nulo: false, fora: false, altura };
    }
    return { x: X_NULO, yBase: Y_NO, nulo: true, fora: false, altura: ALTURA_NO };
  };

  const ponteiros = Object.entries(variaveis).filter(
    ([, valor]) => valor === null || ehObjeto(valor)
  );

  const alvoDoAnel = alvoDoPonteiro(variaveis.atual);
  const temAnel = 'atual' in variaveis && !alvoDoAnel.nulo && !alvoDoAnel.fora;

  const descrever = (conteudo: unknown) => (resolver(conteudo, mapa) ? '→' : textoDoValor(conteudo));

  const desenharNo = (no: Objeto, x: number, y: number, estado: EstadoDaCelula) => {
    const anatomia = anatomiaDo(no);
    const estilo = CELULA[estado];
    const divisoria = estado === 'ativa' ? 'svg-divisoria-ativa' : 'svg-divisoria-consumida';
    const altura = alturaDoNo(anatomia);
    const titulo = rotulos
      ? anatomia.campos.map((campo) => campo + ': ' + descrever(no[campo])).join(', ')
      : anatomia.campos.map((campo) => descrever(no[campo])).join(', ');

    if (anatomia.compartimentado) {
      const campoValor = anatomia.campoValor as string;
      const campoLigacao = anatomia.campoLigacao as string;
      return (
        <g key={'no-' + String(no.__id)}>
          <title>{titulo}</title>
          {/* A borda fica fora do esmaecimento (D10): apagam só o fundo e o
              que está dentro do nó, e o tracejado mantém o contraste cheio. */}
          <rect
            className={estilo.classe}
            x={x}
            y={y}
            width={LARGURA_NO}
            height={ALTURA_NO}
            rx={8}
            strokeDasharray={estilo.strokeDasharray}
            strokeWidth={1.75}
            fillOpacity={estilo.opacidadeDoConteudo}
          />
          <g opacity={estilo.opacidadeDoConteudo}>
            <line
              className={divisoria}
              x1={x + DIVISAO}
              y1={y}
              x2={x + DIVISAO}
              y2={y + ALTURA_NO}
              strokeWidth={1}
              opacity={0.4}
            />
            <line
              className={divisoria}
              x1={x}
              y1={y + FAIXA_ROTULO}
              x2={x + LARGURA_NO}
              y2={y + FAIXA_ROTULO}
              strokeWidth={1}
              opacity={0.28}
            />
            {rotulos && (
              <>
                <text
                  className="svg-rotulo svg-mono"
                  x={x + DIVISAO / 2}
                  y={y + 16}
                  textAnchor="middle"
                  fontSize="9"
                >
                  {encurtar(campoValor, MAX_ROTULO)}
                </text>
                <text
                  className="svg-rotulo svg-mono"
                  x={x + DIVISAO + (LARGURA_NO - DIVISAO) / 2}
                  y={y + 16}
                  textAnchor="middle"
                  fontSize="9"
                >
                  {encurtar(campoLigacao, MAX_ROTULO)}
                </text>
              </>
            )}
            <text
              className="svg-valor svg-mono"
              x={x + DIVISAO / 2}
              y={y + 52}
              textAnchor="middle"
              fontSize="17"
              fontWeight="500"
            >
              {encurtar(textoDoValor(no[campoValor]), MAX_VALOR)}
            </text>
          </g>
        </g>
      );
    }

    // Bloco: a inferência não fechou, então nada de compartimentos — uma linha
    // por campo, na ordem do objeto.
    return (
      <g key={'no-' + String(no.__id)}>
        <title>{titulo}</title>
        <rect
          className={estilo.classe}
          x={x}
          y={y}
          width={LARGURA_NO}
          height={altura}
          rx={8}
          strokeDasharray={estilo.strokeDasharray}
          strokeWidth={1.75}
          fillOpacity={estilo.opacidadeDoConteudo}
        />
        <g opacity={estilo.opacidadeDoConteudo}>
          {anatomia.campos.map((campo, i) => (
            <text
              key={campo}
              className="svg-valor svg-mono"
              x={x + 8}
              y={y + 20 + i * ALTURA_LINHA_BLOCO}
              fontSize="10"
            >
              {encurtar(
                rotulos ? campo + ': ' + descrever(no[campo]) : descrever(no[campo]),
                MAX_LINHA_BLOCO
              )}
            </text>
          ))}
        </g>
      </g>
    );
  };

  const ultimo = cadeia.length - 1;
  const ultimoNo = ultimo >= 0 ? cadeia[ultimo] : null;
  const anatomiaUltimo = ultimoNo ? anatomiaDo(ultimoNo) : null;
  const saidaUltimo = ultimoNo && anatomiaUltimo ? saidaDaLigacao(xDoNo(ultimo), anatomiaUltimo) : 0;
  const posCiclo = cicloPara === null ? undefined : posicaoNaCadeia.get(cicloPara);
  // A cadeia termina num nulo quando o último nó tem um campo de ligação e ele
  // não aponta para nada.
  const terminaEmNulo =
    !excedeu &&
    cicloPara === null &&
    !alcanceIncerto &&
    ultimoNo !== null &&
    anatomiaUltimo?.campoLigacao !== null &&
    anatomiaUltimo?.campoLigacao !== undefined &&
    !resolver(ultimoNo[anatomiaUltimo.campoLigacao], mapa);

  const nomesDeLigacao = [...ligacoes];

  return (
    <>
      <svg
        viewBox="0 0 520 320"
        width="100%"
        style={{ maxHeight: 360 }}
        role="img"
        aria-label={
          rotulos
            ? 'Lista encadeada com ' + cadeia.length + ' nós na cadeia e ' + soltos.length + ' fora dela'
            : 'Lista encadeada com ' + cadeia.length + ' nós'
        }
      >
        {cadeia.map((no, i) => desenharNo(no, xDoNo(i), Y_NO, 'ativa'))}
        {soltos.map((no, i) => desenharNo(no, xDoNo(i), Y_SOLTO, estadoDoSolto))}

        {/* Setas de ligação entre nós consecutivos. Desenhadas depois dos nós
            porque saem de dentro do compartimento. */}
        {cadeia.slice(0, -1).map((no, i) => {
          const x1 = saidaDaLigacao(xDoNo(i), anatomiaDo(no));
          const x2 = xDoNo(i + 1);
          return (
            <g key={'liga-' + String(no.__id)}>
              <line
                className="svg-ligacao"
                x1={x1}
                y1={Y_LIGACAO}
                x2={x2 - 10}
                y2={Y_LIGACAO}
                strokeWidth={1.75}
              />
              <path className="svg-ligacao-seta" d={pontaDeSeta(x1, Y_LIGACAO, x2, Y_LIGACAO)} />
            </g>
          );
        })}

        {/* Fim da cadeia sem destino: a seta desce ao aterramento. */}
        {terminaEmNulo && (
          <LigacaoAterrada saida={saidaUltimo} y={Y_LIGACAO} borda={xDoNo(ultimo) + LARGURA_NO} />
        )}

        {/* Cadeia que continua além do desenho: a seta vai até as reticências. */}
        {excedeu && (
          <g>
            <line
              className="svg-ligacao"
              x1={saidaUltimo}
              y1={Y_LIGACAO}
              x2={X_ALEM - 12}
              y2={Y_LIGACAO}
              strokeWidth={1.75}
            />
            <text className="svg-rotulo" x={X_ALEM - 8} y={Y_LIGACAO + 5} fontSize="16">
              …
            </text>
          </g>
        )}

        {/* Ciclo: a ligação do último nó volta para um já desenhado. O gancho
            passa por baixo da fileira para não se confundir com as ligações
            normais, e serve também ao nó que aponta para si mesmo. */}
        {posCiclo !== undefined && !excedeu && (
          <g>
            <path
              className="svg-ciclo"
              d={
                'M ' + saidaUltimo + ' ' + Y_LIGACAO +
                ' L ' + (xDoNo(ultimo) + LARGURA_NO + 22) + ' ' + Y_LIGACAO +
                ' L ' + (xDoNo(ultimo) + LARGURA_NO + 22) + ' ' + (BASE_DO_NO + 44) +
                ' L ' + (xDoNo(posCiclo) + 30) + ' ' + (BASE_DO_NO + 44) +
                ' L ' + (xDoNo(posCiclo) + 30) + ' ' + (BASE_DO_NO + 12)
              }
              fill="none"
              strokeWidth={1.75}
              strokeLinejoin="round"
            />
            <path
              className="svg-ciclo-seta"
              d={pontaDeSeta(xDoNo(posCiclo) + 30, BASE_DO_NO + 44, xDoNo(posCiclo) + 30, BASE_DO_NO)}
            />
            {rotulos && (
              <text
                className="svg-ciclo-seta svg-mono"
                x={(xDoNo(posCiclo) + xDoNo(ultimo) + LARGURA_NO + 52) / 2}
                y={BASE_DO_NO + 62}
                textAnchor="middle"
                fontSize="10.5"
              >
                volta para um nó já visitado
              </text>
            )}
          </g>
        )}

        {/* Nós fora da cadeia, com a ligação que ainda mantêm. */}
        {soltos.map((no, i) => {
          const anatomia = anatomiaDo(no);
          if (!anatomia.campoLigacao) return null;
          const destino = resolver(no[anatomia.campoLigacao], mapa);
          const posDestino = destino ? posicaoNaCadeia.get(destino.__id as number) : undefined;
          if (!destino) {
            return (
              <LigacaoAterrada
                key={'solto-liga-' + String(no.__id)}
                saida={saidaDaLigacao(xDoNo(i), anatomia)}
                y={Y_SOLTO + 46}
                borda={xDoNo(i) + LARGURA_NO}
              />
            );
          }
          if (posDestino === undefined) return null;
          const x1 = centroDoNo(i);
          const x2 = centroDoNo(posDestino);
          return (
            // Tracejada e em opacidade cheia, como a borda do nó solto (D10). A
            // ligação é só traço e ponta, sem conteúdo a esmaecer, e é ela que
            // mostra para onde o nó fora da cadeia ainda aponta.
            <g key={'solto-liga-' + String(no.__id)}>
              <line
                className="svg-ligacao"
                x1={x1}
                y1={Y_SOLTO}
                x2={x2}
                y2={BASE_DO_NO + 10}
                strokeWidth={1.75}
                strokeDasharray="4 3"
              />
              <path className="svg-ligacao-seta" d={pontaDeSeta(x1, Y_SOLTO, x2, BASE_DO_NO)} />
            </g>
          );
        })}

        {/* Anel do nó que o ponteiro de trabalho aponta. */}
        {temAnel && (
          <motion.g
            initial={false}
            animate={{ x: alvoDoAnel.x - LARGURA_NO / 2, y: alvoDoAnel.yBase }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <rect
              className={DESTAQUE.classe}
              x={-DESTAQUE.folga}
              y={-DESTAQUE.folga}
              width={LARGURA_NO + DESTAQUE.folga * 2}
              height={alvoDoAnel.altura + DESTAQUE.folga * 2}
              rx={12}
              fill="none"
              strokeWidth={DESTAQUE.espessura}
            />
          </motion.g>
        )}

        {/* Ponteiros: sempre fora dos nós, empilhados para não se cobrirem. O
            nulo fica estacionado à esquerda da fileira e a seta desce até o
            aterramento. */}
        {ponteiros.map(([nome, valor], p) => {
          const alvo = alvoDoPonteiro(valor);
          const apice = alvo.yBase - 8 - p * 24;
          const classe = nome === 'cabeca' ? MARCADOR.primeiro : MARCADOR.segundo;
          return (
            <motion.g
              key={'ponteiro-' + nome}
              initial={false}
              animate={{ x: alvo.x }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <path d={'M -7 ' + (apice - 14) + ' L 7 ' + (apice - 14) + ' L 0 ' + apice + ' Z'} className={classe} />
              {alvo.nulo && (
                <>
                  <line
                    className="svg-ligacao"
                    x1={0}
                    y1={apice}
                    x2={0}
                    y2={Y_LIGACAO}
                    strokeWidth={1.75}
                  />
                  <Aterramento x={0} y={Y_LIGACAO + 2} />
                </>
              )}
              {rotulos && (
                <text
                  className={MARCADOR.rotulo + ' svg-mono'}
                  x={alvo.nulo ? -24 : 0}
                  y={apice - 20}
                  textAnchor={alvo.nulo ? 'start' : 'middle'}
                  fontSize="11.5"
                  fontWeight="700"
                >
                  {nome}
                  {alvo.nulo ? ' = null' : ''}
                </text>
              )}
              {rotulos && alvo.fora && (
                <text className="svg-rotulo svg-mono" y={apice - 34} textAnchor="middle" fontSize="9">
                  fora da fileira
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>

      {legendas && (
        <p className="legenda-visualizacao">
          {[
            nomesDeLigacao.length > 0
              ? 'a seta sai do compartimento ' + nomesDeLigacao.join(' ou ')
              : null,
            'o aterramento marca um ponteiro sem destino',
            'nó tracejado saiu da cadeia',
          ]
            .filter((parte) => parte !== null)
            .join(' · ')}
        </p>
      )}
    </>
  );
}
