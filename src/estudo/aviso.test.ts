import { describe, expect, it } from 'vitest';
import { AVISO, CONTATO_DO_ESTUDO, VERSAO_DO_AVISO, textoDoAviso } from './aviso';

/**
 * O aviso da entrada no estudo (D37).
 *
 * A versão aceita vai para o banco com a entrada. Ela só serve se cada versão
 * tiver um texto só: o teste guarda a impressão do texto de cada versão, e
 * falha se o texto mudar sem que a versão mude. Mudou o texto, suba
 * VERSAO_DO_AVISO e acrescente a impressão nova aqui — sem apagar as antigas,
 * que são as das pessoas que já consentiram.
 */

const IMPRESSOES: Record<number, string> = {
  1: 'abb5fc58',
  2: 'e804e274',
  3: 'be4ac000',
};

/** FNV-1a de 32 bits: basta para notar uma mudança, e não depende de nada. */
function impressao(texto: string): string {
  let h = 0x811c9dc5;
  for (const unidade of new TextEncoder().encode(texto)) {
    h ^= unidade;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

describe('o aviso do estudo', () => {
  it('o texto desta versão é o mesmo de quando ela foi registrada', () => {
    expect(impressao(textoDoAviso()), 'mudou o texto do aviso: suba a versão').toBe(
      IMPRESSOES[VERSAO_DO_AVISO]
    );
  });

  it('diz o que o pesquisador pediu que dissesse', () => {
    const texto = AVISO.paragrafos.join(' ');
    expect(texto).toMatch(/anônimo/);
    expect(texto).toMatch(/código que você escrever/);
    expect(texto).toMatch(/Só os pesquisadores têm acesso aos dados/);
    expect(texto).toMatch(/apenas de forma agregada, no TCC e em possíveis publicações/);
    expect(texto).toMatch(/fechar a página antes do fim, o que já foi feito até ali fica salvo/);
    expect(texto).toMatch(/não há como identificar e excluir os dados de uma pessoa/);
  });

  it('termina com o contato para dúvidas', () => {
    expect(AVISO.paragrafos.at(-1)).toBe(`Dúvidas sobre o estudo: ${CONTATO_DO_ESTUDO}.`);
    expect(CONTATO_DO_ESTUDO).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });

  it('cita os tempos do percurso', () => {
    const texto = AVISO.paragrafos.join(' ');
    expect(texto).toMatch(/10 minutos no aquecimento/);
    expect(texto).toMatch(/8 minutos nos demais/);
  });

  it('a caixa diz "Concordo em participar"', () => {
    expect(AVISO.concordo).toBe('Concordo em participar');
  });
});
