import { describe, expect, it } from 'vitest';
import { vetorDobrar } from '../exercicios/vetor-dobrar';
import { publicacaoLiberada, verificacaoValeParaOAtual } from './liberacoes-da-autoria';
import type {
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from '../nucleo/verificacao-do-exercicio';

/**
 * A trava da publicação (D31, D33). Desde D33 quem publica é o autor, com a
 * verificação que ele acabou de fazer: ela precisa ser do que está no
 * formulário agora, e o relatório gravado no banco nem entra na assinatura.
 */

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

describe('a publicação pelo autor', () => {
  const verificado = JSON.stringify(RASCUNHO);
  const derivado = { linhaDoDefeito: 4, linhasAceitas: [4] };

  it('é liberada pela verificação aprovada do que está no formulário, com a linha derivada', () => {
    expect(publicacaoLiberada(relatorio(true), verificado, RASCUNHO)).toEqual(derivado);
  });

  it('não é liberada pela verificação recusada', () => {
    expect(publicacaoLiberada(relatorio(false), verificado, RASCUNHO)).toBeUndefined();
  });

  it('volta a travar quando o formulário muda depois de verificar', () => {
    const editado = { ...RASCUNHO, enunciado: RASCUNHO.enunciado + ' ' };
    expect(verificacaoValeParaOAtual(relatorio(true), verificado, editado)).toBe(false);
    expect(publicacaoLiberada(relatorio(true), verificado, editado)).toBeUndefined();
  });

  it('não é liberada sem verificação, nem com o formulário inválido', () => {
    expect(publicacaoLiberada(null, null, RASCUNHO)).toBeUndefined();
    expect(publicacaoLiberada(relatorio(true), verificado, null)).toBeUndefined();
  });

  it('não é liberada sem a linha do defeito, que o aluno precisa', () => {
    expect(publicacaoLiberada(relatorio(true, false), verificado, RASCUNHO)).toBeUndefined();
  });
});
