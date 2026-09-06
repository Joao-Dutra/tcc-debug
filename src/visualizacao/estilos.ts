/**
 * Convenção visual comum aos visualizadores (D10).
 *
 * Vive em um lugar só para que pilha, fila e os próximos desenhem os mesmos
 * estados do mesmo jeito: o estudante aprende a ler o desenho uma vez.
 *
 * Toda distinção tem portador além da cor. O traço da borda separa célula
 * ativa de consumida, e o elemento apontado ganha um anel — não uma tinta.
 * Isso não é só acessibilidade: no apoio mínimo (D9) os rótulos somem, e a
 * forma é o que resta para carregar a informação.
 */

/**
 * `consumida` é toda posição fora do intervalo que os marcadores delimitam.
 * Na pilha é o que ficou acima do topo; na fila, o que já saiu pelo início —
 * e, no limite, o que ainda não entrou pelo fim. De que lado está diz qual é
 * o caso, sem precisar de uma terceira cor.
 */
export type EstadoDaCelula = 'ativa' | 'consumida';

export interface EstiloDaCelula {
  fill: string;
  stroke: string;
  /** Ausente na célula ativa: traço contínuo é o estado normal. */
  strokeDasharray?: string;
  opacidade: number;
}

/**
 * As cores vêm das variáveis de significado declaradas em src/index.css, que é
 * onde estão documentadas. O traço e a opacidade ficam aqui porque são
 * consumidos como número — um pela animação, outro pelo atributo do SVG — e
 * variável CSS não atende nenhum dos dois. São, ainda assim, parte do mesmo
 * significado: é o traço que impede a cor de ser o único portador.
 */
export const CELULA: Record<EstadoDaCelula, EstiloDaCelula> = {
  ativa: {
    fill: 'var(--celula-ativa-fundo)',
    stroke: 'var(--celula-ativa-traco)',
    opacidade: 1,
  },
  consumida: {
    fill: 'var(--celula-consumida-fundo)',
    stroke: 'var(--celula-consumida-traco)',
    strokeDasharray: '4 3',
    opacidade: 0.45,
  },
};

/**
 * Anel do elemento que os marcadores apontam como o próximo a ser tratado.
 *
 * A cor é deliberadamente âmbar, e não a de erro: o anel diz o que o programa
 * vai tratar em seguida segundo o estado atual, nunca que isso está errado. A
 * ferramenta não conhece o comportamento correto.
 */
export const DESTAQUE = {
  cor: 'var(--elemento-apontado)',
  espessura: 3,
  /** Folga entre a borda da célula e o anel, para os dois ficarem legíveis. */
  folga: 5,
};
