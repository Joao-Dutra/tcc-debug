import { beforeAll, describe, expect, it } from 'vitest';
import { catalogo } from './catalogo';
import {
  compararVersoes,
  estadoDoQuadro,
  estadosAntesDaDivergencia,
} from '../nucleo/quadro-denuncia';
import { abrirWorker } from '../nucleo/worker-em-teste';
import type { RodarNoWorker } from '../nucleo/worker-em-teste';
import type { Exercicio, Instantaneo } from '../nucleo/tipos';

/**
 * Quadro-denúncia verificado por execução (D16, skill criar-exercicio).
 *
 * Roda cada exercício do catálogo com e sem o defeito, pelo mesmo Worker do
 * navegador, e aplica a regra que mora em `src/nucleo/quadro-denuncia.ts` — a
 * mesma que a submissão de um exercício de professor enfrenta. O teste só
 * executa; quem julga é o núcleo.
 */

/**
 * Reprovados numa auditoria e ainda não corrigidos. Cada um precisa continuar
 * reprovado: quando for corrigido, o teste falha e pede que saia daqui. Assim
 * a pendência não some em silêncio. Vazia desde a correção da pilha (D16).
 */
const PENDENTES = new Set<string>();

let rodar: RodarNoWorker;
beforeAll(async () => {
  rodar = await abrirWorker();
});

function instantaneos(exercicio: Exercicio, codigo: string): Instantaneo[] {
  return rodar({
    codigo,
    variaveisObservadas: exercicio.variaveisObservadas,
    marcadores: exercicio.marcadores,
    casos: exercicio.casosDeTeste,
  }).instantaneos;
}

const versoes = (exercicio: Exercicio) =>
  [
    exercicio.variaveisObservadas,
    instantaneos(exercicio, exercicio.codigoComDefeito),
    instantaneos(exercicio, exercicio.codigoCorreto),
  ] as const;

describe.each(catalogo)('$id', (exercicio) => {
  if (PENDENTES.has(exercicio.id)) {
    it('continua reprovado, pendente de correção (D16)', () => {
      expect(compararVersoes(...versoes(exercicio)).aprovada).toBe(false);
    });
  } else {
    it('diverge da versão correta em estado observável', () => {
      const r = compararVersoes(...versoes(exercicio));
      expect(r.trajetoriasIdenticas, 'trajetórias de estados idênticas').toBe(false);
      expect(r.quadrosDivergentes, 'quadros divergentes').toBeGreaterThan(1);
      expect(r.aprovada).toBe(true);
    });
  }

  // A miniatura da lista de exercícios (D20) é verificada do mesmo jeito que
  // o quadro-denúncia: por execução. O estado escrito no exercício precisa ser
  // um que as duas versões atravessam antes de divergirem — senão o cartão
  // entrega o defeito antes de o estudante abrir o exercício. Também pega o
  // estado inventado à mão, que nenhuma execução produz.
  if (exercicio.miniatura) {
    const miniatura = exercicio.miniatura;
    it('desenha na miniatura um estado anterior à divergência', () => {
      const alvo = estadoDoQuadro(exercicio.variaveisObservadas, miniatura);
      expect(estadosAntesDaDivergencia(...versoes(exercicio)), 'estados antes da divergência')
        .toContain(alvo);
    });
  }
});
