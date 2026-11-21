import { describe, expect, it } from 'vitest';
import { analisarDivergencia } from '../../src/nucleo/divergencia';
import { instrumentar } from '../../src/nucleo/instrumentar';
import {
  MENSAGEM_DO_LIMITE_DE_PASSOS,
  MENSAGEM_DO_TEMPO_LIMITE,
  naoTerminou,
} from '../../src/nucleo/limites';
import { afirmacoesQueFaltam, escoreDoSus, ITENS_DAS_ESCALAS } from '../../src/estudo/questionario';

/**
 * Testes de unidade — Projeto Final de Qualidade de Software (2026).
 *
 * Cada `describe` corresponde a um caso de teste documentado no relatório
 * (CTU01 a CTU06). As unidades escolhidas são funções puras do núcleo e do
 * estudo: recebem dados e devolvem dados, sem Worker, sem rede e sem React,
 * o que permite isolá-las por completo.
 */

/** Respostas do SUS com o mesmo valor nos dez itens. */
const susTodos = (valor: number) =>
  Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`sus-${i + 1}`, valor]));

describe('CTU01 — analisarDivergencia: uma linha alterada', () => {
  it('aponta a única linha diferente como linha do defeito', () => {
    const correto = 'var a = 1;\nvar b = a + 1;\nvar c = b * 2;';
    const comDefeito = 'var a = 1;\nvar b = a - 1;\nvar c = b * 2;';

    expect(analisarDivergencia(correto, comDefeito)).toEqual({
      tipo: 'linha-alterada',
      linha: 2,
      linhasAceitas: [2],
    });
  });

  it('diferença só de recuo não conta como defeito', () => {
    const correto = 'if (x) {\n  y = 1;\n}';
    const comRecuo = 'if (x) {\n        y = 1;\n}';
    const r = analisarDivergencia(correto, comRecuo);
    expect(r.tipo).toBe('recusada');
    if (r.tipo === 'recusada') expect(r.motivo).toMatch(/iguais/);
  });
});

describe('CTU02 — analisarDivergencia: troca de duas linhas vizinhas', () => {
  it('aceita as duas linhas trocadas como localização do defeito', () => {
    const correto = 'var a = 1;\nnovo.prox = atual.prox;\natual.prox = novo;\nvar fim = 0;';
    const comDefeito = 'var a = 1;\natual.prox = novo;\nnovo.prox = atual.prox;\nvar fim = 0;';

    expect(analisarDivergencia(correto, comDefeito)).toEqual({
      tipo: 'linha-fora-do-lugar',
      linha: 2,
      linhasAceitas: [2, 3],
    });
  });
});

describe('CTU03 — analisarDivergencia: entradas inválidas são recusadas', () => {
  it('recusa versões idênticas (não há defeito)', () => {
    const r = analisarDivergencia('var a = 1;', 'var a = 1;');
    expect(r.tipo).toBe('recusada');
  });

  it('recusa versões com número de linhas diferente', () => {
    const r = analisarDivergencia('var a = 1;\nvar b = 2;', 'var a = 1;');
    expect(r.tipo).toBe('recusada');
    if (r.tipo === 'recusada') expect(r.motivo).toMatch(/tamanhos diferentes/);
  });

  it('recusa a linha alterada que ficou em branco', () => {
    const r = analisarDivergencia('var a = 1;\nvar b = 2;\nvar c = 3;', 'var a = 1;\n\nvar c = 3;');
    expect(r).toMatchObject({ tipo: 'recusada', linhas: [2] });
  });

  it('recusa as mesmas linhas embaralhadas por mais de uma troca', () => {
    const r = analisarDivergencia('a();\nb();\nc();\nd();', 'b();\na();\nd();\nc();');
    expect(r).toMatchObject({ tipo: 'recusada', linhas: [1, 2, 3, 4] });
  });

  it('recusa quando a única linha que mudou de lugar está em branco', () => {
    const r = analisarDivergencia(
      'var a = 1;\n\nx = 1;\ny = 2;\nfim();',
      'var a = 1;\nx = 1;\ny = 2;\n\nfim();'
    );
    expect(r.tipo).toBe('recusada');
    if (r.tipo === 'recusada') expect(r.motivo).toMatch(/em branco/);
  });

  it('recusa dois defeitos independentes', () => {
    const r = analisarDivergencia('var a = 1;\nvar b = 2;\nvar c = 3;', 'var a = 0;\nvar b = 2;\nvar c = 4;');
    expect(r).toMatchObject({ tipo: 'recusada', linhas: [1, 3] });
  });
});

