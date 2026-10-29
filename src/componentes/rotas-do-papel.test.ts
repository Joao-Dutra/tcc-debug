import { describe, expect, it } from 'vitest';
import { rotasDoPapel } from './rotas-do-papel';
import { interpretarHash } from './usar-rota';

describe('o menu de cada papel', () => {
  it('o participante não vê menu nenhum: anônimo, sem identidade ou com conta sem papel', () => {
    expect(rotasDoPapel({ forma: 'anonima', papel: 'participante' })).toEqual([]);
    expect(rotasDoPapel({ forma: 'nenhuma', papel: null })).toEqual([]);
    expect(rotasDoPapel({ forma: 'email', papel: 'participante' })).toEqual([]);
    expect(rotasDoPapel({ forma: 'google', papel: null })).toEqual([]);
  });

  it('anônimo nunca tem menu, mesmo que o papel lido diga outra coisa', () => {
    expect(rotasDoPapel({ forma: 'anonima', papel: 'pesquisador' })).toEqual([]);
    expect(rotasDoPapel({ forma: 'anonima', papel: 'professor' })).toEqual([]);
  });

  it('o professor vê a autoria', () => {
    const rotas = rotasDoPapel({ forma: 'google', papel: 'professor' });
    expect(rotas.map((r) => interpretarHash(r.caminho).tela)).toEqual(['autoria']);
  });

  it('o pesquisador vê o painel de controle, as métricas e o mapa de rotas do painel', () => {
    const rotas = rotasDoPapel({ forma: 'email', papel: 'pesquisador' });
    expect(rotas.map((r) => r.rotulo)).toEqual(['Painel de controle', 'Métricas', 'Mapa de rotas']);
    expect(rotas.map((r) => interpretarHash(r.caminho))).toEqual([
      { tela: 'controle' },
      { tela: 'metricas' },
      { tela: 'controle', secao: 'rotas' },
    ]);
  });
});
