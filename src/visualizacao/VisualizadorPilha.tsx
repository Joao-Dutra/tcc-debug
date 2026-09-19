import { motion, AnimatePresence } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { CELULA, DESTAQUE, MARCADOR, POSICAO_VAZIA } from './estilos';
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
 * Pilha de capacidade fixa ou dinâmica é propriedade do exercício, e chega
 * aqui pelo instantâneo (D10): o exercício de capacidade fixa declara
 * `capacidade`, e as posições que existem no vetor e nunca receberam valor são
 * desenhadas como contorno pontilhado, sem conteúdo. Sem `capacidade` a pilha
 * é dinâmica, e só os blocos que existem aparecem.
 *
 * Este componente é PURO: recebe um instantâneo e desenha. Não executa código,
 * não conhece exercícios e não decide quando avançar.
 */

const LARGURA_CAIXA = 120;
const ALTURA_CAIXA = 46;
const ESPACO = 8;
const BASE_Y = 320;
const X_CAIXA = 100;

/** Acima disto a coluna não cabe no viewBox; o excedente vira um "+N". */
const LIMITE_DE_POSICOES = 5;

interface Props {
  instantaneo?: Instantaneo;
  nivelAndaime?: NivelDeAndaime;
}

export function VisualizadorPilha({ instantaneo, nivelAndaime = ANDAIME_PADRAO }: Props) {
  const itens = (instantaneo?.variaveis.itens as unknown[] | undefined) ?? [];
  const topo = instantaneo?.variaveis.topo as number | undefined;
  const capacidade =
    typeof instantaneo?.variaveis.capacidade === 'number'
      ? (instantaneo.variaveis.capacidade as number)
      : undefined;

  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const yDaPosicao = (i: number) => BASE_Y - (i + 1) * (ALTURA_CAIXA + ESPACO);

  // Uma posição guarda valor quando o vetor chegou até ela e algo foi escrito
  // ali. O que não chegou — e o buraco que uma escrita fora de lugar deixa —
  // é posição vazia da capacidade.
  const ocupada = (i: number) => i < itens.length && itens[i] !== undefined;

  // Com capacidade declarada, o desenho mostra todas as posições dela, ainda
  // que o vetor tenha passado do limite: passar é o sintoma, e escondê-lo
  // seria sanear o estado.
  const posicoes = Math.min(Math.max(capacidade ?? 0, itens.length), LIMITE_DE_POSICOES);
  const ocultas = Math.max(capacidade ?? 0, itens.length) - posicoes;
  const vazias =
    capacidade === undefined
      ? []
      : Array.from({ length: posicoes }, (_, i) => i).filter((i) => !ocupada(i));

  // Tudo acima do topo já saiu da pilha. Sem marcador ainda, nada foi
  // consumido: instantâneos iniciais não têm todas as variáveis declaradas.
  const estadoDa = (i: number) => (topo === undefined || i <= topo ? 'ativa' : 'consumida');

  // O anel marca o elemento que o topo aponta — mesmo que seja uma caixa já
  // consumida. Se o topo aponta para fora do vetor, ou para uma posição vazia,
  // não há anel nenhum, e essa ausência é o sintoma. Nada aqui sabe qual caixa
  // deveria ser a certa.
  const apontada =
    topo !== undefined && topo >= 0 && topo < posicoes && ocupada(topo) ? topo : null;

  return (
    <svg viewBox="0 0 360 360" width="100%" style={{ maxHeight: 380 }}>
      {/* Base da pilha */}
      <line x1="80" y1={BASE_Y + 4} x2="240" y2={BASE_Y + 4} className="svg-base" strokeWidth="3" />
      {legendas && (
        <text x="160" y={BASE_Y + 26} textAnchor="middle" fontSize="12" className="svg-rotulo">
          base
        </text>
      )}

      {/* Contorno da capacidade: posição que existe e nunca recebeu valor.
          Desenhado antes das caixas, por baixo delas. */}
      {vazias.map((i) => (
        <rect
          key={'vazia-' + i}
          x={X_CAIXA}
          y={yDaPosicao(i)}
          width={LARGURA_CAIXA}
          height={ALTURA_CAIXA}
          rx={6}
          fill="none"
          className={POSICAO_VAZIA.classe}
          strokeDasharray={POSICAO_VAZIA.strokeDasharray}
          strokeWidth={POSICAO_VAZIA.espessura}
        />
      ))}

      {/* Só as posições que guardam valor viram caixa. Onde não há valor fica
          o contorno da capacidade, e nada por cima dele. */}
      <AnimatePresence>
        {Array.from({ length: posicoes }, (_, i) => i).filter(ocupada).map((i) => {
          const valor = itens[i];
          const estilo = CELULA[estadoDa(i)];
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, y: yDaPosicao(i) + 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* A borda fica fora do esmaecimento (D10): apagam só o fundo e o
                  conteúdo, e o tracejado mantém o contraste cheio. */}
              <rect
                x={X_CAIXA}
                y={yDaPosicao(i)}
                width={LARGURA_CAIXA}
                height={ALTURA_CAIXA}
                rx={6}
                className={estilo.classe}
                strokeDasharray={estilo.strokeDasharray}
                strokeWidth={2}
                fillOpacity={estilo.opacidadeDoConteudo}
              />
              <motion.g
                initial={false}
                animate={{ opacity: estilo.opacidadeDoConteudo }}
                transition={{ duration: 0.25 }}
              >
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
            </motion.g>
          );
        })}
      </AnimatePresence>

      {ocultas > 0 && (
        <text x={X_CAIXA} y={yDaPosicao(posicoes) + ALTURA_CAIXA - 8} fontSize="11" className="svg-rotulo">
          +{ocultas}
        </text>
      )}

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

          A seta é forma, não texto: sem apoio o rótulo some, e sem ela o
          marcador sumiria junto, deixando a cor como único portador. */}
      {topo !== undefined && (
        <motion.g
          animate={{ y: topo < 0 ? BASE_Y - 20 : yDaPosicao(topo) + ALTURA_CAIXA / 2 - 8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
          <path d="M 268 5 L 268 19 L 256 12 Z" className={MARCADOR.primeiro} />
          {rotulos && (
            <text x={276} y={17} fontSize="13" className={MARCADOR.rotulo} fontWeight="700">
              topo = {topo}
            </text>
          )}
        </motion.g>
      )}
    </svg>
  );
}
