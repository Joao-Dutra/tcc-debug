import { beforeAll, describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import { vetorDobrar } from '../exercicios/vetor-dobrar';
import { verificarExercicio } from './verificacao-do-exercicio';
import { abrirWorker } from './worker-em-teste';
import type { Executor, RascunhoDeExercicio } from './verificacao-do-exercicio';
import type { Exercicio } from './tipos';

/**
 * A verificação da submissão de um professor (D31), por execução.
 *
 * A primeira bateria é a que sustenta a decisão: todo exercício do catálogo,
 * escrito como rascunho, passa na verificação do professor. As regras são as
 * mesmas funções, e este teste é o que impede que divirjam — um exercício bom o
 * bastante para o catálogo não pode ser recusado na área de autoria, nem o
 * contrário.
 *
 * As demais cobram cada recusa e a razão que ela dá.
 */

let executar: Executor;
beforeAll(async () => {
  const rodar = await abrirWorker();
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

/** Um exercício do catálogo escrito como o formulário do professor o escreveria. */
function rascunhoDe(exercicio: Exercicio): RascunhoDeExercicio {
  const marcadores = exercicio.marcadores ?? [];
  return {
    titulo: exercicio.titulo,
    enunciado: exercicio.enunciado,
    estrutura: exercicio.estrutura,
    dificuldade: exercicio.dificuldade,
    categoriaDefeito: exercicio.categoriaDefeito,
    codigoCorreto: exercicio.codigoCorreto,
    codigoComDefeito: exercicio.codigoComDefeito,
    casosDeTeste: exercicio.casosDeTeste,
    dicas: exercicio.dicas,
    marcadores,
    variaveisDeValor:
      exercicio.estrutura === 'vetor'
        ? exercicio.variaveisObservadas.filter((v) => v !== 'itens' && !marcadores.includes(v))
        : [],
  };
}

const itemDe = async (rascunho: RascunhoDeExercicio, chave: string) =>
  (await verificarExercicio(rascunho, executar)).itens.find((i) => i.chave === chave);

describe('o catálogo passa na verificação do professor', () => {
  it.each(catalogo)('$id', async (exercicio) => {
    const relatorio = await verificarExercicio(rascunhoDe(exercicio), executar);
    const recusas = relatorio.itens.filter((i) => !i.aprovado).map((i) => i.explicacao);
    expect(recusas).toEqual([]);
    expect(relatorio.aprovado).toBe(true);
    // A linha que a verificação deriva é a que o catálogo declara.
    expect(relatorio.derivado?.linhaDoDefeito).toBe(exercicio.linhaDoDefeito);
    expect(relatorio.derivado?.linhasAceitas).toEqual(
      exercicio.linhasAceitas ?? [exercicio.linhaDoDefeito]
    );
    expect(relatorio.avisosDeEstilo).toEqual([]);
  });
});

const BASE = rascunhoDe(vetorDobrar);

describe('as recusas, cada uma com a razão', () => {
  it('modelo incompleto: faltam dicas', async () => {
    const item = await itemDe({ ...BASE, dicas: ['só uma'] }, 'modelo');
    expect(item).toMatchObject({ aprovado: false, explicacao: expect.stringMatching(/três dicas/) });
  });

  it('dois defeitos', async () => {
    const comDefeito = BASE.codigoComDefeito
      .replace('var indice = 0;', 'var indice = 1;');
    const item = await itemDe({ ...BASE, codigoComDefeito: comDefeito }, 'defeito-unico');
    expect(item).toMatchObject({
      aprovado: false,
      explicacao: expect.stringMatching(/mais de um defeito/),
    });
  });

  it('código que não compila, e o que depende dele fica sem conferir', async () => {
    const relatorio = await verificarExercicio(
      { ...BASE, codigoComDefeito: BASE.codigoComDefeito.replace('while (', 'while ((') },
      executar
    );
    expect(relatorio.itens.find((i) => i.chave === 'sintaxe')?.aprovado).toBe(false);
    expect(relatorio.itens.find((i) => i.chave === 'quadro-denuncia')?.explicacao).toMatch(
      /^Não conferido/
    );
    expect(relatorio.aprovado).toBe(false);
  });

  it('laço infinito: recusado, porque o estudante receberia o limite e não um quadro', async () => {
    // Na busca binária, dois dos três candidatos a defeito caíam aqui (D28).
    const comDefeito = BASE.codigoComDefeito.replace(
      'indice = indice + 1;',
      'indice = indice + 0;'
    );
    const item = await itemDe({ ...BASE, codigoComDefeito: comDefeito }, 'termina');
    expect(item).toMatchObject({
      aprovado: false,
      explicacao: expect.stringMatching(/não termina/),
    });
  });

  it('o código correto que falha num caso', async () => {
    const casos = [...BASE.casosDeTeste, { descricao: 'caso errado', expressao: 'itens[0]', esperado: 99 }];
    const item = await itemDe({ ...BASE, casosDeTeste: casos }, 'correto-passa');
    expect(item).toMatchObject({ aprovado: false, explicacao: expect.stringMatching(/caso errado/) });
  });

  it('o defeito que não quebra caso nenhum', async () => {
    const casos = [{ descricao: 'só o tamanho', expressao: 'itens.length', esperado: 4 }];
    const item = await itemDe({ ...BASE, casosDeTeste: casos }, 'defeito-quebra');
    expect(item).toMatchObject({
      aprovado: false,
      explicacao: expect.stringMatching(/mutante equivalente/),
    });
  });

  it('o nome que o desenho procura não aparece', async () => {
    // Trocado em tudo, inclusive nos casos: o programa roda inteiro, e só o
    // desenho fica sem o vetor que procura.
    const trocar = (codigo: string) => codigo.split('itens').join('valores');
    const item = await itemDe(
      {
        ...BASE,
        codigoCorreto: trocar(BASE.codigoCorreto),
        codigoComDefeito: trocar(BASE.codigoComDefeito),
        casosDeTeste: BASE.casosDeTeste.map((c) => ({ ...c, expressao: trocar(c.expressao) })),
      },
      'nomes'
    );
    expect(item).toMatchObject({ aprovado: false, explicacao: expect.stringMatching(/^itens não aparece/) });
  });

  it('o defeito que o desenho não mostra: só o valor devolvido muda', async () => {
    // É o caso que motivou D16: a pilha que devolvia o elemento errado
    // atravessando os mesmos estados.
    const correto = [
      'var itens = [1, 2];',
      'var indice = 0;',
      'function soma() {',
      '  var total = 0;',
      '  for (indice = 0; indice < 2; indice = indice + 1) {',
      '    total = total + itens[indice];',
      '  }',
      '  return total;',
      '}',
      'var resultado = soma();',
    ].join('\n');
    const rascunho: RascunhoDeExercicio = {
      ...BASE,
      codigoCorreto: correto,
      codigoComDefeito: correto.replace('return total;', 'return total + 1;'),
      casosDeTeste: [{ descricao: 'soma', expressao: 'resultado', esperado: 3 }],
    };
    const item = await itemDe(rascunho, 'quadro-denuncia');
    expect(item).toMatchObject({
      aprovado: false,
      explicacao: expect.stringMatching(/mesmos estados/),
    });
  });
});

describe('o que avisa sem recusar', () => {
  it('o estilo de D17: aponta a linha e a versão, e não bloqueia', async () => {
    const comLet = (codigo: string) => codigo.replace('var indice = 0;', 'let indice = 0;');
    const relatorio = await verificarExercicio(
      { ...BASE, codigoCorreto: comLet(BASE.codigoCorreto), codigoComDefeito: comLet(BASE.codigoComDefeito) },
      executar
    );
    expect(relatorio.aprovado).toBe(true);
    expect(relatorio.avisosDeEstilo).toEqual([
      { versao: 'com defeito', aviso: expect.objectContaining({ linha: 2, construcao: 'declaração com let' }) },
      { versao: 'correta', aviso: expect.objectContaining({ linha: 2, construcao: 'declaração com let' }) },
    ]);
  });

  it('o defeito que quebra todos os casos', async () => {
    // Só os dois casos que o defeito de vetor-dobrar quebra.
    const casos = BASE.casosDeTeste.filter((c) => c.expressao === 'itens' || c.expressao === 'itens[3]');
    const relatorio = await verificarExercicio({ ...BASE, casosDeTeste: casos }, executar);
    expect(relatorio.avisos).toEqual([expect.stringMatching(/falha em todos os casos/)]);
  });
});
