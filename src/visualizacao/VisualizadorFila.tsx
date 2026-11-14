import { motion, AnimatePresence } from 'motion/react';
import { ANDAIME_PADRAO, mostrarLegendas, mostrarRotulos } from '../componentes/andaime';
import { CELULA, DESTAQUE, MARCADOR } from './estilos';
import type { NivelDeAndaime } from '../componentes/andaime';
import type { Instantaneo } from '../nucleo/tipos';

/**
 * Representa a fila como uma fileira de células da esquerda para a direita,
 * com dois marcadores independentes: `frente`, acima, e `tras`, abaixo.
 *
 * A convenção é a do Ziviani (D40): `frente` é a posição de quem sai, e `tras`
 * é a posição em que o próximo vai entrar — uma depois do último. A fila são
 * as posições de `frente` até `tras - 1`, e o lugar normal de `tras` é logo
 * depois da última célula.
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
  /**
   * A última posição em que o marcador ainda está no lugar dele. Para `frente`
   * é a última célula; para `tras`, a vaga logo depois dela, que é onde o
   * próximo entra.
   */
  ultimaNoLugar: number;
  acima: boolean;
  /** Classe da seta: cheia na frente, vazada atrás (MARCADOR, D19). */
  classe: string;
  /** Rótulo com o nome e o valor do marcador; some sem apoio (D9). */
  rotulos: boolean;
}

/**
 * Um marcador é um triângulo apontando para a célula, mais um rótulo textual
 * com o índice exato. O rótulo sempre mostra o valor verdadeiro — só a posição
 * horizontal do triângulo é limitada, e apenas quando o índice ficaria fora do
 * viewBox. Assim nenhum estado é escondido do estudante.
 */
function Marcador({
  nome,
  indice,
  desenhadas,
  ultimaNoLugar,
  acima,
  classe,
  rotulos,
}: PropsMarcador) {
  // Deixamos o marcador ir até uma posição além de cada ponta: é lá que ele
  // aparece quando aponta para fora da fileira, e isso precisa ser visível.
  // À direita, a ponta é a vaga de `tras`, e o marcador vai até uma posição
  // depois dela: quem passou de `tras` não pode parar em cima dele, senão, sem
  // rótulo, os dois estados seriam o mesmo desenho. Com a fileira cheia não há
  // quadro para essa posição, e ela fica no limite.
  const limitado = Math.min(Math.max(indice, -1), Math.min(desenhadas + 1, LIMITE_DE_CELULAS));
  const fora = indice < 0 || indice > ultimaNoLugar;

  return (
    <motion.g
      animate={{ x: centroDaCelula(limitado) }}
      initial={false}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      {acima ? (
        <>
          {rotulos && (
            <text y={40} textAnchor="middle" fontSize="11" fontWeight="700" className={MARCADOR.rotulo}>
              {nome} = {indice}
            </text>
          )}
          <path d="M -6 48 L 6 48 L 0 60 Z" className={classe} />
        </>
      ) : (
        <>
          <path d="M -6 130 L 6 130 L 0 118 Z" className={classe} />
          {rotulos && (
            <text y={146} textAnchor="middle" fontSize="11" fontWeight="700" className={MARCADOR.rotulo}>
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
  const frente =
    typeof instantaneo?.variaveis.frente === 'number'
      ? (instantaneo.variaveis.frente as number)
      : undefined;
  const tras =
    typeof instantaneo?.variaveis.tras === 'number'
      ? (instantaneo.variaveis.tras as number)
      : undefined;

  const legendas = mostrarLegendas(nivelAndaime);
  const rotulos = mostrarRotulos(nivelAndaime);

  const desenhadas = Math.min(itens.length, LIMITE_DE_CELULAS);
  const ocultas = itens.length - desenhadas;

  // Uma célula está ativa quando nenhum dos dois marcadores a deixou de fora.
  // Marcador ausente não restringe nada — instantâneos iniciais não têm todas
  // as variáveis declaradas ainda. O que sobra à esquerda da frente já saiu da
  // fila; de `tras` em diante, ainda não entrou — `tras` é a vaga do próximo, e
  // não faz parte da fila.
  const estadoDa = (i: number) =>
    (frente === undefined || i >= frente) && (tras === undefined || i < tras)
      ? 'ativa'
      : 'consumida';

  // O anel marca a célula que a frente aponta como a próxima a sair — mesmo
  // que ela já esteja fora do intervalo dos marcadores. Se a frente aponta
  // para fora da fileira, não há anel, e essa ausência é o sintoma. Nada aqui
  // sabe qual célula deveria ser a certa.
  const apontada = frente !== undefined && frente >= 0 && frente < desenhadas ? frente : null;

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
          ? `Fila com ${itens.length} células; frente = ${frente ?? 'indefinido'}, trás = ${tras ?? 'indefinido'}`
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
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <title>{rotulos ? `índice ${i}: ${completo}` : completo}</title>
              {/* A borda fica fora do esmaecimento (D10): apagam só o fundo e o
                  conteúdo, e o tracejado mantém o contraste cheio. */}
              <rect
                x={xDaCelula(i)}
                y={Y_CELULA}
                width={LARGURA_CELULA}
                height={ALTURA_CELULA}
                rx={6}
                className={estilo.classe}
                strokeDasharray={estilo.strokeDasharray}
                strokeWidth={2}
                fillOpacity={estilo.opacidadeDoConteudo}
              />
              <motion.g
                initial={false}
                animate={{ opacity: estilo.opacidadeDoConteudo }}
                transition={{ duration: 0.22 }}
              >
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
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Anel da próxima célula a ser tratada, segundo a frente atual. */}
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

      {frente !== undefined && (
        <Marcador
          nome="frente"
          indice={frente}
          desenhadas={desenhadas}
          ultimaNoLugar={desenhadas - 1}
          acima
          classe={MARCADOR.primeiro}
          rotulos={rotulos}
        />
      )}
      {tras !== undefined && (
        <Marcador
          nome="trás"
          indice={tras}
          desenhadas={desenhadas}
          ultimaNoLugar={desenhadas}
          acima={false}
          classe={MARCADOR.segundo}
          rotulos={rotulos}
        />
      )}

      {legendas && (
        <>
          <text x={X_INICIAL - 6} y={182} fontSize="10" className="svg-rotulo">
            ◀ sai pela frente
          </text>
          <text x={474} y={182} textAnchor="end" fontSize="10" className="svg-rotulo">
            entra por trás ▶
          </text>
        </>
      )}
    </svg>
  );
}