describe('CTU04 — escoreDoSus: cálculo do System Usability Scale', () => {
  it('respostas neutras (3 em todos os itens) valem 50', () => {
    expect(escoreDoSus(susTodos(3))).toBe(50);
  });

  it('a melhor resposta possível vale 100 e a pior vale 0', () => {
    const melhor: Record<string, number> = {};
    const pior: Record<string, number> = {};
    for (let i = 1; i <= 10; i++) {
      // Itens ímpares são positivos; pares, negativos.
      melhor[`sus-${i}`] = i % 2 === 1 ? 5 : 1;
      pior[`sus-${i}`] = i % 2 === 1 ? 1 : 5;
    }
    expect(escoreDoSus(melhor)).toBe(100);
    expect(escoreDoSus(pior)).toBe(0);
  });

  it('devolve nulo quando falta item ou há valor fora da escala', () => {
    const faltando = susTodos(4);
    delete faltando['sus-7'];
    expect(escoreDoSus(faltando)).toBeNull();
    expect(escoreDoSus({ ...susTodos(4), 'sus-2': 6 })).toBeNull();
    expect(escoreDoSus({ ...susTodos(4), 'sus-2': 0 })).toBeNull();
    expect(escoreDoSus({ ...susTodos(4), 'sus-2': 2.5 })).toBeNull();
  });
});

describe('CTU05 — naoTerminou e afirmacoesQueFaltam', () => {
  it('reconhece só as duas mensagens de limite de execução', () => {
    expect(naoTerminou(MENSAGEM_DO_LIMITE_DE_PASSOS)).toBe(true);
    expect(naoTerminou(MENSAGEM_DO_TEMPO_LIMITE)).toBe(true);
    expect(naoTerminou('TypeError: x is undefined')).toBe(false);
    expect(naoTerminou(undefined)).toBe(false);
  });

  it('conta os itens do questionário ainda sem resposta', () => {
    const total = ITENS_DAS_ESCALAS.length;
    expect(afirmacoesQueFaltam({})).toBe(total);
    expect(afirmacoesQueFaltam({ [ITENS_DAS_ESCALAS[0].id]: 'nao-usei' })).toBe(total - 1);
  });
});

describe('CTU06 — instrumentar: inserção das sondas na AST', () => {
  it('insere uma chamada __passo antes de cada instrução, com a linha original', () => {
    const saida = instrumentar('var a = 1;\nvar b = a + 1;');
    expect(saida).toMatch(/__passo\(1,/);
    expect(saida).toMatch(/__passo\(2,/);
    // Quadro final (D1): a última sonda tem linha nula.
    expect(saida).toMatch(/__passo\(null,/);
  });

  it('lança erro para código com erro de sintaxe', () => {
    expect(() => instrumentar('var a = ;')).toThrow();
  });
});

describe('CTU07 — analisarDivergencia: linha em branco no fim do código', () => {
  // Defeito DEF-01, encontrado por este caso: o professor que cola uma das
  // versões com uma quebra de linha a mais no fim recebia a recusa "tamanhos
  // diferentes", embora as linhas de código se correspondam uma a uma.
  it('uma quebra de linha a mais no fim não impede a comparação', () => {
    const correto = 'var a = 1;\nvar b = 2;\n';
    const comDefeito = 'var a = 1;\nvar b = 3;';

    expect(analisarDivergencia(correto, comDefeito)).toEqual({
      tipo: 'linha-alterada',
      linha: 2,
      linhasAceitas: [2],
    });
  });
});
