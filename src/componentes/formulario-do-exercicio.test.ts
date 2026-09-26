import { describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import { formularioDe, formularioVazio, rascunhoDoFormulario } from './formulario-do-exercicio';
import type { RascunhoDeExercicio } from '../nucleo/verificacao-do-exercicio';

/**
 * O formulário da área do professor (D31), verificado sem navegador.
 *
 * O que ele valida é digitação, e não regra de exercício: JSON do valor
 * esperado, nomes de variável. E a ida e volta entre rascunho e formulário não
 * pode perder nada — um rascunho reaberto precisa sair igual.
 */

const RASCUNHO: RascunhoDeExercicio = {
  titulo: 'Vetor: exemplo',
  enunciado: 'Enunciado.',
  estrutura: 'vetor',
  dificuldade: 2,
  categoriaDefeito: 'indice-deslocado',
  codigoCorreto: 'var itens = [1];',
  codigoComDefeito: 'var itens = [2];',
  casosDeTeste: [
    { descricao: 'número', expressao: 'itens[0]', esperado: 1 },
    { descricao: 'texto', expressao: "'a'", esperado: 'a' },
    { descricao: 'vetor', expressao: 'itens', esperado: [1] },
    { descricao: 'nulo', expressao: 'null', esperado: null },
  ],
  dicas: ['uma', 'duas', 'três'],
  marcadores: ['j', 'ultimo'],
  variaveisDeValor: ['temp'],
};

describe('ida e volta', () => {
  it('o rascunho reaberto no formulário sai igual', () => {
    expect(rascunhoDoFormulario(formularioDe(RASCUNHO))).toEqual({ rascunho: RASCUNHO, erros: [] });
  });

  it.each(catalogo)('$id escrito no formulário e lido de volta', (exercicio) => {
    const marcadores = exercicio.marcadores ?? [];
    const rascunho: RascunhoDeExercicio = {
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
    expect(rascunhoDoFormulario(formularioDe(rascunho)).rascunho).toEqual(rascunho);
  });
});

describe('o que o formulário recusa na hora', () => {
  it('valor esperado que não é JSON, dizendo qual caso', () => {
    const formulario = formularioDe(RASCUNHO);
    formulario.casos[1].esperado = 'ana';
    const { rascunho, erros } = rascunhoDoFormulario(formulario);
    expect(rascunho).toBeNull();
    expect(erros).toEqual([expect.stringMatching(/caso 2 não é JSON válido/)]);
  });

  it('nome de variável com espaço', () => {
    const formulario = { ...formularioDe(RASCUNHO), marcadores: 'j, meu indice' };
    expect(rascunhoDoFormulario(formulario).erros).toEqual([
      expect.stringMatching(/"meu indice" não é um nome de variável/),
    ]);
  });

  it('o mesmo nome como marcador e como valor', () => {
    const formulario = { ...formularioDe(RASCUNHO), variaveisDeValor: 'temp, j' };
    expect(rascunhoDoFormulario(formulario).erros).toEqual([
      expect.stringMatching(/j está como marcador e como variável de valor/),
    ]);
  });
});

describe('o que o formulário deixa passar', () => {
  it('linha de caso vazia some, sem virar erro', () => {
    const formulario = formularioDe(RASCUNHO);
    formulario.casos.push({ descricao: '', expressao: '', esperado: '' });
    expect(rascunhoDoFormulario(formulario).rascunho?.casosDeTeste).toHaveLength(4);
  });

  it('fora do vetor, marcadores e valores não entram', () => {
    const formulario = { ...formularioDe(RASCUNHO), estrutura: 'pilha' as const };
    expect(rascunhoDoFormulario(formulario).rascunho).toMatchObject({
      marcadores: [],
      variaveisDeValor: [],
    });
  });

  it('o formulário vazio vira um rascunho vazio, que a verificação é quem recusa', () => {
    // Salvar um rascunho pela metade é legítimo; enviar é que exige tudo.
    expect(rascunhoDoFormulario(formularioVazio()).erros).toEqual([]);
  });
});
