/**
 * Ilustrações do tutorial do participante (D32) que as da tela inicial não
 * cobrem: a tela inteira, os controles do reprodutor e o editor com o botão
 * destacado.
 *
 * Mesmas regras das da tela inicial (D20): primitivas no próprio código, sem
 * arquivo de imagem (D13), grafite no traço e anilina no que é ação. Nenhuma
 * cor de significado da bancada, e nenhum desenho de estrutura com estado —
 * o tutorial ensina onde as coisas ficam, e não o que um quadro quer dizer.
 */

/** A tela do exercício em miniatura: o código à esquerda, o desenho e os casos à direita. */
export function IconeTela() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={1} y={2} width={54} height={44} rx={4} className="placa" />
      <rect x={5} y={7} width={21} height={35} rx={2} className="cheio" />
      <path d="M 9 13 L 19 13 M 9 18 L 22 18 M 9 23 L 16 23" className="sobre-botao traco-fino" />
      <rect x={30} y={7} width={21} height={17} rx={2} className="placa" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={33 + i * 6} y={13} width={5} height={6} rx={1} className="traco-fino" />
      ))}
      <path d="M 31 30 L 50 30 M 31 35 L 46 35 M 31 40 L 48 40" className="linha-de-codigo" />
    </svg>
  );
}

/** Os controles do reprodutor: anterior, tocar, próximo e a barra. */
export function IconeControles() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={1} y={10} width={13} height={13} rx={3} className="placa" />
      <path d="M 9 13 L 5.5 16.5 L 9 20" className="traco-fino" />
      <rect x={17} y={10} width={13} height={13} rx={3} className="botao-cheio" />
      <path d="M 21.5 13 L 26.5 16.5 L 21.5 20 Z" className="sobre-botao" />
      <rect x={33} y={10} width={13} height={13} rx={3} className="placa" />
      <path d="M 38 13 L 41.5 16.5 L 38 20" className="traco-fino" />
      <path d="M 2 36 L 54 36" className="linha-de-codigo" />
      <path d="M 2 36 L 30 36" className="cheio-traco" />
      <circle cx={30} cy={36} r={4.5} className="botao-cheio" />
    </svg>
  );
}

/** O editor com o cursor no meio de uma linha, e o botão de executar destacado. */
export function IconeEditar() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={2} y={4} width={40} height={34} rx={4} className="placa" />
      <path d="M 2 13 L 42 13" className="traco-fino" />
      <path d="M 10 21 L 26 21 M 10 34 L 20 34" className="linha-de-codigo" />
      <path d="M 10 28 L 22 28" className="linha-de-codigo" />
      {/* O cursor de texto, onde a edição acontece. */}
      <path d="M 25 24.5 L 25 31.5" className="cheio-traco" />
      {/* O halo em volta do botão: é ele que diz que há alteração pendente. */}
      <circle cx={42} cy={36} r={14} className="halo" />
      <circle cx={42} cy={36} r={11} className="botao-cheio" />
      <path d="M 39 31 L 48 36 L 39 41 Z" className="sobre-botao" />
    </svg>
  );
}
