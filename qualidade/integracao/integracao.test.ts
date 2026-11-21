import { beforeAll, describe, expect, it } from 'vitest';
import { abrirWorker } from '../../src/nucleo/worker-em-teste';
import type { RodarNoWorker } from '../../src/nucleo/worker-em-teste';
import { MENSAGEM_DO_LIMITE_DE_PASSOS, naoTerminou } from '../../src/nucleo/limites';
import { criarSessao, resumirSessao } from '../../src/nucleo/metricas';
import { rascunhoDoExercicio, verificarExercicio } from '../../src/nucleo/verificacao-do-exercicio';
import type { Executor } from '../../src/nucleo/verificacao-do-exercicio';
import { catalogo } from '../../src/exercicios/catalogo';
import { vetorDobrar } from '../../src/exercicios/vetor-dobrar';
import type { Exercicio } from '../../src/nucleo/tipos';

/**
 * Testes de integração — abordagem BOTTOM-UP.
 *
 * A integração começa pelos módulos das folhas, já testados isoladamente na
 * etapa de unidade (instrumentar, analisarDivergencia, limites), e sobe um
 * nível por vez:
 *
 *   Nível 1  instrumentar + executor.worker            (CTI01, CTI02)
 *   Nível 2  + exercícios do catálogo (casos de teste)  (CTI03)
 *   Nível 3  + verificarExercicio (divergência, quadro-denúncia)  (CTI04)
 *   Nível 4  + criarSessao / resumirSessao (métricas)   (CTI05)
 *
 * Como os módulos de baixo já existem e são reais, não há stubs: cada arquivo
 * de teste faz o papel de DRIVER, chamando o módulo do nível que está sendo
 * integrado. `abrirWorker()` é o driver do Worker: carrega exatamente o mesmo
 * arquivo que roda no navegador, num `self` de mentira, em vez de reescrevê-lo.
 */

let rodar: RodarNoWorker;
let executar: Executor;

beforeAll(async () => {
  rodar = await abrirWorker();
  executar = (exercicio, codigo) =>
    Promise.resolve(
      rodar({
        codigo,
        variaveisObservadas: exercicio.variaveisObservadas,
        marcadores: exercicio.marcadores,
        casos: exercicio.casosDeTeste,
      })
    );
});

const rodarExercicio = (exercicio: Exercicio, codigo: string) =>
  rodar({
    codigo,
    variaveisObservadas: exercicio.variaveisObservadas,
    marcadores: exercicio.marcadores,
    casos: exercicio.casosDeTeste,
  });

describe('CTI01 — instrumentar + Worker: os instantâneos acompanham a execução', () => {
  it('cada instrução gera um quadro, e o quadro final mostra o resultado', () => {
    const r = rodar({
      codigo: 'var itens = [1, 2, 3];\nfor (var i = 0; i < itens.length; i++) {\n  itens[i] = itens[i] * 10;\n}',
      variaveisObservadas: ['itens', 'i'],
    });

    expect(r.erro).toBeUndefined();
    expect(r.instantaneos.length).toBeGreaterThan(3);
    // Ordem contínua a partir de zero.
    r.instantaneos.forEach((q, indice) => expect(q.ordem).toBe(indice));
    const final = r.instantaneos.at(-1)!;
    expect(final.linha).toBeNull();
    expect(final.variaveis.itens).toEqual([10, 20, 30]);
  });
});

describe('CTI02 — instrumentar + Worker + limites: laço infinito é interrompido', () => {
  it('o Worker corta a execução pelo limite de passos e devolve a mensagem padronizada', () => {
    const r = rodar({ codigo: 'var i = 0;\nwhile (i < 10) {\n  i = i;\n}', variaveisObservadas: ['i'] });

    expect(r.erro).toBe(MENSAGEM_DO_LIMITE_DE_PASSOS);
    expect(naoTerminou(r.erro)).toBe(true);
  });
});

describe('CTI03 — Worker + catálogo: o defeito quebra casos, a correção passa em todos', () => {
  it.each(catalogo.map((e) => [e.id, e] as const))('%s', (_id, exercicio) => {
    const comDefeito = rodarExercicio(exercicio, exercicio.codigoComDefeito);
    const correto = rodarExercicio(exercicio, exercicio.codigoCorreto);

    expect(comDefeito.casos.some((c) => !c.passou)).toBe(true);
    expect(correto.casos.length).toBeGreaterThan(0);
    expect(correto.casos.every((c) => c.passou)).toBe(true);
  });
});

describe('CTI04 — verificarExercicio: a área do professor integrada ao núcleo', () => {
  it('aprova um exercício bem formado e deriva a linha do defeito', async () => {
    const relatorio = await verificarExercicio(rascunhoDoExercicio(vetorDobrar), executar);

    expect(relatorio.aprovado).toBe(true);
    expect(relatorio.derivado?.linhaDoDefeito).toBe(vetorDobrar.linhaDoDefeito);
    expect(relatorio.itens.every((i) => i.aprovado)).toBe(true);
  });

  it('recusa um exercício cujo "defeito" não quebra caso nenhum', async () => {
    const rascunho = rascunhoDoExercicio(vetorDobrar);
    // Troca uma linha por outra equivalente: muda o texto, não o comportamento.
    const equivalente = rascunho.codigoCorreto.replace('indice = indice + 1;', 'indice += 1;');
    const relatorio = await verificarExercicio({ ...rascunho, codigoComDefeito: equivalente }, executar);

    expect(relatorio.aprovado).toBe(false);
    expect(relatorio.itens.find((i) => i.chave === 'defeito-quebra')?.aprovado).toBe(false);
  });
});

describe('CTI05 — Worker + sessão de métricas: o resumo reflete o que o estudante fez', () => {
  it('registra execuções, dica, localização e correção, com os tempos em ordem', () => {
    let relogio = 0;
    const sessao = criarSessao({
      exercicioId: vetorDobrar.id,
      linhaDoDefeito: vetorDobrar.linhaDoDefeito,
      agora: () => relogio,
    });

    relogio = 1_000;
    const id1 = sessao.iniciarExecucao('estudante', vetorDobrar.codigoComDefeito);
    sessao.concluirExecucao(id1, rodarExercicio(vetorDobrar, vetorDobrar.codigoComDefeito));
    relogio = 5_000;
    sessao.registrarDica(0);
    relogio = 9_000;
    expect(sessao.registrarLocalizacao(vetorDobrar.linhaDoDefeito)).toEqual({ julgada: true, correta: true });
    relogio = 15_000;
    sessao.registrarEdicao(vetorDobrar.codigoCorreto);
    relogio = 16_000;
    const id2 = sessao.iniciarExecucao('estudante', vetorDobrar.codigoCorreto);
    sessao.concluirExecucao(id2, rodarExercicio(vetorDobrar, vetorDobrar.codigoCorreto));

    const resumo = resumirSessao(sessao.registro().eventos);
    expect(resumo).toMatchObject({
      tempoAtePrimeiraExecucaoMs: 1_000,
      tempoAteLocalizacaoMs: 9_000,
      tempoAteCorrecaoMs: 16_000,
      execucoes: 2,
      dicasReveladas: 1,
      edicoes: 1,
      corrigido: true,
    });
  });
});
