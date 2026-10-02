import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { IconeApontar, IconeExecutar, IconeObservar } from './IlustracoesDaInicial';
import { IconeControles, IconeEditar, IconeTela } from './IlustracoesDoTutorial';
import { PASSOS_DO_TUTORIAL } from './passos-do-tutorial';
import type { IlustracaoDoPasso } from './passos-do-tutorial';
import type { DesfechoDoTutorial } from '../nucleo/metricas';

/**
 * Tutorial do participante: um modal passo a passo sobre como usar a tela do
 * exercício (D32).
 *
 * **Não recebe o nível de apoio**, e é isso que o torna idêntico nos dois —
 * o mesmo cuidado do sinal de acerto. O texto é constante e mora em
 * `passos-do-tutorial.ts`, com as regras do que ele pode e não pode dizer.
 *
 * O modal é o `<dialog>` do navegador: ele prende o foco enquanto está aberto,
 * devolve o foco ao fechar e fecha com Esc, sem biblioteca nenhuma.
 */

const ILUSTRACOES: Record<IlustracaoDoPasso, () => JSX.Element> = {
  tela: IconeTela,
  executar: IconeExecutar,
  controles: IconeControles,
  observar: IconeObservar,
  apontar: IconeApontar,
  editar: IconeEditar,
};

interface Props {
  aberto: boolean;
  /**
   * Chamada uma vez por fechamento. `passoAlcancado` é o passo mais adiantado
   * mostrado, a partir de 1: quem voltou do quarto para o segundo e pulou
   * chegou a ver o quarto.
   */
  aoFechar: (desfecho: DesfechoDoTutorial, passoAlcancado: number, totalDePassos: number) => void;
}

export function TutorialDoParticipante({ aberto, aoFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const [passo, setPasso] = useState(0);
  const [alcancado, setAlcancado] = useState(0);
  const total = PASSOS_DO_TUTORIAL.length;

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

  const atual = PASSOS_DO_TUTORIAL[passo];
  const Ilustracao = ILUSTRACOES[atual.ilustracao];
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
          Como usar a tela · passo {passo + 1} de {total}
        </p>
        <button className="tutorial-fechar" aria-label="Fechar o tutorial" onClick={() => fechar('pulado')}>
          <XMarkIcon className="icone" aria-hidden="true" />
        </button>
      </div>
      <div className="tutorial-corpo">
        <Ilustracao />
        <div>
          <h2 id="titulo-do-tutorial">{atual.titulo}</h2>
          <p>{atual.texto}</p>
        </div>
      </div>
      <ol className="tutorial-pontos" aria-hidden="true">
        {PASSOS_DO_TUTORIAL.map((p, i) => (
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
            {ultimo ? 'Começar' : 'Próximo'}
          </button>
        </span>
      </div>
    </dialog>
  );
}
