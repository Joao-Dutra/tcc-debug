import { motion, AnimatePresence } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { caminhoDoArco, meioDoArco, pontaDoArco } from './arco-da-escrita';
import { CELULA, DESTAQUE, MARCADOR } from './estilos';
import type { Ponto } from './arco-da-escrita';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Representa o vetor como uma fileira de posições numeradas, com os marcadores
 * desenhados fora delas.
 *
 * Os marcadores ficam separados do conteúdo de propósito: nos defeitos desta
 * estrutura o que sai do lugar é a relação entre "onde o marcador está" e "o
 * que existe naquela posição", e um desenho que mostre só o conteúdo esconde
 * justamente isso.
 *
 * **Vários marcadores ao mesmo tempo** (D27). A ordenação precisa de dois
 * índices e a busca binária de três. Quem diz quais variáveis são marcadores é
 * o exercício, pelo instantâneo: `j` e `temp` são os dois números, e só a
 * declaração os separa. Cada marcador ganha uma faixa própria abaixo da
 * fileira e uma forma própria, porque dentro da bancada o matiz é significado
 * (D19) e não pode distinguir marcador de marcador. As demais variáveis
 * observadas viram caixas de valor acima da fileira.
 *
 * Nenhuma posição é marcada como consumida, ao contrário da pilha e da fila.
 * Um vetor não consome nada, e deduzir "já percorrida" de `i < indice` seria
 * afirmar um histórico que um instantâneo não conhece: bastaria o laço começar
 * em 1, ou correr de trás para frente, para o desenho mentir. Pela mesma
 * razão, um par de marcadores não pinta o intervalo entre eles: quem decide o
 * que está dentro e o que está fora é o programa, e o desenho não sabe.
 *
 * Este componente é PURO: recebe um instantâneo e desenha. Não executa código,
 * não conhece exercícios e não decide quando avançar.
 */

const LARGURA_CELULA = 42;
const ALTURA_CELULA = 46;
const ESPACO = 6;
const X_INICIAL = 56;
const Y_CELULA = 66;

/** Acima disto a fileira não cabe no viewBox; o excedente vira um "+N". */
const LIMITE_DE_CELULAS = 8;
const MAX_CARACTERES = 7;

/** Faixa do primeiro marcador e distância entre duas faixas. */
const Y_PRIMEIRA_FAIXA = 120;
const ALTURA_DA_FAIXA = 26;
/** Altura da cabeça da seta, do ápice à base. */
const ALTURA_DA_CABECA = 12;
/**
 * Deslocamento lateral entre marcadores vizinhos. Sem ele, dois marcadores na
 * mesma posição — `inicio == meio`, que é o fim de toda busca binária —
 * sobreporiam as hastes num traço só.
 */
const DESVIO_ENTRE_MARCADORES = 10;

/**
 * Caixas das variáveis que guardam valor. Ficam ao lado da fileira, na altura
 * das células, sempre que cabem ali: perto do vetor, o caminho de um valor
 * entre a caixa e uma posição é curto, e a miniatura (D20), que se enquadra
 * pelo que foi desenhado, não encolhe o vetor para alcançar uma caixa lá no
 * canto. Quando a fileira ocupa a largura toda — as oito posições da busca
 * binária —, a caixa sobe para cima dela, alinhada ao fim da fileira.
 */
const ALTURA_CAIXA = 30;
const LARGURA_CAIXA = 46;
const ESPACO_ENTRE_CAIXAS = 10;
const DISTANCIA_DA_FILEIRA = 18;
const Y_CAIXA_AO_LADO = Y_CELULA + (ALTURA_CELULA - ALTURA_CAIXA) / 2;
const Y_CAIXA_ACIMA = 20;
/** Até onde a caixa pode ir sem encostar na borda direita do quadro. */
const X_LIMITE_DAS_CAIXAS = 472;
const MAX_CAIXAS = 3;

