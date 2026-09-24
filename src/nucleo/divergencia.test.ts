import { describe, expect, it } from 'vitest';
import { analisarDivergencia } from './divergencia';

/**
 * A regra do defeito único (D30), verificada por execução.
 *
 * Um defeito só, coeso e localizável numa linha que se possa apontar: uma
 * linha alterada, ou uma linha fora do lugar. O resto é recusado, e a recusa
 * precisa dizer por quê.
 */

const programa = (...linhas: string[]) => linhas.join('\n');

const BASE = [
  'var x = 0;',
  'var y = 1;',
  'x = x + 1;',
  'y = y + x;',
  'var z = x + y;',
];

describe('aceitas', () => {
  it('uma linha alterada', () => {
    const comDefeito = [...BASE];
    comDefeito[2] = 'x = x - 1;';
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito))).toEqual({
      tipo: 'linha-alterada',
      linha: 3,
      linhasAceitas: [3],
    });
  });

  it('a troca entre duas vizinhas, com as duas linhas aceitas', () => {
    // É o caso de lista-inserir-depois: mover qualquer uma das duas produz a
    // mesma troca, e apontar a segunda também é achar o defeito.
    const comDefeito = [BASE[0], BASE[1], BASE[3], BASE[2], BASE[4]];
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito))).toEqual({
      tipo: 'linha-fora-do-lugar',
      linha: 3,
      linhasAceitas: [3, 4],
    });
  });

  it('uma linha que desceu duas posições: só ela é aceita', () => {
    // As linhas que ela pulou continuam certas; apontá-las não é achar nada.
    const comDefeito = [BASE[0], BASE[2], BASE[3], BASE[1], BASE[4]];
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito))).toEqual({
      tipo: 'linha-fora-do-lugar',
      linha: 4,
      linhasAceitas: [4],
    });
  });

  it('diferença só de recuo não conta', () => {
    const comDefeito = [...BASE];
    comDefeito[0] = '    var x = 0;';
    comDefeito[2] = 'x = x - 1;';
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito))).toMatchObject({
      tipo: 'linha-alterada',
      linha: 3,
    });
  });
});

describe('recusadas, com a razão', () => {
  it('versões iguais', () => {
    expect(analisarDivergencia(programa(...BASE), programa(...BASE))).toMatchObject({
      tipo: 'recusada',
      motivo: expect.stringMatching(/iguais/),
    });
  });

  it('tamanhos diferentes, que é o caso da instrução que falta', () => {
    const comDefeito = [BASE[0], BASE[1], BASE[3], BASE[4]];
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito))).toMatchObject({
      tipo: 'recusada',
      motivo: expect.stringMatching(/tamanhos diferentes \(5 e 4 linhas\)/),
    });
  });

  it('duas alterações em lugares diferentes', () => {
    const comDefeito = [...BASE];
    comDefeito[1] = 'var y = 2;';
    comDefeito[4] = 'var z = x - y;';
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito))).toEqual({
      tipo: 'recusada',
      motivo: expect.stringMatching(/as linhas 2 e 5.*mais de um defeito/),
      linhas: [2, 5],
    });
  });

  it('uma troca e uma alteração juntas', () => {
    const comDefeito = [BASE[0], BASE[1], BASE[3], 'x = x - 1;', BASE[4]];
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito)).tipo).toBe('recusada');
  });

  it('duas trocas ao mesmo tempo', () => {
    const comDefeito = [BASE[1], BASE[0], BASE[3], BASE[2], BASE[4]];
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito)).tipo).toBe('recusada');
  });

  it('a linha que difere está em branco', () => {
    const comDefeito = [...BASE];
    comDefeito[2] = '';
    expect(analisarDivergencia(programa(...BASE), programa(...comDefeito))).toMatchObject({
      tipo: 'recusada',
      motivo: expect.stringMatching(/linha 3 está em branco/),
    });
  });
});
