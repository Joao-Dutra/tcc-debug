/**
 * Nível de andaime (scaffolding) da sessão — ver D9.
 *
 * O andaime é parâmetro da sessão, não propriedade do exercício: o mesmo
 * exercício pode ser apresentado com apoios diferentes, e é isso que torna
 * duas sessões do mesmo exercício comparáveis entre si.
 *
 * Este módulo é a tabela de D9 escrita em código. Toda decisão de "o que este
 * nível revela" mora aqui; as telas consultam e não decidem.
 *
 * Os níveis têm nome e não número porque a numeração media quantidade de
 * apoio, e portanto crescia na direção contrária à da dificuldade — troca
 * fácil de fazer sem perceber na hora da análise. Além disso "nível" já
 * designa a dificuldade intrínseca do exercício, que é outra coisa e precisa
 * continuar distinguível.
 */

export type NivelDeAndaime = 'completo' | 'parcial' | 'minimo';

/** Ausente ou inválido cai aqui: apoio nunca é retirado por engano. */
export const ANDAIME_PADRAO: NivelDeAndaime = 'completo';

const NIVEIS: readonly NivelDeAndaime[] = ['completo', 'parcial', 'minimo'];

export function interpretarAndaime(valor: string | null | undefined): NivelDeAndaime {
  return NIVEIS.find((nivel) => nivel === valor) ?? ANDAIME_PADRAO;
}

/** Quantas dicas ficam disponíveis. O exercício pode ter menos do que isso. */
export function dicasDisponiveis(nivel: NivelDeAndaime): number {
  switch (nivel) {
    case 'completo':
      return 3;
    case 'parcial':
      return 1;
    case 'minimo':
      return 0;
  }
}

/** Quanto o painel de casos de teste revela. */
export type DetalheDosCasos = 'esperado-e-obtido' | 'passou-ou-falhou' | 'apenas-que-falhou';

export function detalheDosCasos(nivel: NivelDeAndaime): DetalheDosCasos {
  switch (nivel) {
    case 'completo':
      return 'esperado-e-obtido';
    case 'parcial':
      return 'passou-ou-falhou';
    case 'minimo':
      return 'apenas-que-falhou';
  }
}

/**
 * Legendas de orientação do desenho — "base", "sai pelo início", "entra pelo
 * fim", e afins. São o primeiro apoio a ser retirado.
 */
export function mostrarLegendas(nivel: NivelDeAndaime): boolean {
  return nivel === 'completo';
}

/**
 * Índices das posições e rótulos dos marcadores ("topo = 2"). Some no apoio
 * mínimo, onde resta a forma e a posição do marcador: relacionar o marcador à
 * variável do código volta a ser trabalho do estudante.
 */
export function mostrarRotulos(nivel: NivelDeAndaime): boolean {
  return nivel !== 'minimo';
}
