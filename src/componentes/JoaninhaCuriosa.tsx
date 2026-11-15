import type { CSSProperties } from 'react';
import joaninha from '../arte/joaninha.webp';

/**
 * A joaninha que mora no fio do cabeçalho do exercício (D43).
 *
 * A cada execução ela corre para outro ponto do fio, e quando todos os casos
 * passam fica parada debaixo de um aro, como sob a lupa: o defeito foi pego.
 *
 * **Ela nunca diz onde o defeito está.** As paradas são uma lista fixa de
 * posições ao longo do cabeçalho, percorrida na ordem das execuções: não
 * dependem do código, da linha do defeito nem do resultado. E ela fica no
 * cabeçalho, longe do código e do desenho, que é onde se investiga.
 *
 * Fora do percurso do estudo só: lá a tela do exercício continua como estava
 * (D39). Decoração, e por isso escondida do leitor de tela.
 */

/** Em porcentagem da largura do fio. Espalhadas, para a corrida ser visível. */
const PARADAS = [6, 58, 27, 83, 44, 14, 71, 36, 92];

interface Props {
  /** Quantas execuções já houve; cada uma leva a joaninha à parada seguinte. */
  rodada: number;
  /** Todos os casos de teste passaram. */
  capturada: boolean;
}

export function JoaninhaCuriosa({ rodada, capturada }: Props) {
  const parada = PARADAS[rodada % PARADAS.length];
  const anterior = PARADAS[(rodada + PARADAS.length - 1) % PARADAS.length];
  // A arte olha para a esquerda: indo para a direita, ela vira.
  const classes = ['joaninha-curiosa', parada > anterior && 'para-a-direita', capturada && 'capturada']
    .filter(Boolean)
    .join(' ');
  return (
    <span className="trilha-da-joaninha" aria-hidden="true">
      <span className={classes} style={{ '--parada': parada } as CSSProperties}>
        <img src={joaninha} alt="" draggable={false} />
      </span>
    </span>
  );
}
