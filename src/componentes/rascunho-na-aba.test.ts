import { describe, expect, it } from 'vitest';
import {
  baseDe,
  chaveDoRascunho,
  decidirRestauracao,
  esquecerAberto,
  esquecerDaAba,
  guardarAberto,
  guardarNaAba,
  lerAberto,
  lerDaAba,
} from './rascunho-na-aba';
import type { ArmazenamentoDaAba } from './rascunho-na-aba';
import { formularioDe, formularioVazio, rascunhoDoFormulario } from './formulario-do-exercicio';
import { rascunhoDoExercicio } from '../nucleo/verificacao-do-exercicio';
import { catalogo } from '../exercicios/catalogo';
import type { RascunhoDeExercicio } from '../nucleo/verificacao-do-exercicio';

/**
 * O formulário do professor guardado na aba: o texto sobrevive a um
 * recarregamento, nunca cobre em silêncio uma versão mais nova do banco, e
 * some quando o banco passa a tê-lo.
 */

function abaDeMentira(): ArmazenamentoDaAba & { itens: Map<string, string> } {
  const itens = new Map<string, string>();
  return {
    itens,
    getItem: (k) => itens.get(k) ?? null,
    setItem: (k, v) => void itens.set(k, v),
    removeItem: (k) => void itens.delete(k),
  };
}

const abaQuebrada: ArmazenamentoDaAba = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('cheio');
  },
  removeItem: () => {
    throw new Error('bloqueado');
  },
};

const doBanco: RascunhoDeExercicio = rascunhoDoExercicio(catalogo[0]);

/** O mesmo conteúdo, com as chaves em outra ordem, como o `jsonb` devolve. */
function embaralhado(r: RascunhoDeExercicio): RascunhoDeExercicio {
  return Object.fromEntries(Object.entries(r).reverse()) as unknown as RascunhoDeExercicio;
}

const editado = () => ({ ...formularioDe(doBanco), titulo: 'Título que o professor mudou' });

describe('guardar e ler', () => {
  it('o texto guardado volta igual, por exercício e por conta', () => {
    const aba = abaDeMentira();
    guardarNaAba(aba, 'prof-1', 'ex-1', { formulario: editado(), base: baseDe(doBanco) });

    expect(lerDaAba(aba, 'prof-1', 'ex-1')).toEqual({ formulario: editado(), base: baseDe(doBanco) });
    expect(lerDaAba(aba, 'prof-1', 'ex-2')).toBeNull();
    expect(lerDaAba(aba, 'prof-1', null)).toBeNull();
    // Outra conta na mesma aba não abre o texto de quem saiu.
    expect(lerDaAba(aba, 'prof-2', 'ex-1')).toBeNull();
  });

  it('o novo tem chave própria, que não se confunde com um id', () => {
    expect(chaveDoRascunho('prof-1', null)).not.toBe(chaveDoRascunho('prof-1', 'ex-1'));
  });

  it('o que não tem a forma do formulário é descartado', () => {
    const aba = abaDeMentira();
    const chave = chaveDoRascunho('prof-1', 'ex-1');
    for (const lixo of [
      'não é json',
      JSON.stringify({ formulario: { titulo: 'só isso' }, base: null }),
      JSON.stringify({ formulario: { ...formularioVazio(), dicas: ['a'] }, base: null }),
      JSON.stringify({ formulario: { ...formularioVazio(), casos: [{ descricao: 1 }] }, base: null }),
      JSON.stringify({ formulario: formularioVazio(), base: 7 }),
    ]) {
      aba.setItem(chave, lixo);
      expect(lerDaAba(aba, 'prof-1', 'ex-1')).toBeNull();
    }
  });

  it('esquecer apaga só o daquele exercício', () => {
    const aba = abaDeMentira();
    guardarNaAba(aba, 'prof-1', 'ex-1', { formulario: editado(), base: null });
    guardarNaAba(aba, 'prof-1', null, { formulario: editado(), base: null });
    esquecerDaAba(aba, 'prof-1', 'ex-1');

    expect(lerDaAba(aba, 'prof-1', 'ex-1')).toBeNull();
    expect(lerDaAba(aba, 'prof-1', null)).not.toBeNull();
  });

  it('o editor aberto volta depois do recarregamento, e some ao fechar', () => {
    const aba = abaDeMentira();
    expect(lerAberto(aba, 'prof-1')).toBeUndefined();
    guardarAberto(aba, 'prof-1', null);
    expect(lerAberto(aba, 'prof-1')).toBeNull();
    guardarAberto(aba, 'prof-1', 'ex-1');
    expect(lerAberto(aba, 'prof-1')).toBe('ex-1');
    esquecerAberto(aba, 'prof-1');
    expect(lerAberto(aba, 'prof-1')).toBeUndefined();
  });

  it('sem armazenamento, nada quebra', () => {
    for (const aba of [null, abaQuebrada]) {
      expect(() => guardarNaAba(aba, 'p', 'e', { formulario: editado(), base: null })).not.toThrow();
      expect(lerDaAba(aba, 'p', 'e')).toBeNull();
      expect(() => esquecerDaAba(aba, 'p', 'e')).not.toThrow();
      expect(() => guardarAberto(aba, 'p', 'e')).not.toThrow();
      expect(lerAberto(aba, 'p')).toBeUndefined();
      expect(() => esquecerAberto(aba, 'p')).not.toThrow();
    }
  });
});

