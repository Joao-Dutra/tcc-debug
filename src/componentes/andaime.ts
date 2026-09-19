/**
 * Nível de andaime (scaffolding) da sessão — ver D9.
 *
 * O andaime é parâmetro da sessão, não propriedade do exercício: o mesmo
 * exercício pode ser apresentado com apoio ou sem apoio, e é isso que torna
 * duas sessões do mesmo exercício comparáveis entre si. Sem essa variável o
 * estudo perde o grupo de comparação.
 *
 * Este módulo é a tabela de D9 escrita em código. Toda decisão de "o que este
 * nível revela" mora aqui; as telas consultam e não decidem.
 *
 * São dois níveis desde o piloto, que mostrou os níveis reduzidos quase sempre
 * abandonados. `com-apoio` reúne o que o antigo `completo` oferecia, e
 * `sem-apoio`, o que o antigo `minimo` oferecia; o `parcial` deixou de existir
 * (D9). O que o nível nunca muda é o que o núcleo faz: o código executado, os
 * casos avaliados e os instantâneos gerados são os mesmos nos dois.
 *
 * Os níveis têm nome e não número porque a numeração media quantidade de
 * apoio, e portanto crescia na direção contrária à da dificuldade — troca
 * fácil de fazer sem perceber na hora da análise. Além disso "nível" já
 * designa a dificuldade intrínseca do exercício, que é outra coisa e precisa
 * continuar distinguível.
 */

export type NivelDeAndaime = 'com-apoio' | 'sem-apoio';

/** Ausente ou inválido cai aqui: apoio nunca é retirado por engano. */
export const ANDAIME_PADRAO: NivelDeAndaime = 'com-apoio';

/** Do apoio maior para o menor, que é a ordem em que a interface os oferece. */
export const NIVEIS_DE_ANDAIME: readonly NivelDeAndaime[] = ['com-apoio', 'sem-apoio'];

export function interpretarAndaime(valor: string | null | undefined): NivelDeAndaime {
  return NIVEIS_DE_ANDAIME.find((nivel) => nivel === valor) ?? ANDAIME_PADRAO;
}

/**
 * Como o nível é escrito para o estudante. O valor que viaja na URL usa hífen,
 * para o link ser fácil de digitar e de colar; o rótulo visível é a mesma
 * expressão escrita normalmente.
 */
const ROTULOS: Record<NivelDeAndaime, string> = {
  'com-apoio': 'com apoio',
  'sem-apoio': 'sem apoio',
};

export function rotuloDoAndaime(nivel: NivelDeAndaime): string {
  return ROTULOS[nivel];
}

/** Quantas dicas ficam disponíveis. O exercício pode ter menos do que isso. */
export function dicasDisponiveis(nivel: NivelDeAndaime): number {
  return nivel === 'com-apoio' ? 3 : 0;
}

/** Quanto o painel de casos de teste revela. */
export type DetalheDosCasos = 'esperado-e-obtido' | 'apenas-que-falhou';

export function detalheDosCasos(nivel: NivelDeAndaime): DetalheDosCasos {
  return nivel === 'com-apoio' ? 'esperado-e-obtido' : 'apenas-que-falhou';
}

/**
 * Legendas de orientação do desenho — "base", "sai pelo início", "entra pelo
 * fim", e afins.
 */
export function mostrarLegendas(nivel: NivelDeAndaime): boolean {
  return nivel === 'com-apoio';
}

/**
 * Índices das posições e rótulos dos marcadores ("topo = 2"). Somem sem apoio,
 * onde resta a forma e a posição do marcador: relacionar o marcador à variável
 * do código volta a ser trabalho do estudante.
 */
export function mostrarRotulos(nivel: NivelDeAndaime): boolean {
  return nivel === 'com-apoio';
}

/**
 * Destaque, no editor, da linha do passo exibido. Sai junto com os rótulos e
 * pelo mesmo motivo: fica o indicador textual com o número da linha, e achar
 * essa linha no código volta a ser trabalho do estudante.
 */
export function destacarLinhaNoEditor(nivel: NivelDeAndaime): boolean {
  return nivel === 'com-apoio';
}
