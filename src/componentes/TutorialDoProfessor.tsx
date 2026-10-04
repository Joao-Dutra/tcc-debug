import type { JSX } from 'react';
import { GuiaPassoAPasso } from './GuiaPassoAPasso';
import { IconeTela } from './IlustracoesDoTutorial';
import {
  IconeCasos,
  IconeCodigoCorreto,
  IconeDefeito,
  IconeDicas,
  IconeEstrutura,
  IconePublicar,
  IconeVerificar,
} from './IlustracoesDoProfessor';
import { PASSOS_DO_TUTORIAL_DO_PROFESSOR } from './passos-do-tutorial-do-professor';
import type { IlustracaoDoProfessor } from './passos-do-tutorial-do-professor';
import type { DesfechoDoTutorial } from '../nucleo/metricas';

/**
 * Tutorial do professor: como criar a primeira atividade (D33).
 *
 * Abre sozinho na primeira vez que um professor sem exercício nenhum chega à
 * área, e depois pelo botão de ajuda. Não entra no log: o professor não é
 * participante do estudo.
 */

const ILUSTRACOES: Record<IlustracaoDoProfessor, () => JSX.Element> = {
  estrutura: IconeEstrutura,
  codigo: IconeCodigoCorreto,
  defeito: IconeDefeito,
  casos: IconeCasos,
  dicas: IconeDicas,
  verificar: IconeVerificar,
  // A mesma tela em miniatura do tutorial do participante: é ela que o
  // professor vai ver.
  previa: IconeTela,
  publicar: IconePublicar,
};

const PASSOS = PASSOS_DO_TUTORIAL_DO_PROFESSOR.map((p) => ({
  ...p,
  Ilustracao: ILUSTRACOES[p.ilustracao],
}));

interface Props {
  aberto: boolean;
  /** Concluído pelo último botão, a área abre o editor de um exercício novo. */
  aoFechar: (desfecho: DesfechoDoTutorial) => void;
}

export function TutorialDoProfessor({ aberto, aoFechar }: Props) {
  return (
    <GuiaPassoAPasso
      aberto={aberto}
      assunto="Sua primeira atividade"
      passos={PASSOS}
      aoFechar={(desfecho) => aoFechar(desfecho)}
      rotuloFinal="Escrever a atividade"
    />
  );
}
