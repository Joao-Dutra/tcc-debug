/**
 * O tema da interface (D39): o padrão, que é a areia de D19, e o azul.
 *
 * Um tema é um conjunto de papéis de cor no CSS, trocado pelo atributo
 * `data-tema` da raiz; aqui fica só a escolha. O desenho não muda com o
 * tema: os papéis da bancada são fixos (index.css).
 *
 * **Na área do estudo, o tema é fixo no padrão**, e o que estiver guardado no
 * navegador é ignorado. Um tema escolhido pelo participante seria uma
 * variável não controlada entre participantes, e os computadores do
 * laboratório são compartilhados: o tema escolhido por quem usou a máquina
 * antes passaria ao participante seguinte.
 *
 * Sem React: a interface assina as mudanças, e o teste rápido alcança a
 * regra inteira.
 */

import type { TemaDaInterface } from '../nucleo/metricas';

export const TEMAS = ['padrao', 'azul'] as const satisfies readonly TemaDaInterface[];
export type Tema = (typeof TEMAS)[number];

export const TEMA_PADRAO: Tema = 'padrao';

/** O tema que está na página agora, como a raiz o diz. */
export function temaNaPagina(raiz: { getAttribute(nome: string): string | null }): Tema {
  return interpretarTema(raiz.getAttribute('data-tema'));
}

export const ROTULOS_DO_TEMA: Record<Tema, string> = {
  padrao: 'Padrão',
  azul: 'Azul',
};

const CHAVE = 'depurar:tema';

/** O pedaço do `localStorage` que o tema usa: um armazenamento de mentira serve. */
export interface ArmazenamentoDoTema {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

export function interpretarTema(valor: unknown): Tema {
  return TEMAS.includes(valor as Tema) ? (valor as Tema) : TEMA_PADRAO;
}

/** Sem armazenamento, ou com ele falhando, vale o padrão. */
export function lerTemaGuardado(armazenamento: ArmazenamentoDoTema | null): Tema {
  try {
    return interpretarTema(armazenamento?.getItem(CHAVE));
  } catch {
    return TEMA_PADRAO;
  }
}

/** Sem armazenamento, a escolha vale até a página fechar, e não é um erro. */
export function guardarTema(armazenamento: ArmazenamentoDoTema | null, tema: Tema): void {
  try {
    armazenamento?.setItem(CHAVE, tema);
  } catch {
    // Janela privada ou dado do site bloqueado: fica só na memória.
  }
}

/** As telas da área do estudo (D37), onde o tema é sempre o padrão. */
const TELAS_DO_ESTUDO = new Set(['estudo', 'conferir']);

export function temaFixo(tela: string): boolean {
  return TELAS_DO_ESTUDO.has(tela);
}

/** O tema que vale numa tela: o escolhido, ou o padrão na área do estudo. */
export function temaDaTela(tela: string, escolhido: Tema): Tema {
  return temaFixo(tela) ? TEMA_PADRAO : escolhido;
}

export function aplicarTema(raiz: { setAttribute(nome: string, valor: string): void }, tema: Tema): void {
  raiz.setAttribute('data-tema', tema);
}

export function armazenamentoDoNavegador(): ArmazenamentoDoTema | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// A escolha da aba, para o seletor e para quem precisa saber o tema da tela.
let escolhido: Tema = TEMA_PADRAO;
const ouvintes = new Set<() => void>();

/** Chamada uma vez, antes da primeira tela. */
export function carregarTema(armazenamento: ArmazenamentoDoTema | null): Tema {
  escolhido = lerTemaGuardado(armazenamento);
  return escolhido;
}

export function temaEscolhido(): Tema {
  return escolhido;
}

export function escolherTema(armazenamento: ArmazenamentoDoTema | null, tema: Tema): void {
  escolhido = tema;
  guardarTema(armazenamento, tema);
  for (const ouvir of ouvintes) ouvir();
}

export function assinarTema(ouvir: () => void): () => void {
  ouvintes.add(ouvir);
  return () => ouvintes.delete(ouvir);
}
