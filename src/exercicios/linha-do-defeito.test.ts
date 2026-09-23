import { describe, expect, it } from 'vitest';
import { catalogo } from './catalogo';
import { linhasDivergentes } from '../nucleo/divergencia';

/**
 * `linhaDoDefeito` conferida contra o código, e não contra a memória de quem
 * escreveu o exercício.
 *
 * O campo é o alvo da declaração de localização (D7): errado, ele diz ao
 * estudante que a linha certa está errada, e o dado da sessão fica
 * inutilizável. E ele sai do lugar em silêncio a cada linha acrescentada
 * acima dele — foi o que aconteceu ao tornar a construção das listas mais
 * didática.
 */
describe.each(catalogo)('$id', (exercicio) => {
  const divergentes = linhasDivergentes(exercicio.codigoCorreto, exercicio.codigoComDefeito);

  it('as duas versões divergem em alguma linha', () => {
    // Sem divergência não há defeito nenhum implantado.
    expect(divergentes).not.toHaveLength(0);
  });

  it('linhaDoDefeito é a primeira linha em que as versões divergem', () => {
    expect(exercicio.linhaDoDefeito).toBe(divergentes[0]);
  });

  it('a linha apontada existe no código com defeito', () => {
    const linhas = exercicio.codigoComDefeito.split('\n');
    expect(exercicio.linhaDoDefeito).toBeGreaterThanOrEqual(1);
    expect(exercicio.linhaDoDefeito).toBeLessThanOrEqual(linhas.length);
    // Linha em branco não é lugar de defeito: aponta para o texto errado.
    expect(linhas[exercicio.linhaDoDefeito - 1].trim()).not.toBe('');
  });

  it('as duas versões têm o mesmo número de linhas', () => {
    // O defeito troca o conteúdo de uma linha, não o número delas. Versões de
    // tamanhos diferentes deslocam todas as linhas seguintes, e a linha
    // apontada deixa de querer dizer o que diz.
    expect(exercicio.codigoComDefeito.split('\n')).toHaveLength(
      exercicio.codigoCorreto.split('\n').length
    );
  });
});
