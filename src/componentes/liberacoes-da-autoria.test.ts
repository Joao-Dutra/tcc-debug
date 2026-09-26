import { describe, expect, it } from 'vitest';
import { vetorDobrar } from '../exercicios/vetor-dobrar';
import {
  envioLiberado,
  publicacaoLiberada,
  verificacaoValeParaOAtual,
} from './liberacoes-da-autoria';
import type {
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from '../nucleo/verificacao-do-exercicio';

/** As travas do envio e da publicação (D31). */

const RASCUNHO: RascunhoDeExercicio = {
  titulo: vetorDobrar.titulo,
  enunciado: vetorDobrar.enunciado,
  estrutura: vetorDobrar.estrutura,
  dificuldade: vetorDobrar.dificuldade,
  categoriaDefeito: vetorDobrar.categoriaDefeito,
  codigoCorreto: vetorDobrar.codigoCorreto,
  codigoComDefeito: vetorDobrar.codigoComDefeito,
  casosDeTeste: vetorDobrar.casosDeTeste,
  dicas: vetorDobrar.dicas,
  marcadores: ['i'],
  variaveisDeValor: [],
};

const relatorio = (aprovado: boolean, comDerivado = true): RelatorioDaVerificacao => ({
  aprovado,
  itens: [],
  avisos: [],
  avisosDeEstilo: [],
  ...(comDerivado ? { derivado: { linhaDoDefeito: 4, linhasAceitas: [4] } } : {}),
});

describe('o envio para a revisão', () => {
  const verificado = JSON.stringify(RASCUNHO);

  it('é liberado pela verificação aprovada do que está no formulário', () => {
    expect(envioLiberado(relatorio(true), verificado, RASCUNHO)).toBe(true);
  });

  it('não é liberado pela verificação recusada', () => {
    expect(envioLiberado(relatorio(false), verificado, RASCUNHO)).toBe(false);
  });

  it('volta a travar quando o formulário muda depois de verificar', () => {
    const editado = { ...RASCUNHO, enunciado: RASCUNHO.enunciado + ' ' };
    expect(verificacaoValeParaOAtual(relatorio(true), verificado, editado)).toBe(false);
    expect(envioLiberado(relatorio(true), verificado, editado)).toBe(false);
  });

  it('não é liberado sem verificação, nem com o formulário inválido', () => {
    expect(envioLiberado(null, null, RASCUNHO)).toBe(false);
    expect(envioLiberado(relatorio(true), verificado, null)).toBe(false);
  });
});

describe('a publicação', () => {
  it('é liberada pela verificação refeita aprovada, com a linha que ela derivou', () => {
    expect(publicacaoLiberada(relatorio(true))).toEqual({ linhaDoDefeito: 4, linhasAceitas: [4] });
  });

  it('não é liberada pela refeita recusada, qualquer que seja o relatório gravado', () => {
    // O gravado nem entra na assinatura: um aprovado forjado não tem por onde passar.
    expect(publicacaoLiberada(relatorio(false))).toBeUndefined();
  });

  it('não é liberada enquanto a refeita não terminou', () => {
    expect(publicacaoLiberada(null)).toBeUndefined();
  });

  it('não é liberada sem a linha do defeito, que o aluno precisa', () => {
    expect(publicacaoLiberada(relatorio(true, false))).toBeUndefined();
  });
});
