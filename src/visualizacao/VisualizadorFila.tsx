import { motion, AnimatePresence } from 'motion/react';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Representa a fila como uma fileira de células da esquerda para a direita,
 * com dois marcadores independentes: `inicio`, acima, e `fim`, abaixo.
 *
 * Os marcadores são desenhados FORA das células e onde quer que apontem,
 * inclusive além da fileira — é o descompasso entre "onde o marcador aponta" e
 * "o que existe ali" que revela os defeitos desta estrutura. Nada aqui é
 * normalizado para caber.
 *
 * O componente deliberadamente NÃO afirma se a fila está vazia nem quantos
 * elementos restam. Essa é justamente a relação entre os dois marcadores que o
 * estudante precisa deduzir; desenhá-la pronta entregaria a investigação.
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

interface PropsMarcador {
  nome: string;
  indice: number;
  /** Quantidade de células realmente desenhadas, para saber até onde ir. */
  desenhadas: number;
  acima: boolean;
  cor: string;
}

/**
 * Um marcador é um triângulo apontando para a célula, mais um rótulo textual
 * com o índice exato. O rótulo sempre mostra o valor verdadeiro — só a posição
 * horizontal do triângulo é limitada, e apenas quando o índice ficaria fora do
 * viewBox. Assim nenhum estado é escondido do estudante.
 */
function Marcador({ nome, indice, desenhadas, acima, cor }: PropsMarcador) {
  // Deixamos o marcador ir até uma posição além de cada ponta: é lá que ele
  // aparece quando aponta para fora da fileira, e isso precisa ser visível.
  const limitado = Math.min(Math.max(indice, -1), desenhadas);
  const fora = indice < 0 || indice >= desenhadas;

  return (
    <motion.g
      animate={{ x: centroDaCelula(limitado) }}
      initial={false}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      {acima ? (
        <>
          <text y={40} textAnchor="middle" fontSize="11" fontWeight="600" fill={cor}>
            {nome} = {indice}
          </text>
          <path d="M -6 48 L 6 48 L 0 60 Z" fill={cor} />
        </>
      ) : (
        <>
          <path d="M -6 130 L 6 130 L 0 118 Z" fill={cor} />
          <text y={146} textAnchor="middle" fontSize="11" fontWeight="600" fill={cor}>
            {nome} = {indice}
          </text>
        </>
      )}
      {fora && (
        <text
          y={acima ? 22 : 160}
          textAnchor="middle"
          fontSize="9"
          fill="var(--tinta-suave)"
        >
          fora da fileira
        </text>
      )}
    </motion.g>
  );
}

interface Props {
  instantaneo?: Instantaneo;
}

export function VisualizadorFila({ instantaneo }: Props) {
  const bruto = instantaneo?.variaveis.itens;
  const itens = Array.isArray(bruto) ? (bruto as unknown[]) : [];
  const inicio =
    typeof instantaneo?.variaveis.inicio === 'number'
      ? (instantaneo.variaveis.inicio as number)
      : undefined;
  const fim =
    typeof instantaneo?.variaveis.fim === 'number'
      ? (instantaneo.variaveis.fim as number)
      : undefined;

  const desenhadas = Math.min(itens.length, LIMITE_DE_CELULAS);
  const ocultas = itens.length - desenhadas;

  // Uma célula está sob os marcadores quando nenhum dos dois a deixou de fora.
  // Marcador ausente não restringe nada — instantâneos iniciais não têm todas
  // as variáveis declaradas ainda.
  const sobOsMarcadores = (i: number) =>
    (inicio === undefined || i >= inicio) && (fim === undefined || i <= fim);

  return (
    <svg
      viewBox="0 0 480 200"
      width="100%"
      style={{ maxHeight: 300 }}
      role="img"
      aria-label={`Fila com ${itens.length} células; início = ${inicio ?? 'indefinido'}, fim = ${fim ?? 'indefinido'}`}
    >
      {/* Contorno da fileira: mantém o lugar da estrutura visível mesmo quando
          ainda não há célula alguma para desenhar. */}
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
          const ativa = sobOsMarcadores(i);
          const completo = textoDoValor(valor);
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: ativa ? 1 : 0.45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <title>{`índice ${i}: ${completo}`}</title>
              <rect
                x={xDaCelula(i)}
                y={Y_CELULA}
                width={LARGURA_CELULA}
                height={ALTURA_CELULA}
                rx={6}
                fill={ativa ? '#fff' : 'var(--fundo)'}
                stroke={ativa ? 'var(--acento)' : 'var(--borda)'}
                strokeWidth={2}
              />
              <text
                x={xDaCelula(i) + 5}
                y={Y_CELULA + 12}
                fontSize="9"
                fill="var(--tinta-suave)"
              >
                {i}
              </text>
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

      {inicio !== undefined && (
        <Marcador
          nome="início"
          indice={inicio}
          desenhadas={desenhadas}
          acima
          cor="var(--acento)"
        />
      )}
      {fim !== undefined && (
        <Marcador nome="fim" indice={fim} desenhadas={desenhadas} acima={false} cor="var(--tinta)" />
      )}

      <text x={X_INICIAL - 6} y={182} fontSize="10" fill="var(--tinta-suave)">
        ◀ sai pelo início
      </text>
      <text x={474} y={182} textAnchor="end" fontSize="10" fill="var(--tinta-suave)">
        entra pelo fim ▶
      </text>
    </svg>
  );
}
