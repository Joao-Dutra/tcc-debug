/**
 * Tira o código correto dos exercícios do catálogo antes de irem ao navegador
 * (D41). Quem chama é o plugin do `vite.config.ts`, no build e no servidor de
 * desenvolvimento; a suíte rápida não passa por aqui, e os testes continuam
 * lendo o catálogo inteiro.
 *
 * Por que no build, e não separando o código correto em outro arquivo: cada
 * exercício continua sendo um módulo só, com as duas versões lado a lado, que
 * é como o autor as escreve e confere (skill criar-exercicio). O que muda é
 * só o que o navegador recebe.
 *
 * Sem importação nenhuma, pelo mesmo motivo de `exemplos-publicos.ts`: o
 * `vite.config.ts` importa este arquivo.
 */

/** Os módulos de `src/exercicios/` que não são exercício. */
const NAO_SAO_EXERCICIO = new Set(['catalogo', 'exemplos-publicos', 'sem-gabarito']);

/**
 * O código correto é sempre um texto entre crases, sem `${}` nem crase dentro:
 * D17 proíbe as duas coisas no código do exercício, e o estilo confere.
 */
const CODIGO_CORRETO = /codigoCorreto:\s*`([^`]*)`/g;

/** O id do exercício, se o caminho é o de um módulo de exercício; nulo se não é. */
export function exercicioDoCaminho(caminho: string): string | null {
  const m = /[\\/]src[\\/]exercicios[\\/]([a-z0-9-]+)\.ts$/.exec(caminho.split('?')[0]);
  if (!m || NAO_SAO_EXERCICIO.has(m[1])) return null;
  return m[1];
}

export interface FonteSemGabarito {
  fonte: string;
  /** O código correto que saiu, para a conferência do pacote final; nulo se nada saiu. */
  retirado: string | null;
}

/**
 * A fonte do módulo com o código correto trocado por texto vazio, a menos que
 * o exercício seja um dos exemplos públicos.
 *
 * Falha alto quando não reconhece a forma: um exercício que mencione
 * `codigoCorreto` sem ser no formato esperado iria ao navegador inteiro, em
 * silêncio, e é melhor o build parar.
 */
export function tirarCodigoCorreto(
  fonte: string,
  id: string,
  publicos: readonly string[]
): FonteSemGabarito {
  const achados = [...fonte.matchAll(CODIGO_CORRETO)];
  if (achados.length === 0 && !fonte.includes('codigoCorreto')) return { fonte, retirado: null };
  if (achados.length !== 1) {
    throw new Error(
      `${id}: esperava um codigoCorreto entre crases, e achei ${achados.length}. ` +
        'Sem reconhecer a forma, o código correto iria inteiro ao navegador (D41).'
    );
  }
  if (publicos.includes(id)) return { fonte, retirado: null };
  return {
    fonte: fonte.replace(CODIGO_CORRETO, () => "codigoCorreto: ''"),
    retirado: achados[0][1],
  };
}

/**
 * As formas em que um texto pode aparecer num pacote minificado: como saiu do
 * fonte, entre crases, ou numa string comum, com as quebras de linha
 * escapadas.
 */
export function formasNoPacote(texto: string): string[] {
  return [texto, JSON.stringify(texto).slice(1, -1)];
}

/** Se o texto aparece no pacote, em qualquer das formas. */
export function aparecemNoPacote(pacote: string, texto: string): boolean {
  return formasNoPacote(texto).some((forma) => pacote.includes(forma));
}
