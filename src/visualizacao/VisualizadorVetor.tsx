import { motion, AnimatePresence } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { CELULA, DESTAQUE } from './estilos';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Representa o vetor como uma fileira de posições numeradas, com o índice
 * corrente desenhado fora delas.
 *
 * O índice fica separado do conteúdo de propósito: nos defeitos desta
 * estrutura o que sai do lugar é a relação entre "onde o índice está" e "o que
 * existe naquela posição", e um desenho que mostre só o conteúdo esconde
 * justamente isso.
 *
 * Nenhuma posição é marcada como consumida, ao contrário da pilha e da fila.
 * Um vetor não consome nada, e deduzir "já percorrida" de `i < indice` seria
 * afirmar um histórico que um instantâneo não conhece: bastaria o laço começar
 * em 1, ou correr de trás para frente, para o desenho mentir.
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

interface Props {
  instantaneo?: Instantaneo;
  nivelAndaime?: NivelDeAndaime;
}

export function VisualizadorVetor({ instantaneo, nivelAndaime = ANDAIME_PADRAO }: Props) {
  const bruto = instantaneo?.variaveis.itens;
  const itens = Array.isArray(bruto) ? (bruto as unknown[]) : [];
  const indice =
    typeof instantaneo?.variaveis.indice === 'number'
      ? (instantaneo.variaveis.indice as number)
      : undefined;

  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const desenhadas = Math.min(itens.length, LIMITE_DE_CELULAS);
  const ocultas = itens.length - desenhadas;

  // O anel envolve a posição que o índice aponta. Quando ele aponta para fora
  // do vetor não há anel, e é essa ausência que denuncia o estado — nada aqui
  // sabe qual posição seria a certa.
  const apontada = indice !== undefined && indice >= 0 && indice < desenhadas ? indice : null;

  // O marcador pode ir até uma posição além de cada ponta: é lá que ele
  // aparece quando aponta para fora da fileira, e isso precisa ser visível.
  const posicaoDoMarcador = centroDaCelula(
    Math.min(Math.max(indice ?? 0, -1), desenhadas)
  );
  const indiceForaDaFileira = indice !== undefined && (indice < 0 || indice >= desenhadas);

  return (
    <svg
      viewBox="0 0 480 200"
      width="100%"
      style={{ maxHeight: 300 }}
      role="img"
      aria-label={
        rotulos
          ? `Vetor com ${itens.length} posições; índice = ${indice ?? 'indefinido'}`
          : `Vetor com ${itens.length} posições`
      }
    >
      {/* Contorno da fileira: mantém o lugar da estrutura visível mesmo quando
          ainda não há posição alguma para desenhar. */}
      <rect
        x={X_INICIAL - 6}
        y={Y_CELULA - 6}
        width={Math.max(desenhadas, 1) * (LARGURA_CELULA + ESPACO) + 6}
        height={ALTURA_CELULA + 12}
        rx={8}
        fill="none"
        stroke="var(--borda)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      <AnimatePresence>
        {itens.slice(0, LIMITE_DE_CELULAS).map((valor, i) => {
          const completo = textoDoValor(valor);
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: CELULA.ativa.opacidade }}
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
                fill={CELULA.ativa.fill}
                stroke={CELULA.ativa.stroke}
                strokeWidth={2}
              />
              {rotulos && (
                <text
                  x={xDaCelula(i) + 5}
                  y={Y_CELULA + 12}
                  fontSize="9"
                  fill="var(--tinta-suave)"
                >
                  {i}
                </text>
              )}
              <text
                x={centroDaCelula(i)}
                y={Y_CELULA + ALTURA_CELULA / 2 + 8}
                textAnchor="middle"
                fontSize="12"
                fill="var(--tinta)"
              >
                {encurtar(completo)}
              </text>
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Anel da posição que o índice aponta. */}
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
            stroke={DESTAQUE.cor}
            strokeWidth={DESTAQUE.espessura}
          />
        </motion.g>
      )}

      {ocultas > 0 && (
        <text
          x={xDaCelula(LIMITE_DE_CELULAS) + 4}
          y={Y_CELULA + ALTURA_CELULA / 2 + 5}
          fontSize="11"
          fill="var(--tinta-suave)"
        >
          +{ocultas}
        </text>
      )}

      {/* Marcador do índice: a seta é forma e fica em qualquer nível; só o
          rótulo com o valor obedece ao fading de D9. */}
      {indice !== undefined && (
        <motion.g
          animate={{ x: posicaoDoMarcador }}
          initial={false}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <path d="M -6 130 L 6 130 L 0 118 Z" fill="var(--acento)" />
          {rotulos && (
            <text y={146} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--acento)">
              índice = {indice}
            </text>
          )}
          {indiceForaDaFileira && rotulos && (
            <text y={160} textAnchor="middle" fontSize="9" fill="var(--tinta-suave)">
              fora da fileira
            </text>
          )}
        </motion.g>
      )}

      {legendas && (
        <text x={X_INICIAL - 6} y={182} fontSize="10" fill="var(--tinta-suave)">
          as posições são numeradas a partir de 0
        </text>
      )}
    </svg>
  );
}