/** Valores chegam já serializados pelo Worker e podem ser objetos aninhados. */
function textoDoValor(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (valor === null) return 'null';
  if (valor === undefined) return 'vazio';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function encurtar(texto: string): string {
  return texto.length > MAX_CARACTERES ? `${texto.slice(0, MAX_CARACTERES - 1)}…` : texto;
}

const xDaCelula = (i: number) => X_INICIAL + i * (LARGURA_CELULA + ESPACO);
const centroDaCelula = (i: number) => xDaCelula(i) + LARGURA_CELULA / 2;
const apiceDaFaixa = (faixa: number) => Y_PRIMEIRA_FAIXA + faixa * ALTURA_DA_FAIXA;

/** Para o rótulo acessível da escrita: "da posição 2", "para a variável temp". */
function descreverLugar(
  lugar: { vetor?: string; indice?: number; variavel?: string },
  destino = false
): string {
  const artigo = destino ? 'para a' : 'da';
  if (lugar.variavel !== undefined) return `${artigo} variável ${lugar.variavel}`;
  return `${artigo} posição ${lugar.indice}`;
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

interface MarcadorDesenhado {
  nome: string;
  indice: number;
  faixa: number;
}

/**
 * Distância mínima entre as duas pontas para o arco da escrita ser desenhado.
 * Abaixo disso as pontas caem no mesmo lugar do desenho — é o que acontece em
 * `inicio = meio`, em que o movimento já é o próprio marcador mudando de
 * posição — e o arco seria um rabisco sem sentido.
 */
const DISTANCIA_MINIMA_DO_ARCO = 14;

interface CaixaDesenhada {
  nome: string;
  texto: string;
}

interface Props {
  instantaneo?: Instantaneo;
  nivelAndaime?: NivelDeAndaime;
}

export function VisualizadorVetor({ instantaneo, nivelAndaime = ANDAIME_PADRAO }: Props) {
  const variaveis = instantaneo?.variaveis ?? {};
  const bruto = variaveis.itens;
  const itens = Array.isArray(bruto) ? (bruto as unknown[]) : [];

  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const desenhadas = Math.min(itens.length, LIMITE_DE_CELULAS);
  const ocultas = itens.length - desenhadas;

  // Os marcadores são os que o exercício declarou, na ordem declarada, e só os
  // que já existem neste quadro: nos primeiros instantâneos nem toda variável
  // foi declarada ainda.
  const declarados = instantaneo?.marcadores ?? [];
  const marcadores: MarcadorDesenhado[] = declarados
    .filter((nome) => typeof variaveis[nome] === 'number')
    .map((nome, faixa) => ({ nome, indice: variaveis[nome] as number, faixa }));

  // Toda variável observada que não é a estrutura nem marcador guarda um
  // valor: a temporária de uma troca, por exemplo. Sem a caixa, o valor que
  // sai de uma posição e volta para outra some do desenho no meio do caminho.
  const todasAsCaixas: CaixaDesenhada[] = Object.entries(variaveis)
    .filter(([nome, valor]) => nome !== 'itens' && !declarados.includes(nome) && valor !== undefined)
    .map(([nome, valor]) => ({ nome, texto: textoDoValor(valor) }));
  const caixas = todasAsCaixas.slice(0, MAX_CAIXAS);
  const caixasOcultas = todasAsCaixas.length - caixas.length;
  const larguraDasCaixas =
    caixas.length * LARGURA_CAIXA + Math.max(caixas.length - 1, 0) * ESPACO_ENTRE_CAIXAS;
  // O fim do contorno da fileira, que é o que a caixa não pode invadir.
  const fimDaFileira = X_INICIAL + Math.max(desenhadas, 1) * (LARGURA_CELULA + ESPACO);
  const caixasAoLado =
    fimDaFileira + DISTANCIA_DA_FILEIRA + larguraDasCaixas <= X_LIMITE_DAS_CAIXAS;
  const xDaPrimeiraCaixa = caixasAoLado
    ? fimDaFileira + DISTANCIA_DA_FILEIRA
    : fimDaFileira - larguraDasCaixas;
  const yDaCaixa = caixasAoLado ? Y_CAIXA_AO_LADO : Y_CAIXA_ACIMA;
  const xDaCaixa = (i: number) => xDaPrimeiraCaixa + i * (LARGURA_CAIXA + ESPACO_ENTRE_CAIXAS);

  // O anel envolve a posição que o marcador principal aponta. Quando ele
  // aponta para fora do vetor não há anel, e é essa ausência que denuncia o
  // estado — nada aqui sabe qual posição seria a certa.
  const principal = marcadores[0];
  const apontada =
    principal !== undefined && principal.indice >= 0 && principal.indice < desenhadas
      ? principal.indice
      : null;

  // Onde cada lugar do valor está no desenho, para o arco da escrita (D27).
  // Uma posição fora da fileira desenhada não tem ponto, e aí não há arco:
  // apontar para onde não se desenhou nada seria inventar.
  const pontoDoLugar = (lugar: { vetor?: string; indice?: number; variavel?: string }): Ponto | null => {
    if (lugar.vetor !== undefined && typeof lugar.indice === 'number') {
      if (lugar.vetor !== 'itens' || lugar.indice < 0 || lugar.indice >= desenhadas) return null;
      return { x: centroDaCelula(lugar.indice), y: Y_CELULA };
    }
    if (lugar.variavel === undefined) return null;
    const naCaixa = caixas.findIndex((c) => c.nome === lugar.variavel);
    if (naCaixa >= 0) {
      // O caminho entra pelo lado da caixa voltado para a fileira: a lateral
      // esquerda quando ela está ao lado, a base quando está acima. Pelo alto
      // não, que é onde fica o nome da variável — a ponta da seta caía em
      // cima dele.
      return caixasAoLado
        ? { x: xDaCaixa(naCaixa), y: yDaCaixa + ALTURA_CAIXA / 2 }
        : { x: xDaCaixa(naCaixa) + LARGURA_CAIXA / 2, y: yDaCaixa + ALTURA_CAIXA };
    }
    const marcador = marcadores.find((m) => m.nome === lugar.variavel);
    if (!marcador) return null;
    const limitado = Math.min(Math.max(marcador.indice, -1), desenhadas);
    const desvio = (marcador.faixa - (marcadores.length - 1) / 2) * DESVIO_ENTRE_MARCADORES;
    return { x: centroDaCelula(limitado) + desvio, y: apiceDaFaixa(marcador.faixa) };
  };

  const valorDoLugar = (lugar: { vetor?: string; indice?: number; variavel?: string }): unknown => {
    if (lugar.vetor !== undefined && typeof lugar.indice === 'number') {
      const vetor = variaveis[lugar.vetor];
      return Array.isArray(vetor) ? (vetor as unknown[])[lugar.indice] : undefined;
    }
    return lugar.variavel === undefined ? undefined : variaveis[lugar.variavel];
  };

  // A escrita que produziu este quadro, quando as duas pontas estão no
  // desenho. O arco é o rastro dela, e fica no quadro; o valor percorrendo o
  // arco é a animação. Parado, com movimento reduzido ou na miniatura, o
  // rastro sozinho já conta o que aconteceu.
  const escrita = instantaneo?.escrita;
  const de = escrita ? pontoDoLugar(escrita.origem) : null;
  const para = escrita ? pontoDoLugar(escrita.destino) : null;
  const movimento =
    de && para && Math.hypot(para.x - de.x, para.y - de.y) >= DISTANCIA_MINIMA_DO_ARCO
      ? { de, para, valor: encurtar(textoDoValor(valorDoLugar(escrita!.destino))) }
      : null;

  const descricaoDaEscrita =
    movimento && escrita
      ? `; o valor ${movimento.valor} foi copiado ${descreverLugar(escrita.origem)} ` +
        `${descreverLugar(escrita.destino, true)}`
      : '';

  const descricao = rotulos
    ? `Vetor com ${itens.length} posições` +
      (marcadores.length > 0
        ? `; ${marcadores.map((m) => `${m.nome} = ${m.indice}`).join(', ')}`
        : '') +
      descricaoDaEscrita
    : `Vetor com ${itens.length} posições`;

  return (
    <svg viewBox="0 0 480 220" width="100%" style={{ maxHeight: 320 }} role="img" aria-label={descricao}>
      {/* Contorno da fileira: mantém o lugar da estrutura visível mesmo quando
          ainda não há posição alguma para desenhar. */}
      <rect
        x={X_INICIAL - 6}
        y={Y_CELULA - 6}
        width={Math.max(desenhadas, 1) * (LARGURA_CELULA + ESPACO) + 6}
        height={ALTURA_CELULA + 12}
        rx={8}
        fill="none"
        className="svg-contorno"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Rastro da escrita que produziu este quadro (D27), desenhado antes das
          caixas e das células para passar por trás delas. Ele mostra de onde o
          valor veio, que é o que a troca entre duas posições tem de essencial e
          o que nenhum quadro isolado conta. Deriva da execução, como tudo o
          mais no desenho: aparece em toda cópia simples, certa ou errada. */}
      {movimento && (
        <g aria-hidden="true">
          <path
            d={caminhoDoArco(movimento.de, movimento.para)}
            fill="none"
            className="svg-ligacao"
            strokeWidth={1.5}
          />
          <path d={pontaDoArco(movimento.de, movimento.para)} className="svg-ligacao-seta" />
        </g>
      )}

      {/* Caixas de valor, fora da fileira: são variáveis do programa, e não
          posições da estrutura. Por isso usam a cor da moldura, e não a da
          célula ativa, que é um estado da estrutura (D10). */}
      {caixas.map((caixa, i) => (
        <g key={'caixa-' + caixa.nome}>
          <rect
            x={xDaCaixa(i)}
            y={yDaCaixa}
            width={LARGURA_CAIXA}
            height={ALTURA_CAIXA}
            rx={6}
            className="svg-caixa-valor"
            strokeWidth={1.5}
          />
          {rotulos && (
            <text
              x={xDaCaixa(i) + LARGURA_CAIXA / 2}
              y={yDaCaixa - 5}
              textAnchor="middle"
              fontSize="9"
              className="svg-rotulo"
            >
              {caixa.nome}
            </text>
          )}
          <text
            x={xDaCaixa(i) + LARGURA_CAIXA / 2}
            y={yDaCaixa + ALTURA_CAIXA / 2 + 5}
            textAnchor="middle"
            fontSize="12"
            className="svg-valor"
          >
            {encurtar(caixa.texto)}
          </text>
        </g>
      ))}
      {caixasOcultas > 0 && (
        <text x={xDaPrimeiraCaixa + larguraDasCaixas + 6} y={yDaCaixa + 20} textAnchor="start" fontSize="11" className="svg-rotulo">
          +{caixasOcultas}
        </text>
      )}

      <AnimatePresence>
        {itens.slice(0, LIMITE_DE_CELULAS).map((valor, i) => {
          const completo = textoDoValor(valor);
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: CELULA.ativa.opacidadeDoConteudo }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <title>{rotulos ? `posição ${i}: ${completo}` : completo}</title>
              <rect
                x={xDaCelula(i)}
                y={Y_CELULA}
                width={LARGURA_CELULA}
                height={ALTURA_CELULA}
                rx={6}
                className={CELULA.ativa.classe}
                strokeWidth={2}
              />
              {rotulos && (
                <text
                  x={xDaCelula(i) + 5}
                  y={Y_CELULA + 12}
                  fontSize="9"
                  className="svg-rotulo"
                >
                  {i}
                </text>
              )}
              <text
                x={centroDaCelula(i)}
                y={Y_CELULA + ALTURA_CELULA / 2 + 8}
                textAnchor="middle"
                fontSize="12"
                className="svg-valor"
              >
                {encurtar(completo)}
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Anel da posição que o marcador principal aponta. */}
      {apontada !== null && (
        <motion.g
          initial={false}
          animate={{ x: xDaCelula(apontada) }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <rect
            x={-DESTAQUE.folga}
            y={Y_CELULA - DESTAQUE.folga}
            width={LARGURA_CELULA + DESTAQUE.folga * 2}
            height={ALTURA_CELULA + DESTAQUE.folga * 2}
            rx={10}
            fill="none"
            className={DESTAQUE.classe}
            strokeWidth={DESTAQUE.espessura}
          />
        </motion.g>
      )}

      {ocultas > 0 && (
        <text
          x={xDaCelula(LIMITE_DE_CELULAS) + 4}
          y={Y_CELULA + ALTURA_CELULA / 2 + 5}
          fontSize="11"
          className="svg-rotulo"
        >
          +{ocultas}
        </text>
      )}

      {/* Marcadores: cada um na sua faixa, ligado à célula por uma haste. A
          forma e a faixa ficam em qualquer nível; só o rótulo com o nome e o
          valor obedece ao fading de D9. */}
      {marcadores.map((marcador) => {
        const { classe, desenho } = formaDoMarcador(marcador.faixa);
        const apice = apiceDaFaixa(marcador.faixa);
        // O marcador vai até uma posição além de cada ponta: é lá que ele
        // aparece quando aponta para fora da fileira, e isso precisa ser visto.
        const limitado = Math.min(Math.max(marcador.indice, -1), desenhadas);
        const fora = marcador.indice < 0 || marcador.indice >= desenhadas;
        const desvio =
          (marcador.faixa - (marcadores.length - 1) / 2) * DESVIO_ENTRE_MARCADORES;
        // Perto da ponta direita o rótulo não caberia adiante do marcador, e
        // vira para o outro lado em vez de vazar do quadro.
        const aDireita = centroDaCelula(limitado) > 300;
        return (
          <motion.g
            key={'marcador-' + marcador.nome}
            initial={false}
            animate={{ x: centroDaCelula(limitado) + desvio }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <line
              x1={0}
              y1={Y_CELULA + ALTURA_CELULA + 2}
              x2={0}
              y2={apice}
              className="svg-haste"
              strokeWidth={1.25}
            />
            <path d={desenho} transform={`translate(0 ${apice})`} className={classe} />
            {rotulos && (
              <>
                <text
                  x={aDireita ? -12 : 12}
                  y={apice + ALTURA_DA_CABECA - 1}
                  textAnchor={aDireita ? 'end' : 'start'}
                  fontSize="11"
                  fontWeight="700"
                  className={MARCADOR.rotulo + ' svg-mono'}
                >
                  {marcador.nome} = {marcador.indice}
                </text>
                {fora && (
                  <text
                    x={aDireita ? -12 : 12}
                    y={apice + ALTURA_DA_CABECA + 10}
                    textAnchor={aDireita ? 'end' : 'start'}
                    fontSize="9"
                    className="svg-rotulo"
                  >
                    fora da fileira
                  </text>
                )}
              </>
            )}
          </motion.g>
        );
      })}

      {/* O valor percorrendo o arco, por cima de tudo. A chave é a ordem do
          quadro, então ele refaz o percurso a cada quadro que traz uma escrita
          — inclusive ao voltar um passo, porque o que ele conta é como aquele
          quadro surgiu. Sem movimento, o rastro sozinho continua contando. */}
      {movimento && (
        <motion.g
          key={instantaneo?.ordem}
          initial={{ x: movimento.de.x, y: movimento.de.y, opacity: 0 }}
          animate={{
            x: [movimento.de.x, meioDoArco(movimento.de, movimento.para).x, movimento.para.x],
            y: [movimento.de.y, meioDoArco(movimento.de, movimento.para).y, movimento.para.y],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 0.42, times: [0, 0.6, 1], ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <text textAnchor="middle" y={4} fontSize="12" fontWeight="700" className="svg-valor">
            {movimento.valor}
          </text>
        </motion.g>
      )}

      {legendas && (
        <text x={X_INICIAL - 6} y={212} fontSize="10" className="svg-rotulo">
          as posições são numeradas a partir de 0
        </text>
      )}
    </svg>
  );
}
