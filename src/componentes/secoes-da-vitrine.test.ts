import { describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import { SECOES, secaoDe } from './secoes-da-vitrine';

/**
 * As seções da vitrine (D34): a ordenação ganha seção própria sem deixar de
 * ser vetor, e sem nenhum id mudar.
 */

describe('as seções da vitrine', () => {
  const daOrdenacao = catalogo.filter((e) => secaoDe(e) === 'ordenacao').map((e) => e.id);

  it('a seção da ordenação tem os três algoritmos de ordenação, e só eles', () => {
    expect(daOrdenacao).toEqual([
      'vetor-ordenar',
      'vetor-ordenar-por-selecao',
      'vetor-ordenar-por-insercao',
    ]);
  });

  it('os da ordenação continuam sendo vetor: a estrutura decide o desenho', () => {
    for (const e of catalogo.filter((x) => secaoDe(x) === 'ordenacao')) {
      expect(e.estrutura, e.id).toBe('vetor');
    }
  });

  // A busca binária pressupõe o vetor ordenado e não ordena nada: na seção da
  // ordenação, o filtro diria que ela é o que ela não é.
  it('a busca binária fica em vetor', () => {
    expect(secaoDe(catalogo.find((e) => e.id === 'vetor-busca-binaria')!)).toBe('vetor');
  });

  // As sessões gravadas identificam o exercício pelo id: mudar o id do bubble
  // sort, ao mudá-lo de seção, separaria as sessões dele em dois exercícios.
  it('o bubble sort mantém o id de antes', () => {
    expect(catalogo.some((e) => e.id === 'vetor-ordenar')).toBe(true);
  });

  it('o catálogo segue a ordem das seções, para o convite ao próximo seguir a vitrine', () => {
    const ordem = SECOES.map((s) => s.secao);
    const posicoes = catalogo.map((e) => ordem.indexOf(secaoDe(e)));
    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it('todo exercício cai numa seção que a vitrine desenha', () => {
    const conhecidas = SECOES.map((s) => s.secao);
    for (const e of catalogo) expect(conhecidas, e.id).toContain(secaoDe(e));
  });
});
