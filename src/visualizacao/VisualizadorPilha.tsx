import { motion, AnimatePresence } from 'motion/react';
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

interface Props {
  instantaneo?: Instantaneo;
}

export function VisualizadorPilha({ instantaneo }: Props) {
  const itens = (instantaneo?.variaveis.itens as unknown[] | undefined) ?? [];
  const topo = instantaneo?.variaveis.topo as number | undefined;

  const yDaPosicao = (i: number) => BASE_Y - (i + 1) * (ALTURA_CAIXA + ESPACO);

  return (
    <svg viewBox="0 0 360 360" width="100%" style={{ maxHeight: 380 }}>
      {/* Base da pilha */}
      <line x1="80" y1={BASE_Y + 4} x2="240" y2={BASE_Y + 4} stroke="#94a3b8" strokeWidth="3" />
      <text x="160" y={BASE_Y + 26} textAnchor="middle" fontSize="12" fill="#64748b">
        base
      </text>

      <AnimatePresence>
        {itens.map((valor, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, y: yDaPosicao(i) + 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <rect
              x={100}
              y={yDaPosicao(i)}
              width={LARGURA_CAIXA}
              height={ALTURA_CAIXA}
              rx={6}
              fill={i === topo ? '#dbeafe' : '#f1f5f9'}
              stroke={i === topo ? '#2563eb' : '#cbd5e1'}
              strokeWidth={2}
            />
            <text
              x={100 + LARGURA_CAIXA / 2}
              y={yDaPosicao(i) + ALTURA_CAIXA / 2 + 5}
              textAnchor="middle"
              fontSize="16"
              fill="#0f172a"
            >
              {String(valor)}
            </text>
            <text x={88} y={yDaPosicao(i) + ALTURA_CAIXA / 2 + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {i}
            </text>
          </motion.g>
        ))}
      </AnimatePresence>

      {/* Marcador do topo — desenhado mesmo quando aponta para fora do conteúdo,
          porque essa divergência é o sintoma visível de vários defeitos. */}
      {topo !== undefined && (
        <motion.g
          animate={{ y: topo < 0 ? BASE_Y - 20 : yDaPosicao(topo) + ALTURA_CAIXA / 2 - 8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
          <text x={236} y={12} fontSize="13" fill="#dc2626" fontWeight="600">
            ◀ topo = {topo}
          </text>
        </motion.g>
      )}
    </svg>
  );
}
