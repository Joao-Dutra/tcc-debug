import { describe, expect, it } from 'vitest';
import { PASSOS_DO_TUTORIAL } from './passos-do-tutorial';

/**
 * O texto do tutorial do participante (D32).
 *
 * Que ele é o mesmo nos dois níveis de apoio, o teste de navegador cobra
 * lendo a tela. Aqui se cobra o que dá para cobrar do texto: que ele não
 * descreve nada que só um dos níveis mostra — senão quem está sem apoio
 * leria sobre o que não vê, e o tutorial viraria diferença entre as condições.
 */

/** O que só o nível com apoio mostra (D9, `andaime.ts`). */
const SO_COM_APOIO = [/dica/i, /esperado/i, /obtido/i, /rótulo/i, /nome da variável/i, /linha .*destacad/i];

describe('o texto do tutorial', () => {
  it.each(PASSOS_DO_TUTORIAL)('$titulo não descreve o que só um nível mostra', (passo) => {
    for (const proibido of SO_COM_APOIO) {
      expect(passo.texto, String(proibido)).not.toMatch(proibido);
    }
  });

  it('cobre executar, avançar os passos, ler o desenho, apontar a linha e editar', () => {
    const titulos = PASSOS_DO_TUTORIAL.map((p) => p.titulo).join(' | ');
    for (const tema of [/Executar/, /passos/, /visualização/, /Apontar/, /Editar/]) {
      expect(titulos).toMatch(tema);
    }
  });
});
