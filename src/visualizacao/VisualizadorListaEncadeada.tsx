import { motion } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { CELULA, DESTAQUE } from './estilos';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Representa a lista encadeada como nós em fileira, ligados por setas
 * explícitas, com os ponteiros desenhados acima e fora dos nós.
 *
 * Diferente das outras estruturas, esta é um grafo: dois ponteiros podem
 * apontar para o mesmo nó, um nó pode sair da cadeia e continuar referenciado,
 * e um proximo mal atribuído fecha um ciclo. O instantâneo preserva a
 * identidade dos nós (ver D12), e é dela que este desenho reconstrói o grafo,
 * em vez de adivinhar comparando valores.
 *
 * Nada é saneado: referência perdida, nó fora da cadeia e ciclo são desenhados
 * como o que são, porque é neles que mora o defeito.
 *
 * Convenção lida do instantâneo: cabeca é a raiz da cadeia e atual é o
 * ponteiro de trabalho, que recebe o anel. Qualquer outra variável que seja nó
 * ou referência vira ponteiro, sem anel.
 *
 * Este componente é PURO: recebe um instantâneo e desenha.
 */

const LARGURA_NO = 56;
const ALTURA_NO = 46;
const GAP = 24;
const X_INICIAL = 40;
const Y_NO = 96;
const Y_SOLTO = 186;
const LIMITE_DE_NOS = 6;
const MAX_CARACTERES = 6;

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

