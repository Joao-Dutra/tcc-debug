import { useEffect, useRef } from 'react';
import { MotionConfig } from 'motion/react';
import { visualizadores } from '../visualizacao/visualizadores';
import type { Exercicio, Instantaneo } from '../nucleo/tipos';

/** Margem em volta do desenho enquadrado, em unidades do próprio SVG. */
const FOLGA = 14;

/**
 * Miniatura do cartão na lista de exercícios (D20): o próprio visualizador da
 * estrutura, pequeno e parado, desenhando o estado que o exercício escolheu.
 *
 * O visualizador, e não uma imagem, para o cartão mostrar exatamente o desenho
 * que o estudante vai encontrar dentro do exercício — e para um exercício novo
 * não depender de ninguém gerar figura nenhuma.
 *
 * Quem decide o estado é o exercício, no campo `miniatura`; este componente só
 * o repassa. O teste de quadro-denúncia garante que o estado é anterior à
 * divergência entre as versões, e por isso não entrega o defeito.
 */
export function MiniaturaDoExercicio({ exercicio }: { exercicio: Exercicio }) {
  const moldura = useRef<HTMLDivElement>(null);

  // Enquadra o desenho. O viewBox de cada visualizador é dimensionado para a
  // maior estrutura que ele comporta, e numa miniatura isso vira uma peça
  // miúda num canto da mesa. Recortar pelo que foi de fato desenhado é
  // decisão de moldura, e não de desenho: o visualizador continua sem saber
  // que está numa miniatura. Espera um quadro porque o motion posiciona os
  // marcadores depois da primeira pintura.
  useEffect(() => {
    const quadro = requestAnimationFrame(() => {
      const svg = moldura.current?.querySelector('svg');
      if (!svg) return;
      const caixa = svg.getBBox();
      if (caixa.width === 0 || caixa.height === 0) return;
      svg.setAttribute(
        'viewBox',
        `${caixa.x - FOLGA} ${caixa.y - FOLGA} ${caixa.width + FOLGA * 2} ${caixa.height + FOLGA * 2}`
      );
    });
    return () => cancelAnimationFrame(quadro);
  }, [exercicio]);

  const Visualizador = visualizadores[exercicio.estrutura];
  if (!exercicio.miniatura || !Visualizador) return null;

  // Ordem e linha não vêm de execução nenhuma, e nenhum visualizador as lê: o
  // desenho é função das variáveis. Linha nula é o que menos afirma. Os
  // marcadores são do exercício (D27), e sem eles o cartão desenharia o índice
  // como se fosse um valor guardado.
  const instantaneo: Instantaneo = {
    ordem: 0,
    linha: null,
    variaveis: exercicio.miniatura.variaveis,
    marcadores: exercicio.marcadores,
  };

  return (
    // Decorativa para o leitor de tela: o título do cartão já nomeia o
    // exercício, e o conteúdo do desenho seria lido sem contexto nenhum.
    <div className="miniatura" aria-hidden="true" ref={moldura}>
      {/* Parada: as transições do visualizador existem para mostrar a mudança
          entre dois passos, e aqui não há passo seguinte. Sem apoio porque os
          rótulos de 9 px ficariam ilegíveis nesse tamanho — o que sobra é a
          forma, que é o que o cartão precisa mostrar. */}
      <MotionConfig skipAnimations>
        <Visualizador instantaneo={instantaneo} nivelAndaime="sem-apoio" />
      </MotionConfig>
    </div>
  );
}
