import type { ReactNode } from 'react';
import { CAMINHO_INICIAL } from './usar-rota';

/**
 * Cabeçalho das telas do participante (D32).
 *
 * Até aqui título, ícones e textos pousavam direto na sala, cada tela de um
 * jeito, e a marca só existia na tela inicial. O cabeçalho é uma faixa só, de
 * ponta a ponta, em que tudo isso se ancora: a marca e a navegação à esquerda,
 * as ações da tela à direita, e embaixo o título e o texto que o explica.
 *
 * Quieto de propósito: o chão é o do painel, o mesmo das faixas que já
 * existem, e o limite é um fio. Nenhuma cor nova e nenhum ícone que não
 * estivesse na tela antes.
 */

/**
 * O inseto da marca. Montado com elipses e traços, como o resto da decoração:
 * nenhum arquivo de imagem e nenhum recurso externo (D13).
 */
export function Inseto({ x, y, escala = 1 }: { x: number; y: number; escala?: number }) {
  return (
    <g className="inseto" transform={`translate(${x} ${y}) scale(${escala})`}>
      {/* patas: três de cada lado */}
      <path d="M -7 -4 L -13 -8 M -8 1 L -14 1 M -7 6 L -13 10 M 7 -4 L 13 -8 M 8 1 L 14 1 M 7 6 L 13 10" />
      {/* antenas */}
      <path d="M -3 -11 Q -5 -17 -9 -18 M 3 -11 Q 5 -17 9 -18" />
      <ellipse cx={0} cy={-9} rx={4.5} ry={3.5} className="inseto-cabeca" />
      <ellipse cx={0} cy={2} rx={8} ry={10} className="inseto-corpo" />
      <path d="M 0 -7 L 0 12" className="inseto-risca" />
    </g>
  );
}

function Marca({ naInicial }: { naInicial: boolean }) {
  const conteudo = (
    <>
      <svg viewBox="-16 -20 32 34" aria-hidden="true">
        <Inseto x={0} y={0} />
      </svg>
      Depurar
    </>
  );
  // Na própria tela inicial a marca não é link: levaria para onde já se está.
  return naInicial ? (
    <span className="marca">{conteudo}</span>
  ) : (
    <a className="marca" href={CAMINHO_INICIAL}>
      {conteudo}
    </a>
  );
}

interface Props {
  /** Ao lado da marca: o caminho de volta, quando a tela tem um. */
  navegacao?: ReactNode;
  /** À direita da faixa: o que se faz sobre a tela inteira. */
  acoes?: ReactNode;
  titulo?: ReactNode;
  /** Abaixo do título: o texto que explica a tela, e o que for dela. */
  children?: ReactNode;
  naInicial?: boolean;
}

export function Cabecalho({ navegacao, acoes, titulo, children, naInicial = false }: Props) {
  return (
    <header className="cabecalho">
      <div className="cabecalho-barra">
        <div className="cabecalho-caminho">
          <Marca naInicial={naInicial} />
          {navegacao && <span className="cabecalho-divisa" aria-hidden="true" />}
          {navegacao}
        </div>
        {acoes && <div className="cabecalho-acoes">{acoes}</div>}
      </div>
      {titulo && <h1>{titulo}</h1>}
      {children}
    </header>
  );
}
