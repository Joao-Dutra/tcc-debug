import { motion, AnimatePresence } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { caminhoDoArco, FONTE_DO_VALOR, pontaDoArco } from './arco-da-escrita';
import {
  ALTURA_CAIXA,
  ALTURA_CELULA,
  ALTURA_DA_CABECA,
  ALTURA_DO_QUADRO,
  LARGURA_CAIXA,
  LARGURA_CELULA,
  LIMITE_DE_CELULAS,
  TEXTO_DA_LEGENDA,
  TEXTO_FORA_DA_FILEIRA,
  X_INICIAL,
  Y_CELULA,
  centroDaCelula,
  disporVetor,
  encurtar,
  xDaCelula,
} from './disposicao-do-vetor';
import { CELULA, DESTAQUE, MARCADOR } from './estilos';
import type { LugarDoValor } from '../nucleo/tipos';
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
 * Onde cada peça fica é calculado em `disposicao-do-vetor.ts`, sem React: é lá
 * que se verifica que o valor do arco não cai em cima de nada (D32).
 *
 * Este componente é PURO: recebe um instantâneo e desenha. Não executa código,
 * não conhece exercícios e não decide quando avançar.
 */

/** Para o rótulo acessível da escrita: "da posição 2", "para a variável temp". */
function descreverLugar(lugar: LugarDoValor, destino = false): string {
  const artigo = destino ? 'para a' : 'da';
  if ('variavel' in lugar) return `${artigo} variável ${lugar.variavel}`;
  return `${artigo} posição ${lugar.indice}`;
}

interface Props {
  instantaneo?: Instantaneo;
  nivelAndaime?: NivelDeAndaime;
}

