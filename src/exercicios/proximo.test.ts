import { describe, expect, it } from 'vitest';
import { catalogo, proximoDoCatalogo, proximoEm } from './catalogo';

/**
 * O convite para o próximo (D20), no catálogo e nos propostos por professores
 * (D31): a mesma volta no fim, cada sequência na sua.
 */
describe('o próximo exercício', () => {
  const [a, b, c] = catalogo;

  it('segue a ordem e dá a volta no fim', () => {
    expect(proximoEm([a, b, c], a.id)).toBe(b);
    expect(proximoEm([a, b, c], c.id)).toBe(a);
  });

  it('não convida quando não há outro, nem para fora da sequência', () => {
    expect(proximoEm([a], a.id)).toBeUndefined();
    expect(proximoEm([a, b], c.id)).toBeUndefined();
  });

  it('o catálogo usa a mesma regra', () => {
    for (const exercicio of catalogo) {
      expect(proximoDoCatalogo(exercicio.id)).toBe(proximoEm(catalogo, exercicio.id));
    }
  });
});