describe('restaurar ou perguntar', () => {
  it('sem texto guardado, ou com o mesmo texto do banco, não há o que fazer', () => {
    expect(decidirRestauracao(null, doBanco, false)).toBe('nada');
    expect(
      decidirRestauracao({ formulario: formularioDe(doBanco), base: baseDe(doBanco) }, doBanco, false)
    ).toBe('nada');
  });

  it('o texto escrito sobre a versão que o banco ainda tem é restaurado', () => {
    const guardado = { formulario: editado(), base: baseDe(doBanco) };
    expect(decidirRestauracao(guardado, doBanco, false)).toBe('restaurar');
  });

  it('a ordem das chaves do jsonb não conta como versão nova', () => {
    const guardado = { formulario: editado(), base: baseDe(doBanco) };
    expect(decidirRestauracao(guardado, embaralhado(doBanco), false)).toBe('restaurar');
  });

  it('o banco mudou depois que o texto foi escrito: pergunta, e não cobre o mais novo', () => {
    const guardado = { formulario: editado(), base: baseDe(doBanco) };
    const maisNovo = { ...doBanco, enunciado: 'Outra aba salvou isto depois.' };
    expect(decidirRestauracao(guardado, maisNovo, false)).toBe('conflito');
  });

  it('o novo aberto vazio restaura o que ficou nele', () => {
    const guardado = { formulario: editado(), base: null };
    expect(decidirRestauracao(guardado, null, true)).toBe('restaurar');
  });

  it('o novo criado a partir de um publicado não recebe por cima o texto de outro novo', () => {
    const guardado = { formulario: editado(), base: null };
    const outro = rascunhoDoExercicio(catalogo[1]);
    expect(decidirRestauracao(guardado, outro, true)).toBe('conflito');
  });

  it('depois de salvar, a base é o que foi salvo, e o texto seguinte restaura contra ela', () => {
    // O "Salvar" grava o formulário convertido; a base é a desse conteúdo.
    const salvo = rascunhoDoFormulario(editado()).rascunho as RascunhoDeExercicio;
    const depois = { ...formularioDe(salvo), enunciado: 'Continuei escrevendo.' };
    const guardado = { formulario: depois, base: baseDe(salvo) };
    expect(decidirRestauracao(guardado, embaralhado(salvo), false)).toBe('restaurar');
  });
});
