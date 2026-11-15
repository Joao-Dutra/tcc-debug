import { Inseto } from './Cabecalho';

/**
 * A ilustração das entradas (D43). Era a da tela inicial até D43, quando a
 * cena do detetive tomou o lugar dela lá.
 *
 * Uma folha de exercício mimeografada, com as estruturas
 * desenhadas na tinta roxa da anilina e uma lupa de investigação por cima.
 *
 * A tinta é anilina clara, e não a cor da ação: a folha é o laboratório
 * escolar de D19, e o botão de ação, na ardósia (D39), continua sendo a cor
 * mais forte da tela. Nenhuma cor de significado da bancada aparece aqui — azul, âmbar e
 * vermelho dizem estado de estrutura, e a decoração não pode ensinar outro
 * sentido para eles.
 *
 * Três movimentos, todos em CSS e com nome: `folha-pousa`, uma vez, quando a
 * tela abre; `marcador-avanca`, a seta andando de posição em posição como no
 * reprodutor; e `lupa-investiga`, a lente passeando devagar pela folha. Quem
 * pediu menos movimento ao sistema vê a folha parada.
 */
export function FolhaDeExercicio() {
  const valores = [7, 3, 9, 1, 4];
  return (
    <svg className="folha" viewBox="0 0 520 460" aria-hidden="true">
      {/* Folha de baixo: só a borda, para a de cima ter onde pousar. */}
      <rect x={78} y={44} width={372} height={384} rx={4} className="folha-de-baixo" />

      <g className="folha-de-cima">
        <rect x={62} y={30} width={372} height={384} rx={4} className="papel" />
        {/* Pautas do papel. */}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={84} x2={412} y1={92 + i * 30} y2={92 + i * 30} className="pauta" />
        ))}
        {/* Cabeçalho da folha: traços no lugar de texto, que ninguém precisa ler. */}
        <line x1={86} x2={206} y1={58} y2={58} className="rasura grossa" />
        <line x1={296} x2={410} y1={58} y2={58} className="rasura" />

        {/* Vetor, com o marcador embaixo. */}
        <g className="tinta">
          {valores.map((v, i) => (
            <g key={i}>
              <rect x={104 + i * 52} y={98} width={44} height={46} rx={5} />
              <text x={126 + i * 52} y={128} textAnchor="middle" className="tinta-texto">
                {v}
              </text>
            </g>
          ))}
          <path d="M 120 170 L 132 170 L 126 158 Z" className="marcador-avanca tinta-cheia" />
        </g>

        {/* Pilha, com a base. */}
        <g className="tinta">
          {[0, 1, 2].map((i) => (
            <rect key={i} x={106} y={322 - i * 38} width={88} height={32} rx={5} />
          ))}
          <path d="M 92 362 L 208 362" />
          <path d="M 98 368 L 202 368" className="traco-fino" />
        </g>

        {/* Lista: dois nós, a ligação entre eles e o aterramento no fim. */}
        <g className="tinta">
          <rect x={236} y={262} width={70} height={42} rx={5} />
          <line x1={278} x2={278} y1={262} y2={304} />
          <rect x={340} y={262} width={70} height={42} rx={5} />
          <line x1={382} x2={382} y1={262} y2={304} />
          <path d="M 292 283 L 336 283" />
          <path d="M 328 277 L 336 283 L 328 289" />
          <path d="M 396 283 L 396 330" />
          <path d="M 384 330 L 408 330" />
          <path d="M 389 337 L 403 337" />
          <text x={257} y={289} textAnchor="middle" className="tinta-texto">5</text>
          <text x={361} y={289} textAnchor="middle" className="tinta-texto">8</text>
        </g>

        <Inseto x={150} y={300} escala={0.9} />
      </g>

      {/* A lupa fica fora da folha: ela se move, a folha não. */}
      <g className="lupa-investiga">
        <g transform="translate(300 180) rotate(-30)">
          <rect x={-7} y={40} width={14} height={62} rx={6} className="lupa-cabo" />
          <circle r={44} className="lupa-lente" />
          <circle r={44} className="lupa-aro" />
          <path d="M -24 -18 Q -18 -28 -6 -32" className="lupa-brilho" />
        </g>
      </g>
    </svg>
  );
}

