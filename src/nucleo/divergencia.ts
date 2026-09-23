/**
 * Onde duas versões do mesmo programa divergem, linha a linha.
 *
 * `linhaDoDefeito` é escrita à mão em cada exercício e sai do lugar em
 * silêncio a cada edição no código — foi o que aconteceu ao tornar a
 * construção das listas mais didática. Derivar a linha da comparação entre as
 * duas versões torna isso verificável, e é a mesma conta que a área de autoria
 * vai precisar fazer para não pedir a linha ao professor.
 */

/**
 * Números das linhas (a partir de 1) em que as duas versões diferem.
 *
 * Comparação linha a linha, sem alinhamento: acrescentar ou remover uma linha
 * faz todas as seguintes contarem como divergentes. É o que se quer aqui — um
 * defeito implantado troca o conteúdo de uma linha, não o número delas, e uma
 * diferença de tamanho precisa aparecer inteira em vez de passar por uma
 * divergência pequena.
 */
export function linhasDivergentes(correto: string, comDefeito: string): number[] {
  const a = correto.split('\n');
  const b = comDefeito.split('\n');
  const divergentes: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) divergentes.push(i + 1);
  }
  return divergentes;
}
