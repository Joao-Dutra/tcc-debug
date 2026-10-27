import { describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import { enderecoCompleto, mapaDeRotas } from './mapa-de-rotas';
import { interpretarHash } from './usar-rota';

/**
 * O mapa de rotas do painel de controle (D38). Um endereço copiado dali e
 * entregue na aula precisa abrir o que diz: cada caminho volta ao
 * interpretador de rotas e tem de cair na tela certa.
 */

const grupos = mapaDeRotas(catalogo, ['piloto-nov', 'aeds1-2026']);
const grupo = (titulo: string) => grupos.find((g) => g.titulo === titulo)!.rotas;

describe('o mapa de rotas', () => {
  it('as telas fixas caem cada uma na sua', () => {
    expect(grupo('Telas').map((r) => interpretarHash(r.caminho).tela)).toEqual([
      'inicial',
      'entrar',
      'exercicios',
      'autoria',
      'metricas',
      'controle',
    ]);
  });

  it('cada exercício do catálogo aparece com e sem apoio, e o link abre esse apoio', () => {
    const rotas = grupo('Exercícios do catálogo');
    expect(rotas).toHaveLength(catalogo.length * 2);
    for (const e of catalogo) {
      for (const nivel of ['com-apoio', 'sem-apoio'] as const) {
        const rota = rotas.find((r) => r.caminho === `#/exercicio/${e.id}?andaime=${nivel}`);
        expect(rota, `${e.id} ${nivel}`).toBeDefined();
        expect(interpretarHash(rota!.caminho)).toEqual({ tela: 'exercicio', id: e.id, andaime: nivel });
      }
    }
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
