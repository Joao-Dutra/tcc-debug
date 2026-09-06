import { motion, AnimatePresence } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { CELULA, DESTAQUE } from './estilos';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Representa a pilha como uma coluna de caixas empilhadas de baixo para cima,
 * com um marcador apontando para o topo.
 *
 * A analogia é deliberada: o estudante precisa enxergar o ponteiro do topo
 * separado do conteúdo, porque é justamente o descompasso entre os dois que
 * revela a maior parte dos defeitos desta estrutura.
 *
 * Este componente é PURO: recebe um instantâneo e desenha. Não executa código,
 * não conhece exercícios e não decide quando avançar.
 */

const LARGURA_CAIXA = 120;
const ALTURA_CAIXA = 46;
const ESPACO = 8;
const BASE_Y = 320;
const X_CAIXA = 100;

interface Props {
  instantaneo?: Instantaneo;
  nivelAndaime?: NivelDeAndaime;
}

export function VisualizadorPilha({ instantaneo, nivelAndaime = ANDAIME_PADRAO }: Props) {
  const itens = (instantaneo?.variaveis.itens as unknown[] | undefined) ?? [];
  const topo = instantaneo?.variaveis.topo as number | undefined;

  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const yDaPosicao = (i: number) => BASE_Y - (i + 1) * (ALTURA_CAIXA + ESPACO);

  // Tudo acima do topo já saiu da pilha. Sem marcador ainda, nada foi
  // consumido: instantâneos iniciais não têm todas as variáveis declaradas.
  const estadoDa = (i: number) => (topo === undefined || i <= topo ? 'ativa' : 'consumida');

  // O anel marca o elemento que o topo aponta — mesmo que seja uma caixa já
  // consumida. Se o topo aponta para fora do vetor, não há anel nenhum, e essa
  // ausência é o sintoma. Nada aqui sabe qual caixa deveria ser a certa.
  const apontada = topo !== undefined && topo >= 0 && topo < itens.length ? topo : null;

  return (
    <svg viewBox="0 0 360 360" width="100%" style={{ maxHeight: 380 }}>
      {/* Base da pilha */}
      <line x1="80" y1={BASE_Y + 4} x2="240" y2={BASE_Y + 4} className="svg-base" strokeWidth="3" />
      {legendas && (
        <text x="160" y={BASE_Y + 26} textAnchor="middle" fontSize="12" className="svg-rotulo">
          base
        </text>
      )}

      <AnimatePresence>
        {itens.map((valor, i) => {
          const estilo = CELULA[estadoDa(i)];
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, y: yDaPosicao(i) + 30 }}
              animate={{ opacity: estilo.opacidade, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <rect
                x={X_CAIXA}
                y={yDaPosicao(i)}
                width={LARGURA_CAIXA}
                height={ALTURA_CAIXA}
                rx={6}
                className={estilo.classe}
                strokeDasharray={estilo.strokeDasharray}
                strokeWidth={2}
              />
              <text
                x={X_CAIXA + LARGURA_CAIXA / 2}
                y={yDaPosicao(i) + ALTURA_CAIXA / 2 + 5}
                textAnchor="middle"
                fontSize="16"
                className="svg-valor"
              >
                {String(valor)}
              </text>
              {rotulos && (
                <text
                  x={88}
                  y={yDaPosicao(i) + ALTURA_CAIXA / 2 + 4}
                  textAnchor="end"
                  fontSize="11"
                  className="svg-rotulo"
                >
                  {i}
                </text>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Anel do próximo elemento a ser tratado, segundo o topo atual. */}
      {apontada !== null && (
        <motion.g
          initial={false}
          animate={{ y: yDaPosicao(apontada) }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <rect
            x={X_CAIXA - DESTAQUE.folga}
            y={-DESTAQUE.folga}
            width={LARGURA_CAIXA + DESTAQUE.folga * 2}
            height={ALTURA_CAIXA + DESTAQUE.folga * 2}
            rx={10}
            fill="none"
            className={DESTAQUE.classe}
            strokeWidth={DESTAQUE.espessura}
          />
        </motion.g>
      )}

      {/* Marcador do topo — desenhado mesmo quando aponta para fora do conteúdo,
          porque essa divergência é o sintoma visível de vários defeitos.

          A seta é forma, não texto: no apoio mínimo o rótulo some, e sem ela o
          marcador sumiria junto, deixando a cor como único portador. */}
      {topo !== undefined && (
        <motion.g
          animate={{ y: topo < 0 ? BASE_Y - 20 : yDaPosicao(topo) + ALTURA_CAIXA / 2 - 8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
          <path d="M 268 5 L 268 19 L 256 12 Z" className="svg-marcador-topo" />
          {rotulos && (
            <text x={276} y={17} fontSize="13" className="svg-marcador-topo" fontWeight="600">
              topo = {topo}
            </text>
          )}
        </motion.g>
      )}
    </svg>
  );
}
