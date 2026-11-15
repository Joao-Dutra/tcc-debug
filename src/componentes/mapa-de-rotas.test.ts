import { describe, expect, it } from 'vitest';
import { enderecoCompleto, mapaDeRotas } from './mapa-de-rotas';
import { interpretarHash } from './usar-rota';

/**
 * O mapa de rotas do painel de controle (D38). Um endereço copiado dali e
 * entregue na aula precisa abrir o que diz: cada caminho volta ao
 * interpretador de rotas e tem de cair na tela certa.
 */

const grupos = mapaDeRotas(['piloto-nov', 'aeds1-2026']);
const grupo = (titulo: string) => grupos.find((g) => g.titulo === titulo)!.rotas;

describe('o mapa de rotas', () => {
  it('as telas fixas caem cada uma na sua', () => {
    expect(grupo('Telas').map((r) => interpretarHash(r.caminho).tela)).toEqual([
      'inicial',
      'entrar',
      'entrar-pesquisa',
      'exercicios',
      'autoria',
      'metricas',
      'controle',
    ]);
  });

  it('os exercícios do catálogo não entram no mapa: quem os lista é a vitrine (D44)', () => {
    expect(grupos.map((g) => g.titulo)).toEqual(['Telas', 'Aplicações do estudo']);
    expect(grupos.flatMap((g) => g.rotas).filter((r) => r.caminho.startsWith('#/exercicio/'))).toEqual([]);
  });

  it('cada aplicação tem o percurso e a conferência', () => {
    expect(grupo('Aplicações do estudo').map((r) => interpretarHash(r.caminho))).toEqual([
      { tela: 'estudo', aplicacao: 'piloto-nov' },
      { tela: 'conferir', aplicacao: 'piloto-nov' },
      { tela: 'estudo', aplicacao: 'aeds1-2026' },
      { tela: 'conferir', aplicacao: 'aeds1-2026' },
    ]);
  });

  it('nenhum caminho se repete: o caminho é a chave da lista na tela', () => {
    const todos = grupos.flatMap((g) => g.rotas.map((r) => r.caminho));
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('o endereço completo é a página com a rota no hash', () => {
    expect(enderecoCompleto('#/estudo/piloto-nov', { origin: 'https://exemplo.org', pathname: '/' })).toBe(
      'https://exemplo.org/#/estudo/piloto-nov'
    );
    expect(enderecoCompleto('#/', { origin: 'http://localhost:5173', pathname: '/depurar/' })).toBe(
      'http://localhost:5173/depurar/#/'
    );
  });
});
