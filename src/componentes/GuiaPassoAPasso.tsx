import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import type { DesfechoDoTutorial } from '../nucleo/metricas';

/**
 * Um guia passo a passo em modal: o mecanismo do tutorial do participante
 * (D32) e do tutorial do professor (D33). O que cada um diz mora fora daqui.
 *
 * O modal é o `<dialog>` do navegador: ele prende o foco enquanto está aberto,
 * devolve o foco ao fechar e fecha com Esc, sem biblioteca nenhuma.
 */

export interface PassoDoGuia {
  titulo: string;
  texto: string;
  Ilustracao: () => JSX.Element;
}

interface Props {
  aberto: boolean;
  /** O que o guia ensina, no alto do modal: "Como usar a tela". */
  assunto: string;
  passos: readonly PassoDoGuia[];
  /**
   * Chamada uma vez por fechamento. `passoAlcancado` é o passo mais adiantado
   * mostrado, a partir de 1: quem voltou do quarto para o segundo e pulou
   * chegou a ver o quarto.
   */
  aoFechar: (desfecho: DesfechoDoTutorial, passoAlcancado: number, totalDePassos: number) => void;
  /** O nome do botão do último passo. */
  rotuloFinal?: string;
}

export function GuiaPassoAPasso({ aberto, assunto, passos, aoFechar, rotuloFinal = 'Começar' }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const [passo, setPasso] = useState(0);
  const [alcancado, setAlcancado] = useState(0);
  const total = passos.length;

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) {
      // Toda abertura recomeça do primeiro passo: quem volta pela ajuda quer
      // o guia, e não o lugar onde parou da outra vez.
      setPasso(0);
      setAlcancado(0);
      elemento.showModal();
      // O diálogo põe o foco no primeiro botão, que é o de fechar; quem abre
      // um guia quer seguir nele, e Enter deve avançar.
      principal.current?.focus();
    }
    if (!aberto && elemento.open) elemento.close();
  }, [aberto]);

  const irPara = (novo: number) => {
    setPasso(novo);
    setAlcancado((a) => Math.max(a, novo));
  };

  const fechar = (desfecho: DesfechoDoTutorial) => {
    aoFechar(desfecho, alcancado + 1, total);
  };

  const atual = passos[passo];
  const ultimo = passo === total - 1;

  return (
    <dialog
      ref={dialogo}
      className="tutorial"
      aria-labelledby="titulo-do-tutorial"
      // Esc fecha o diálogo pelo navegador; aqui ele vira "pulado", e o
      // estado da tela é quem fecha de fato.
      onCancel={(evento) => {
        evento.preventDefault();
        fechar('pulado');
      }}
    >
      <div className="tutorial-topo">
        <p className="tutorial-contagem">
          {assunto} · passo {passo + 1} de {total}
        </p>
        <button className="tutorial-fechar" aria-label="Fechar o tutorial" onClick={() => fechar('pulado')}>
          <XMarkIcon className="icone" aria-hidden="true" />
        </button>
      </div>
      <div className="tutorial-corpo">
        <atual.Ilustracao />
        <div>
          <h2 id="titulo-do-tutorial">{atual.titulo}</h2>
          <p>{atual.texto}</p>
        </div>
      </div>
      <ol className="tutorial-pontos" aria-hidden="true">
        {passos.map((p, i) => (
          <li key={p.titulo} className={i === passo ? 'atual' : undefined} />
        ))}
      </ol>
      <div className="tutorial-acoes">
        {!ultimo && (
          <button className="discreto" onClick={() => fechar('pulado')}>
            Pular tutorial
          </button>
        )}
        <span className="tutorial-navegacao">
          {passo > 0 && <button onClick={() => irPara(passo - 1)}>Voltar</button>}
          {/* Um botão só, que muda de nome no último passo: sendo o mesmo
              elemento, o foco fica nele de um passo para o outro. */}
          <button
            ref={principal}
            className="primario"
            onClick={() => (ultimo ? fechar('concluido') : irPara(passo + 1))}
          >
            {ultimo ? rotuloFinal : 'Próximo'}
          </button>
        </span>
      </div>
    </dialog>
  );
}
