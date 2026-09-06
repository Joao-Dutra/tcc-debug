import { motion, AnimatePresence } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { CELULA, DESTAQUE } from './estilos';
import type { NivelDeAndaime } from '../componentes/andaime';
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
  classe: string;
  /** Rótulo com o nome e o valor do marcador; some no apoio mínimo (D9). */
  rotulos: boolean;
}

/**
 * Um marcador é um triângulo apontando para a célula, mais um rótulo textual
 * com o índice exato. O rótulo sempre mostra o valor verdadeiro — só a posição
 * horizontal do triângulo é limitada, e apenas quando o índice ficaria fora do
 * viewBox. Assim nenhum estado é escondido do estudante.
 */
function Marcador({ nome, indice, desenhadas, acima, classe, rotulos }: PropsMarcador) {
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
          {rotulos && (
            <text y={40} textAnchor="middle" fontSize="11" fontWeight="600" className={classe}>
              {nome} = {indice}
            </text>
          )}
          <path d="M -6 48 L 6 48 L 0 60 Z" className={classe} />
        </>
      ) : (
        <>
          <path d="M -6 130 L 6 130 L 0 118 Z" className={classe} />
          {rotulos && (
            <text y={146} textAnchor="middle" fontSize="11" fontWeight="600" className={classe}>
              {nome} = {indice}
            </text>
          )}
        </>
      )}
      {fora && rotulos && (
        <text
          y={acima ? 22 : 160}
          textAnchor="middle"
          fontSize="9"
          className="svg-rotulo"
        >
          fora da fileira
        </text>
      )}
    </motion.g>
  );
}

interface Props {
  instantaneo?: Instantaneo;
  nivelAndaime?: NivelDeAndaime;
}

export function VisualizadorFila({ instantaneo, nivelAndaime = ANDAIME_PADRAO }: Props) {
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

  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const desenhadas = Math.min(itens.length, LIMITE_DE_CELULAS);
  const ocultas = itens.length - desenhadas;

  // Uma célula está ativa quando nenhum dos dois marcadores a deixou de fora.
  // Marcador ausente não restringe nada — instantâneos iniciais não têm todas
  // as variáveis declaradas ainda. O que sobra à esquerda do início já saiu da
  // fila; o que sobra à direita do fim ainda não entrou.
  const estadoDa = (i: number) =>
    (inicio === undefined || i >= inicio) && (fim === undefined || i <= fim)
      ? 'ativa'
      : 'consumida';

  // O anel marca a célula que o início aponta como a próxima a sair — mesmo
  // que ela já esteja fora do intervalo dos marcadores. Se o início aponta
  // para fora da fileira, não há anel, e essa ausência é o sintoma. Nada aqui
  // sabe qual célula deveria ser a certa.
  const apontada = inicio !== undefined && inicio >= 0 && inicio < desenhadas ? inicio : null;

  return (
    <svg
      viewBox="0 0 480 200"
      width="100%"
      style={{ maxHeight: 300 }}
      role="img"
      // O rótulo acessível segue o mesmo corte: anunciar os marcadores para
      // leitor de tela devolveria o apoio que o nível acabou de retirar.
      aria-label={
        rotulos
          ? `Fila com ${itens.length} células; início = ${inicio ?? 'indefinido'}, fim = ${fim ?? 'indefinido'}`
          : `Fila com ${itens.length} células`
      }
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
        className="svg-contorno"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      <AnimatePresence>
        {itens.slice(0, LIMITE_DE_CELULAS).map((valor, i) => {
          const estilo = CELULA[estadoDa(i)];
          const completo = textoDoValor(valor);
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: estilo.opacidade }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <title>{rotulos ? `índice ${i}: ${completo}` : completo}</title>
              <rect
                x={xDaCelula(i)}
                y={Y_CELULA}
                width={LARGURA_CELULA}
                height={ALTURA_CELULA}
                rx={6}
                className={estilo.classe}
                strokeDasharray={estilo.strokeDasharray}
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

      {/* Anel da próxima célula a ser tratada, segundo o início atual. */}
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

      {inicio !== undefined && (
        <Marcador
          nome="início"
          indice={inicio}
          desenhadas={desenhadas}
          acima
          classe="svg-marcador-primario"
          rotulos={rotulos}
        />
      )}
      {fim !== undefined && (
        <Marcador
          nome="fim"
          indice={fim}
          desenhadas={desenhadas}
          acima={false}
          classe="svg-marcador-secundario"
          rotulos={rotulos}
        />
      )}

      {legendas && (
        <>
          <text x={X_INICIAL - 6} y={182} fontSize="10" className="svg-rotulo">
            ◀ sai pelo início
          </text>
          <text x={474} y={182} textAnchor="end" fontSize="10" className="svg-rotulo">
            entra pelo fim ▶
          </text>
        </>
      )}
    </svg>
  );
}