export function VisualizadorVetor({ instantaneo, nivelAndaime = ANDAIME_PADRAO }: Props) {
  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const {
    largura,
    tamanho,
    celulas,
    ocultas,
    fimDaFileira,
    caixas,
    caixasOcultas,
    excedenteDasCaixas,
    marcadores,
    apontada,
    movimento,
  } = disporVetor(instantaneo, { rotulos, legendas });

  const escrita = instantaneo?.escrita;
  const descricaoDaEscrita =
    movimento && escrita
      ? `; o valor ${movimento.valor} foi copiado ${descreverLugar(escrita.origem)} ` +
        `${descreverLugar(escrita.destino, true)}`
      : '';

  const descricao = rotulos
    ? `Vetor com ${tamanho} posições` +
      (marcadores.length > 0
        ? `; ${marcadores.map((m) => `${m.nome} = ${m.indice}`).join(', ')}`
        : '') +
      descricaoDaEscrita
    : `Vetor com ${tamanho} posições`;

  return (
    <svg
      viewBox={`0 0 ${largura} ${ALTURA_DO_QUADRO}`}
      width="100%"
      style={{ maxHeight: 320 }}
      role="img"
      aria-label={descricao}
    >
      {/* Contorno da fileira: mantém o lugar da estrutura visível mesmo quando
          ainda não há posição alguma para desenhar. */}
      <rect
        x={X_INICIAL - 6}
        y={Y_CELULA - 6}
        width={fimDaFileira - X_INICIAL + 6}
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
            d={caminhoDoArco(movimento.de, movimento.para, movimento.controle)}
            fill="none"
            className="svg-ligacao"
            strokeWidth={1.5}
          />
          <path
            d={pontaDoArco(movimento.de, movimento.para, movimento.controle)}
            className="svg-ligacao-seta"
          />
        </g>
      )}

      {/* Caixas de valor, fora da fileira: são variáveis do programa, e não
          posições da estrutura. Por isso usam a cor da moldura, e não a da
          célula ativa, que é um estado da estrutura (D10). */}
      {caixas.map((caixa) => (
        <g key={'caixa-' + caixa.nome}>
          <rect
            x={caixa.x}
            y={caixa.y}
            width={LARGURA_CAIXA}
            height={ALTURA_CAIXA}
            rx={6}
            className="svg-caixa-valor"
            strokeWidth={1.5}
          />
          {rotulos && (
            <text
              x={caixa.x + LARGURA_CAIXA / 2}
              y={caixa.y - 5}
              textAnchor="middle"
              fontSize="9"
              className="svg-rotulo"
            >
              {caixa.nome}
            </text>
          )}
          <text
            x={caixa.x + LARGURA_CAIXA / 2}
            y={caixa.y + ALTURA_CAIXA / 2 + 5}
            textAnchor="middle"
            fontSize="12"
            className="svg-valor"
          >
            {encurtar(caixa.texto)}
          </text>
        </g>
      ))}
      {caixasOcultas > 0 && (
        <text
          x={excedenteDasCaixas.x}
          y={excedenteDasCaixas.y}
          textAnchor="start"
          fontSize="11"
          className="svg-rotulo"
        >
          +{caixasOcultas}
        </text>
      )}

      <AnimatePresence>
        {celulas.map((celula) => (
          <motion.g
            key={celula.indice}
            initial={{ opacity: 0 }}
            animate={{ opacity: CELULA.ativa.opacidadeDoConteudo }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <title>{rotulos ? `posição ${celula.indice}: ${celula.completo}` : celula.completo}</title>
            <rect
              x={celula.x}
              y={Y_CELULA}
              width={LARGURA_CELULA}
              height={ALTURA_CELULA}
              rx={6}
              className={CELULA.ativa.classe}
              strokeWidth={2}
            />
            {rotulos && (
              <text x={celula.x + 5} y={Y_CELULA + 12} fontSize="9" className="svg-rotulo">
                {celula.indice}
              </text>
            )}
            <text
              x={centroDaCelula(celula.indice)}
              y={Y_CELULA + ALTURA_CELULA / 2 + 8}
              textAnchor="middle"
              fontSize="12"
              className="svg-valor"
            >
              {celula.texto}
            </text>
          </motion.g>
        ))}
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
      {marcadores.map((marcador) => (
        <motion.g
          key={'marcador-' + marcador.nome}
          initial={false}
          animate={{ x: marcador.x }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <line
            x1={0}
            y1={Y_CELULA + ALTURA_CELULA + 2}
            x2={0}
            y2={marcador.apice}
            className="svg-haste"
            strokeWidth={1.25}
          />
          <path
            d={marcador.desenho}
            transform={`translate(0 ${marcador.apice})`}
            className={marcador.classe}
          />
          {rotulos && (
            <>
              <text
                x={marcador.rotuloAEsquerda ? -12 : 12}
                y={marcador.apice + ALTURA_DA_CABECA - 1}
                textAnchor={marcador.rotuloAEsquerda ? 'end' : 'start'}
                fontSize="11"
                fontWeight="700"
                className={MARCADOR.rotulo + ' svg-mono'}
              >
                {marcador.nome} = {marcador.indice}
              </text>
              {marcador.fora && (
                <text
                  x={marcador.rotuloAEsquerda ? -12 : 12}
                  y={marcador.apice + ALTURA_DA_CABECA + 10}
                  textAnchor={marcador.rotuloAEsquerda ? 'end' : 'start'}
                  fontSize="9"
                  className="svg-rotulo"
                >
                  {TEXTO_FORA_DA_FILEIRA}
                </text>
              )}
            </>
          )}
        </motion.g>
      ))}

      {/* O valor copiado, parado no meio do arco e por cima de tudo (D32).
          Antes ele percorria o arco, e o passo a passo — que é como o
          estudante investiga — mostrava o quadro parado, sem ele: informação
          que só existe durante o movimento some no quadro parado. Aparece nos
          dois níveis de apoio, como o arco: é o valor que mudou de lugar, e não
          o nome de nada. O chão da mesa de luz por trás separa o número do
          traço do arco que passa por ele. */}
      {movimento && (
        <g className="valor-do-arco" aria-hidden="true">
          <rect
            x={movimento.etiqueta.x}
            y={movimento.etiqueta.y}
            width={movimento.etiqueta.largura}
            height={movimento.etiqueta.altura}
            rx={4}
            className="svg-etiqueta-do-arco"
            strokeWidth={1}
          />
          <text
            x={movimento.meio.x}
            y={movimento.meio.y + FONTE_DO_VALOR * 0.36}
            textAnchor="middle"
            fontSize={FONTE_DO_VALOR}
            fontWeight="700"
            className="svg-valor"
          >
            {movimento.valor}
          </text>
        </g>
      )}

      {legendas && (
        <text x={X_INICIAL - 6} y={212} fontSize="10" className="svg-rotulo">
          {TEXTO_DA_LEGENDA}
        </text>
      )}
    </svg>
  );
}