function encurtar(texto: string): string {
  return texto.length > MAX_CARACTERES ? texto.slice(0, MAX_CARACTERES - 1) + '…' : texto;
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

const xDoNo = (i: number) => X_INICIAL + i * (LARGURA_NO + GAP);
const centroDoNo = (i: number) => xDoNo(i) + LARGURA_NO / 2;
const MEIO_DO_NO = Y_NO + ALTURA_NO / 2;
const BASE_DO_NO = Y_NO + ALTURA_NO;

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

  // Caminhada completa a partir da cabeça, parando no nulo ou no primeiro nó
  // repetido — que é onde o ciclo se fecha. Vai até o fim mesmo além do que
  // cabe no desenho: é ela que diz o que está na cadeia, e o desenho depois
  // mostra só uma janela. Sem isso, um nó que apenas não coube seria acusado
  // de ter saído da estrutura.
  const alcancaveis: Objeto[] = [];
  const naCadeia = new Set<number>();
  let cicloPara: number | null = null;
  let corrente = resolver(variaveis.cabeca, mapa);
  while (corrente) {
    const id = corrente.__id as number;
    if (naCadeia.has(id)) {
      cicloPara = id;
      break;
    }
    naCadeia.add(id);
    alcancaveis.push(corrente);
    corrente = resolver(corrente.proximo, mapa);
  }

  const excedeu = alcancaveis.length > LIMITE_DE_NOS;
  const cadeia = alcancaveis.slice(0, LIMITE_DE_NOS);

  // Nó que existe no instantâneo mas não é alcançável pela cabeça: saiu da
  // cadeia e continua referenciado por alguém.
  const soltos = [...mapa.values()].filter(
    (no) => !naCadeia.has(no.__id as number) && 'proximo' in no
  );

  const posicaoNaCadeia = new Map<number, number>();
  cadeia.forEach((no, i) => posicaoNaCadeia.set(no.__id as number, i));
  const posicaoSolta = new Map<number, number>();
  soltos.forEach((no, i) => posicaoSolta.set(no.__id as number, i));

  /** Onde um ponteiro deve ser desenhado: sobre um nó, ou parado no vazio. */
  const alvoDoPonteiro = (valor: unknown) => {
    const perdido = { x: X_INICIAL - 24, yBase: Y_NO, perdido: true };
    const no = resolver(valor, mapa);
    if (!no) return perdido;
    const id = no.__id as number;
    const naFila = posicaoNaCadeia.get(id);
    if (naFila !== undefined) return { x: centroDoNo(naFila), yBase: Y_NO, perdido: false };
    // Alcançável, mas além da janela desenhada: o ponteiro não se perdeu, só
    // aponta para fora do que coube. Estaciona junto da marca de truncamento.
    if (naCadeia.has(id)) {
      return { x: xDoNo(LIMITE_DE_NOS) - GAP + 10, yBase: Y_NO, perdido: false };
    }
    const solto = posicaoSolta.get(id);
    if (solto !== undefined) return { x: centroDoNo(solto), yBase: Y_SOLTO, perdido: false };
    return perdido;
  };

  const ponteiros = Object.entries(variaveis).filter(
    ([, valor]) => valor === null || ehObjeto(valor)
  );

  const alvoDoAnel = alvoDoPonteiro(variaveis.atual);
  const temAnel = 'atual' in variaveis && !alvoDoAnel.perdido;

  const ultimo = cadeia.length - 1;
  const posCiclo = cicloPara === null ? undefined : posicaoNaCadeia.get(cicloPara);
  const xVolta = posCiclo === undefined ? 0 : centroDoNo(posCiclo);
  const xSaida = ultimo < 0 ? 0 : centroDoNo(ultimo);
  // Um nó que aponta para si mesmo tem saída e volta no mesmo x, e a curva
  // degeneraria numa linha vertical. O controle sai de lado para o laço ficar
  // reconhecível como laço.
  const controleDoCiclo = xSaida === xVolta ? xSaida + 46 : (xSaida + xVolta) / 2;
  const fimDaCadeia = ultimo < 0 ? 0 : xDoNo(ultimo) + LARGURA_NO;

  const desenharNo = (no: Objeto, x: number, y: number, dentroDaCadeia: boolean) => {
    const estilo = dentroDaCadeia ? CELULA.ativa : CELULA.consumida;
    const texto = textoDoValor(no.valor);
    return (
      <g key={'no-' + String(no.__id)} opacity={estilo.opacidade}>
        <title>{rotulos ? 'nó ' + String(no.__id) + ': ' + texto : texto}</title>
        <rect
          x={x}
          y={y}
          width={LARGURA_NO}
          height={ALTURA_NO}
          rx={6}
          fill={estilo.fill}
          stroke={estilo.stroke}
          strokeDasharray={estilo.strokeDasharray}
          strokeWidth={2}
        />
        <text
          x={x + LARGURA_NO / 2}
          y={y + ALTURA_NO / 2 + 6}
          textAnchor="middle"
          fontSize="14"
          fill="var(--tinta)"
        >
          {encurtar(texto)}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 560 250"
      width="100%"
      style={{ maxHeight: 320 }}
      role="img"
      aria-label={
        rotulos
          ? 'Lista encadeada com ' + cadeia.length + ' nos na cadeia e ' + soltos.length + ' fora dela'
          : 'Lista encadeada com ' + cadeia.length + ' nos'
      }
    >
      {cadeia.map((no, i) => desenharNo(no, xDoNo(i), Y_NO, true))}

      {/* Setas de ligação entre nós consecutivos. */}
      {cadeia.slice(0, -1).map((no, i) => (
        <g key={'liga-' + String(no.__id)}>
          <line
            x1={xDoNo(i) + LARGURA_NO}
            y1={MEIO_DO_NO}
            x2={xDoNo(i + 1) - 8}
            y2={MEIO_DO_NO}
            stroke="var(--tinta-suave)"
            strokeWidth={2}
          />
          <path
            d={'M ' + (xDoNo(i + 1) - 8) + ' ' + (MEIO_DO_NO - 5) + ' L ' + xDoNo(i + 1) + ' ' + MEIO_DO_NO + ' L ' + (xDoNo(i + 1) - 8) + ' ' + (MEIO_DO_NO + 5) + ' Z'}
            fill="var(--tinta-suave)"
          />
        </g>
      ))}

      {/* Fim da cadeia: barra de aterramento quando o último proximo é nulo. */}
      {cadeia.length > 0 && cicloPara === null && !excedeu && (
        <g>
          <line x1={fimDaCadeia} y1={MEIO_DO_NO} x2={fimDaCadeia + 16} y2={MEIO_DO_NO} stroke="var(--tinta-suave)" strokeWidth={2} />
          <line x1={fimDaCadeia + 16} y1={Y_NO + 10} x2={fimDaCadeia + 16} y2={BASE_DO_NO - 10} stroke="var(--tinta-suave)" strokeWidth={2} />
        </g>
      )}

      {/* Ciclo: o último nó volta para um já desenhado. Passa por baixo, para
          não se confundir com as ligações normais da fileira. */}
      {posCiclo !== undefined && !excedeu && (
        <g>
          <path
            d={'M ' + xSaida + ' ' + BASE_DO_NO + ' Q ' + controleDoCiclo + ' ' + (BASE_DO_NO + 42) + ' ' + xVolta + ' ' + (BASE_DO_NO + 6)}
            fill="none"
            stroke="var(--ligacao-ciclica)"
            strokeWidth={2}
          />
          <path
            d={'M ' + (xVolta - 5) + ' ' + (BASE_DO_NO + 12) + ' L ' + xVolta + ' ' + (BASE_DO_NO + 2) + ' L ' + (xVolta + 5) + ' ' + (BASE_DO_NO + 12) + ' Z'}
            fill="var(--ligacao-ciclica)"
          />
          {rotulos && (
            <text x={xSaida} y={BASE_DO_NO + 56} textAnchor="middle" fontSize="10" fill="var(--ligacao-ciclica)">
              volta para um no ja visitado
            </text>
          )}
        </g>
      )}

      {excedeu && (
        <text x={xDoNo(LIMITE_DE_NOS) - GAP + 6} y={MEIO_DO_NO + 4} fontSize="12" fill="var(--tinta-suave)">
          …
        </text>
      )}

      {/* Nós fora da cadeia, com a ligação que ainda mantêm. */}
      {soltos.map((no, i) => {
        const destino = resolver(no.proximo, mapa);
        const posDestino = destino ? posicaoNaCadeia.get(destino.__id as number) : undefined;
        return (
          <g key={'solto-' + String(no.__id)}>
            {desenharNo(no, xDoNo(i), Y_SOLTO, false)}
            {posDestino !== undefined && (
              <line
                x1={centroDoNo(i)}
                y1={Y_SOLTO}
                x2={centroDoNo(posDestino)}
                y2={BASE_DO_NO}
                stroke="var(--tinta-suave)"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            )}
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
            x={-DESTAQUE.folga}
            y={-DESTAQUE.folga}
            width={LARGURA_NO + DESTAQUE.folga * 2}
            height={ALTURA_NO + DESTAQUE.folga * 2}
            rx={10}
            fill="none"
            stroke={DESTAQUE.cor}
            strokeWidth={DESTAQUE.espessura}
          />
        </motion.g>
      )}

      {/* Ponteiros: sempre fora dos nós, empilhados para não se cobrirem. */}
      {ponteiros.map(([nome, valor], p) => {
        const alvo = alvoDoPonteiro(valor);
        const apice = alvo.yBase - 8 - p * 24;
        const cor = nome === 'cabeca' ? 'var(--acento)' : 'var(--tinta)';
        return (
          <motion.g
            key={'ponteiro-' + nome}
            initial={false}
            animate={{ x: alvo.x }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <path d={'M -6 ' + (apice - 12) + ' L 6 ' + (apice - 12) + ' L 0 ' + apice + ' Z'} fill={cor} />
            {rotulos && (
              <text y={apice - 18} textAnchor="middle" fontSize="11" fontWeight="600" fill={cor}>
                {nome}
                {alvo.perdido ? ' = null' : ''}
              </text>
            )}
          </motion.g>
        );
      })}

      {legendas && (
        <text x={8} y={242} fontSize="10" fill="var(--tinta-suave)">
          no tracejado saiu da cadeia; a barra a direita marca o fim
        </text>
      )}
    </svg>
  );
}
