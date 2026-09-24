import { describe, expect, it } from 'vitest';
import { catalogo } from './catalogo';
import { analisarDivergencia } from '../nucleo/divergencia';

/**
 * `linhaDoDefeito` conferida contra o código, e não contra a memória de quem
 * escreveu o exercício (D28, D30).
 *
 * O campo é o alvo da declaração de localização (D7): errado, ele diz ao
 * estudante que a linha certa está errada, e o dado da sessão fica
 * inutilizável. E ele sai do lugar em silêncio a cada linha acrescentada
 * acima dele.
 *
 * A regra é a mesma que a submissão de um professor enfrenta — um defeito só,
 * coeso, numa linha que se possa apontar —, e mora no núcleo.
 */
describe.each(catalogo)('$id', (exercicio) => {
  const divergencia = analisarDivergencia(exercicio.codigoCorreto, exercicio.codigoComDefeito);

  it('tem um defeito só, coeso e localizável numa linha', () => {
    expect(divergencia.tipo, divergencia.tipo === 'recusada' ? divergencia.motivo : '').not.toBe(
      'recusada'
    );
  });

  it('linhaDoDefeito é a linha declarada pela comparação das versões', () => {
    if (divergencia.tipo === 'recusada') return;
    expect(exercicio.linhaDoDefeito).toBe(divergencia.linha);
  });

  it('as linhas aceitas como localização são as que a comparação aceita', () => {
    // Na troca de ordem, as duas linhas; em qualquer outro caso, só a
    // declarada. Faltar uma aqui é o estudante ouvir "não está aqui" onde está.
    if (divergencia.tipo === 'recusada') return;
    expect(exercicio.linhasAceitas ?? [exercicio.linhaDoDefeito]).toEqual(
      divergencia.linhasAceitas
    );
  });
});
