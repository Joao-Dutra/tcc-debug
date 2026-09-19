/**
 * Ilustrações da tela inicial (D20).
 *
 * Mesmo espírito da folha mimeografada: montadas com primitivas no próprio
 * código, sem arquivo de imagem e sem recurso externo (D13). Grafite no traço e
 * anilina no que é ação — nenhuma cor de significado da bancada aparece aqui,
 * porque azul, âmbar e vermelho dizem estado de estrutura e a decoração não
 * pode ensinar outro sentido para eles (D19).
 *
 * Cada uma mostra o gesto do passo, e não um símbolo genérico: a janela de
 * código com o botão, a lupa sobre a estrutura, o número da linha apontado.
 */

/** Passo 1 — executar: a janela do código e o botão de tocar. */
export function IconeExecutar() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={2} y={4} width={40} height={34} rx={4} className="placa" />
      <path d="M 2 13 L 42 13" className="traco-fino" />
      <path d="M 10 21 L 26 21 M 10 28 L 32 28 M 10 34 L 20 34" className="linha-de-codigo" />
      <circle cx={42} cy={36} r={11} className="botao-cheio" />
      <path d="M 39 31 L 48 36 L 39 41 Z" className="sobre-botao" />
    </svg>
  );
}

/** Passo 2 — observar: a lupa sobre a fileira, como na folha. */
export function IconeObservar() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1 + i * 14} y={12} width={12} height={17} rx={2.5} className="placa" />
      ))}
      <path d="M 2 38 L 12 38 L 7 31 Z" className="cheio" />
      {/* A lupa examina a última posição, e a alça sai para fora da fileira. */}
      <g transform="translate(44 17)">
        <circle r={12} className="lente" />
        <circle r={12} className="aro" />
        <path d="M 9 9 L 15 16" className="cabo" />
      </g>
    </svg>
  );
}

/** Passo 3 — apontar e corrigir: o número da linha e o lápis. */
export function IconeApontar() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <path d="M 16 10 L 40 10 M 16 32 L 36 32 M 16 39 L 28 39" className="linha-de-codigo" />
      {/* O número apontado: a mesma pastilha que o gutter do editor mostra sob
          o mouse. */}
      <rect x={2} y={14} width={13} height={14} rx={3} className="botao-cheio" />
      <path d="M 7 18 L 9 18 L 9 24 M 7 24 L 11 24" className="sobre-botao traco-fino" />
      <path d="M 16 21 L 30 21" className="linha-de-codigo" />
      {/* Lápis: corpo, ponta e a marca que ele deixa. */}
      <g transform="rotate(-38 42 26)">
        <path d="M 36 14 L 48 14 L 48 30 L 42 36 L 36 30 Z" className="placa" />
        <path d="M 36 30 L 48 30" className="traco-fino" />
        <path d="M 42 36 L 42 33" className="cheio-traco" />
      </g>
    </svg>
  );
}
