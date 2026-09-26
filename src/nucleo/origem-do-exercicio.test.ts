import { describe, expect, it } from 'vitest';
import { SEM_FILTRO, VERSAO_DO_REGISTRO, criarSessao, filtrarSessoes, origemDe } from './metricas';
import type { RegistroDeSessao } from './metricas';

/**
 * A origem do exercício no registro da sessão (D31), por execução.
 *
 * A análise do estudo precisa separar as sessões em exercícios de professor
 * das do catálogo: os de professor não passaram pela suíte do catálogo nem
 * pelo congelamento. E precisa ler do mesmo jeito os registros de antes do
 * campo, que são todos do catálogo.
 */

const sessao = (origemDoExercicio?: 'catalogo' | 'professor') =>
  criarSessao({ exercicioId: 'x', linhaDoDefeito: 1, origemDoExercicio, participanteId: 'p' });

describe('a origem no registro', () => {
  it('do professor, quando a sessão é de um exercício de professor', () => {
    expect(sessao('professor').registro().origemDoExercicio).toBe('professor');
  });

  it('do catálogo, quando ninguém diz nada', () => {
    expect(sessao().registro().origemDoExercicio).toBe('catalogo');
  });

  it('o registro marca a versão em que o campo passou a existir', () => {
    expect(VERSAO_DO_REGISTRO).toBeGreaterThanOrEqual(8);
    expect(sessao().registro().versao).toBe(VERSAO_DO_REGISTRO);
  });

  it('um registro de antes do campo é lido como do catálogo', () => {
    const { origemDoExercicio: _semEla, ...antigo } = { ...sessao().registro(), versao: 7 };
    expect(origemDe(antigo)).toBe('catalogo');
  });
});

describe('o recorte por origem', () => {
  const catalogo = sessao('catalogo').registro();
  const professor = sessao('professor').registro();
  const { origemDoExercicio: _semEla, ...antigo } = { ...sessao().registro(), versao: 7 };
  const todas: RegistroDeSessao[] = [catalogo, professor, antigo];

  it('separa as de professor', () => {
    expect(filtrarSessoes(todas, { ...SEM_FILTRO, origemDoExercicio: 'professor' })).toEqual([
      professor,
    ]);
  });

  it('as de catálogo incluem as antigas, que não tinham o campo', () => {
    expect(filtrarSessoes(todas, { ...SEM_FILTRO, origemDoExercicio: 'catalogo' })).toEqual([
      catalogo,
      antigo,
    ]);
  });
});
