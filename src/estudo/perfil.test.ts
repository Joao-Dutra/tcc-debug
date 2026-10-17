import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERGUNTAS_DO_PERFIL } from './perfil';

/**
 * O perfil e o banco aceitam os mesmos valores (D37).
 *
 * Um valor que só existisse aqui faria a entrada no estudo ser recusada pelo
 * `check` do banco na hora da aula, com a turma sentada. A migração é lida
 * como texto: é ela que vai para o projeto, e não uma cópia da lista.
 */

const migracao = readFileSync(
  new URL('../../supabase/migracoes/0004_area_do_estudo.sql', import.meta.url),
  'utf8'
);

/** Os valores do `check (<coluna> in (...))` da coluna, na ordem. */
function valoresDoBanco(coluna: string): string[] {
  const achado = new RegExp(`check \\(${coluna} in \\(([^)]*)\\)\\)`).exec(migracao);
  if (!achado) throw new Error(`a migração não tem o check de ${coluna}`);
  return [...achado[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const COLUNAS = { aeds1: 'aeds1', depurador: 'depurador', usouVisualizacao: 'usou_visualizacao' } as const;

describe('o perfil do participante', () => {
  for (const pergunta of PERGUNTAS_DO_PERFIL) {
    it(`${pergunta.campo}: as opções são os valores que o banco aceita`, () => {
      expect(pergunta.opcoes.map((o) => o.valor)).toEqual(valoresDoBanco(COLUNAS[pergunta.campo]));
    });
  }
});
