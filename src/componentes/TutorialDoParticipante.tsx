import type { JSX } from 'react';
import { GuiaPassoAPasso } from './GuiaPassoAPasso';
import { IconeApontar, IconeExecutar, IconeObservar } from './IlustracoesDaInicial';
import { IconeControles, IconeEditar, IconeTela } from './IlustracoesDoTutorial';
import { PASSOS_DO_TUTORIAL } from './passos-do-tutorial';
import type { IlustracaoDoPasso } from './passos-do-tutorial';
import type { DesfechoDoTutorial } from '../nucleo/metricas';

/**
 * Tutorial do participante: um modal passo a passo sobre como usar a tela do
 * exercício (D32). O mecanismo do modal é o do guia passo a passo; aqui fica
 * o que o participante lê.
 *
 * **Não recebe o nível de apoio**, e é isso que o torna idêntico nos dois —
 * o mesmo cuidado do sinal de acerto. O texto é constante e mora em
 * `passos-do-tutorial.ts`, com as regras do que ele pode e não pode dizer.
 */

const ILUSTRACOES: Record<IlustracaoDoPasso, () => JSX.Element> = {
  tela: IconeTela,
  executar: IconeExecutar,
  controles: IconeControles,
  observar: IconeObservar,
  apontar: IconeApontar,
  editar: IconeEditar,
};

const PASSOS = PASSOS_DO_TUTORIAL.map((p) => ({ ...p, Ilustracao: ILUSTRACOES[p.ilustracao] }));

interface Props {
  aberto: boolean;
  aoFechar: (desfecho: DesfechoDoTutorial, passoAlcancado: number, totalDePassos: number) => void;
}

export function TutorialDoParticipante({ aberto, aoFechar }: Props) {
  return (
    <GuiaPassoAPasso aberto={aberto} assunto="Como usar a tela" passos={PASSOS} aoFechar={aoFechar} />
  );
}
