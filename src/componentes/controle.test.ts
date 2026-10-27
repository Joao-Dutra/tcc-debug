import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LIMITE_DO_CODIGO,
  REGRA_DO_CODIGO,
  TEXTOS_DOS_MOTIVOS,
  confirmacaoConfere,
  mensagemDaFalha,
  problemaDoCodigo,
  textoDoMotivo,
} from './controle';
import { RecusaDoPainel } from '../supabase/controle-do-pesquisador';

/**
 * As regras da tela do painel de controle (D38) contra as do banco (0005).
 *
 * A migração é lida como texto, como no teste do perfil: é ela que vai para o
 * projeto. Uma tela que aceitasse o código que o banco recusa, ou que
 * recebesse um motivo sem texto, só mostraria o erro na hora de usar.
 */

const migracao0004 = readFileSync(
  new URL('../../supabase/migracoes/0004_area_do_estudo.sql', import.meta.url),
  'utf8'
);
const migracao0005 = readFileSync(
  new URL('../../supabase/migracoes/0005_painel_de_controle.sql', import.meta.url),
  'utf8'
);

describe('o código da aplicação', () => {
  it('a regra é a do check da 0004 e a da função de criar da 0005', () => {
    const doCheck = /codigo ~ '([^']+)' and char_length\(codigo\) <= (\d+)/.exec(migracao0004);
    expect(doCheck, 'o check da 0004').not.toBeNull();
    expect(REGRA_DO_CODIGO.source).toBe(doCheck![1]);
    expect(LIMITE_DO_CODIGO).toBe(Number(doCheck![2]));

    const daFuncao = /p_codigo !~ '([^']+)'\s+or char_length\(p_codigo\) > (\d+)/.exec(migracao0005);
    expect(daFuncao, 'a conferência de criar_aplicacao').not.toBeNull();
    expect(REGRA_DO_CODIGO.source).toBe(daFuncao![1]);
    expect(LIMITE_DO_CODIGO).toBe(Number(daFuncao![2]));
  });

  it('aceita os códigos que já existem e recusa o resto, com motivo', () => {
    for (const bom of ['piloto-nov', 'aeds1-2026', 'a', 'x'.repeat(60)]) {
      expect(problemaDoCodigo(bom), bom).toBeNull();
    }
    for (const ruim of ['', 'Piloto', 'com espaco', '-ponta', 'ponta-', 'dois--hifens', 'ção', 'x'.repeat(61)]) {
      expect(problemaDoCodigo(ruim), ruim).not.toBeNull();
    }
  });
});

describe('a confirmação digitada', () => {
  it('é exata, como no banco: sem aparar espaço nem ignorar maiúscula', () => {
    expect(confirmacaoConfere('piloto-nov', 'piloto-nov')).toBe(true);
    expect(confirmacaoConfere('piloto-nov ', 'piloto-nov')).toBe(false);
    expect(confirmacaoConfere('Piloto-nov', 'piloto-nov')).toBe(false);
    expect(confirmacaoConfere('', 'piloto-nov')).toBe(false);
    // Alvo vazio nunca libera: o botão de um alvo sem nome não confirma nada.
    expect(confirmacaoConfere('', '')).toBe(false);
  });
});

describe('os motivos das recusas', () => {
  it('todo motivo que a 0005 devolve tem texto na tela', () => {
    const motivos = new Set([...migracao0005.matchAll(/'motivo', '([a-z-]+)'/g)].map((m) => m[1]));
    expect(motivos.size).toBeGreaterThan(5);
    for (const motivo of motivos) expect(Object.keys(TEXTOS_DOS_MOTIVOS), motivo).toContain(motivo);
  });

  it('um motivo desconhecido vira recusa genérica, e a falha comum mostra a mensagem', () => {
    expect(textoDoMotivo('inventado')).toBe('O banco recusou o pedido.');
    expect(textoDoMotivo(undefined)).toBe('O banco recusou o pedido.');
    expect(mensagemDaFalha(new RecusaDoPainel('aplicacao-protegida'))).toBe(
      TEXTOS_DOS_MOTIVOS['aplicacao-protegida']
    );
    expect(mensagemDaFalha(new Error('rede fora'))).toBe('rede fora');
  });
});
