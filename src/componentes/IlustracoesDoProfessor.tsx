/**
 * Ilustrações do tutorial do professor (D33), no mesmo traço das da tela
 * inicial e do tutorial do participante: primitivas no próprio código, sem
 * arquivo de imagem (D13), grafite no traço e anilina no que é ação. Nenhuma
 * cor de significado da bancada.
 */

/** A estrutura escolhida e os nomes que o desenho procura, como etiquetas. */
export function IconeEstrutura() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={3 + i * 15} y={6} width={13} height={16} rx={2.5} className="placa" />
      ))}
      <rect x={3} y={30} width={22} height={9} rx={4.5} className="botao-cheio" />
      <path d="M 8 34.5 L 20 34.5" className="sobre-botao traco-fino" />
      <rect x={29} y={30} width={18} height={9} rx={4.5} className="placa" />
      <path d="M 33 34.5 L 43 34.5" className="traco-fino" />
    </svg>
  );
}

/** A janela do código, com o sinal de que ele funciona. */
export function IconeCodigoCorreto() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={2} y={4} width={40} height={34} rx={4} className="placa" />
      <path d="M 2 13 L 42 13" className="traco-fino" />
      <path d="M 10 21 L 26 21 M 10 28 L 32 28 M 10 34 L 20 34" className="linha-de-codigo" />
      <circle cx={42} cy={36} r={11} className="botao-cheio" />
      <path d="M 37 36 L 41 40 L 47.5 32.5" className="sobre-botao traco-fino" />
    </svg>
  );
}

/** Duas versões lado a lado, e uma linha só diferente entre elas. */
export function IconeDefeito() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={1} y={4} width={25} height={38} rx={3} className="placa" />
      <rect x={30} y={4} width={25} height={38} rx={3} className="placa" />
      <path d="M 6 13 L 20 13 M 6 30 L 18 30 M 6 36 L 14 36" className="linha-de-codigo" />
      <path d="M 35 13 L 49 13 M 35 30 L 47 30 M 35 36 L 43 36" className="linha-de-codigo" />
      <path d="M 6 21.5 L 21 21.5" className="linha-de-codigo" />
      {/* A linha alterada, a única diferente. */}
      <rect x={32.5} y={18} width={20} height={7} rx={2} className="botao-cheio" />
    </svg>
  );
}

/** A lista de casos: um que passa e um que falha. */
export function IconeCasos() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={2} y={4} width={50} height={38} rx={4} className="placa" />
      <path d="M 9 16 L 12 19 L 17 13" className="cheio-traco" />
      <path d="M 22 16 L 44 16" className="linha-de-codigo" />
      <path d="M 9 26 L 16 33 M 16 26 L 9 33" className="cheio-traco" />
      <path d="M 22 29.5 L 40 29.5" className="linha-de-codigo" />
    </svg>
  );
}

/** Três dicas em ordem, a primeira à frente. */
export function IconeDicas() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={14} y={2} width={38} height={14} rx={3} className="placa" />
      <rect x={8} y={14} width={38} height={14} rx={3} className="placa" />
      <rect x={2} y={26} width={38} height={14} rx={3} className="placa" />
      <path d="M 8 33 L 30 33" className="linha-de-codigo" />
      <circle cx={42} cy={40} r={7} className="botao-cheio" />
      <path d="M 42 37 L 42 41 M 42 43.5 L 42 43.6" className="sobre-botao traco-fino" />
    </svg>
  );
}

/** A lupa da verificação sobre as duas versões. */
export function IconeVerificar() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <rect x={1} y={8} width={18} height={26} rx={3} className="placa" />
      <rect x={22} y={8} width={18} height={26} rx={3} className="placa" />
      <path d="M 5 16 L 15 16 M 5 22 L 13 22 M 26 16 L 36 16 M 26 22 L 34 22" className="linha-de-codigo" />
      <g transform="translate(42 28)">
        <circle r={10} className="lente" />
        <circle r={10} className="aro" />
        <path d="M 7.5 7.5 L 12.5 13" className="cabo" />
      </g>
    </svg>
  );
}

/** O cartão do exercício chegando à vitrine. */
export function IconePublicar() {
  return (
    <svg className="icone-passo" viewBox="-3 -3 62 54" aria-hidden="true">
      <path d="M 2 44 L 54 44" className="cheio-traco" />
      <rect x={4} y={22} width={14} height={18} rx={2.5} className="placa" />
      <rect x={38} y={22} width={14} height={18} rx={2.5} className="placa" />
      <rect x={21} y={14} width={14} height={18} rx={2.5} className="botao-cheio" />
      <path d="M 28 10 L 28 2 M 24.5 5.5 L 28 2 L 31.5 5.5" className="cheio-traco" />
    </svg>
  );
}
