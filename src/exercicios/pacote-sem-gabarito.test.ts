import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import type { Rollup } from 'vite';
import { catalogo } from './catalogo';
import { EXERCICIOS_DE_EXEMPLO } from './exemplos-publicos';
import { aparecemNoPacote, exercicioDoCaminho, tirarCodigoCorreto } from './sem-gabarito';
import { ETAPAS } from '../estudo/percurso';

/**
 * O código correto fora do navegador (D41).
 *
 * O primeiro bloco cobra a regra do plugin, sem build. O segundo faz o build
 * de produção de verdade, com o `vite.config.ts` do projeto, e procura no
 * pacote final o código correto de cada exercício — que é o que um aluno com
 * as ferramentas de desenvolvedor abertas acharia.
 */

const NO_PERCURSO = new Set(ETAPAS.map((e) => e.exercicioId));

describe('a regra', () => {
  it('os exemplos públicos estão no catálogo e nenhum está no percurso do estudo', () => {
    const ids = new Set(catalogo.map((e) => e.id));
    for (const id of EXERCICIOS_DE_EXEMPLO) {
      expect(ids, id).toContain(id);
      expect(NO_PERCURSO.has(id), `${id} está no percurso`).toBe(false);
    }
  });

  it('todo exercício do catálogo é reconhecido pelo caminho, e o catálogo não', () => {
    for (const e of catalogo) {
      expect(exercicioDoCaminho(`C:\\depurar\\src\\exercicios\\${e.id}.ts`)).toBe(e.id);
      expect(exercicioDoCaminho(`/depurar/src/exercicios/${e.id}.ts?import`)).toBe(e.id);
    }
    expect(exercicioDoCaminho('/depurar/src/exercicios/catalogo.ts')).toBeNull();
    expect(exercicioDoCaminho('/depurar/src/exercicios/quadro-denuncia.test.ts')).toBeNull();
    expect(exercicioDoCaminho('/depurar/src/componentes/exemplos-do-formulario.ts')).toBeNull();
  });

  it('tira o código correto e deixa o resto, menos nos exemplos públicos', () => {
    const fonte = "export const x = {\n  codigoComDefeito: `a\nb`,\n  codigoCorreto: `a\nc`,\n  dicas: [],\n};";
    const tirada = tirarCodigoCorreto(fonte, 'pilha-desempilhar', EXERCICIOS_DE_EXEMPLO);
    expect(tirada.retirado).toBe('a\nc');
    expect(tirada.fonte).toBe("export const x = {\n  codigoComDefeito: `a\nb`,\n  codigoCorreto: '',\n  dicas: [],\n};");
    expect(tirarCodigoCorreto(fonte, 'pilha-reverter', EXERCICIOS_DE_EXEMPLO)).toEqual({ fonte, retirado: null });
  });

  it('para o build quando não reconhece a forma, em vez de deixar passar', () => {
    const duas = 'codigoCorreto: `a`, codigoCorreto: `b`';
    expect(() => tirarCodigoCorreto(duas, 'x', [])).toThrow(/achei 2/);
    expect(() => tirarCodigoCorreto("codigoCorreto: 'a'", 'x', [])).toThrow(/achei 0/);
    expect(tirarCodigoCorreto('sem nada', 'x', [])).toEqual({ fonte: 'sem nada', retirado: null });
  });
});

describe('o pacote de produção', () => {
  let pacote = '';

  beforeAll(async () => {
    const raiz = fileURLToPath(new URL('../..', import.meta.url));
    const saida = (await build({
      root: raiz,
      configFile: `${raiz}vite.config.ts`,
      mode: 'production',
      logLevel: 'silent',
      build: { write: false },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    const saidas = Array.isArray(saida) ? saida : [saida];
    pacote = saidas
      .flatMap((s) => s.output)
      .map((parte) => (parte.type === 'chunk' ? parte.code : String(parte.source)))
      .join('\n');
  }, 120_000);

  it('não tem o código correto de nenhum exercício fora dos exemplos — os do percurso inclusive', () => {
    const fora = catalogo.filter((e) => !(EXERCICIOS_DE_EXEMPLO as readonly string[]).includes(e.id));
    expect(fora.length).toBe(catalogo.length - EXERCICIOS_DE_EXEMPLO.length);
    for (const id of NO_PERCURSO) expect(fora.map((e) => e.id)).toContain(id);
    for (const e of fora) {
      expect(aparecemNoPacote(pacote, e.codigoCorreto), `código correto de ${e.id} no pacote`).toBe(false);
      // Controle: a busca acha o que está lá. Sem isto, uma busca que nunca
      // acha nada passaria do mesmo jeito.
      expect(aparecemNoPacote(pacote, e.codigoComDefeito), `código com defeito de ${e.id}`).toBe(true);
    }
  });

  it('tem o código correto dos exemplos, que o formulário do professor mostra', () => {
    for (const id of EXERCICIOS_DE_EXEMPLO) {
      const e = catalogo.find((x) => x.id === id)!;
      expect(aparecemNoPacote(pacote, e.codigoCorreto), `código correto de ${id}`).toBe(true);
    }
  });
});
