import { beforeAll, describe, expect, it } from 'vitest';
import { vetorOrdenar } from '../exercicios/vetor-ordenar';
import { conferirRelatorioGravado, relatorioGravadoValido } from './relatorio-gravado';
import { verificarExercicio } from './verificacao-do-exercicio';
import { abrirWorker } from './worker-em-teste';
import type {
  Executor,
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from './verificacao-do-exercicio';

/**
 * O relatório gravado pelo professor, conferido na revisão (D31).
 *
 * Os relatórios aqui são produzidos pela verificação de verdade e passam por
 * JSON, como passam pela coluna jsonb: o que se confere é o que o banco
 * devolveria. O cenário que importa é o do relatório forjado — gravado como
 * aprovado para um exercício que, refeito, não passa.
 */

const RASCUNHO: RascunhoDeExercicio = {
  titulo: vetorOrdenar.titulo,
  enunciado: vetorOrdenar.enunciado,
  estrutura: vetorOrdenar.estrutura,
  dificuldade: vetorOrdenar.dificuldade,
  categoriaDefeito: vetorOrdenar.categoriaDefeito,
  codigoCorreto: vetorOrdenar.codigoCorreto,
  codigoComDefeito: vetorOrdenar.codigoComDefeito,
  casosDeTeste: vetorOrdenar.casosDeTeste,
  dicas: vetorOrdenar.dicas,
  marcadores: ['j', 'ultimo'],
  variaveisDeValor: ['temp'],
};

let aprovado: RelatorioDaVerificacao;
let recusado: RelatorioDaVerificacao;

/** Como o banco devolveria o relatório gravado. */
const peloBanco = (r: RelatorioDaVerificacao): unknown => JSON.parse(JSON.stringify(r));

beforeAll(async () => {
  const rodar = await abrirWorker();
  const executar: Executor = (exercicio, codigo) =>
    Promise.resolve(
      rodar({
        codigo,
        variaveisObservadas: exercicio.variaveisObservadas,
        marcadores: exercicio.marcadores,
        casos: exercicio.casosDeTeste,
      })
    );
  aprovado = await verificarExercicio(RASCUNHO, executar);
  // O defeito desfeito: as duas versões iguais, e a verificação recusa.
  recusado = await verificarExercicio(
    { ...RASCUNHO, codigoComDefeito: RASCUNHO.codigoCorreto },
    executar
  );
});

describe('leitura do relatório gravado', () => {
  it('lê de volta o relatório que a verificação produziu', () => {
    expect(aprovado.aprovado).toBe(true);
    expect(relatorioGravadoValido(peloBanco(aprovado))).toEqual(aprovado);
  });

  it.each([
    ['um texto', 'aprovado'],
    ['uma lista', [1, 2]],
    ['sem veredito', { itens: [], avisos: [], avisosDeEstilo: [] }],
  ])('recusa %s', (_, valor) => {
    expect(relatorioGravadoValido(valor)).toBeNull();
  });

  it('recusa inteiro o relatório com um item malformado', () => {
    const r = peloBanco(aprovado) as { itens: Record<string, unknown>[] };
    r.itens[2] = { ...r.itens[2], chave: 'item-inventado' };
    expect(relatorioGravadoValido(r)).toBeNull();
  });

  it('recusa a linha do defeito que não é número inteiro', () => {
    const r = peloBanco(aprovado) as { derivado: Record<string, unknown> };
    r.derivado.linhaDoDefeito = '12';
    expect(relatorioGravadoValido(r)).toBeNull();
  });
});

describe('conferência com a verificação refeita', () => {
  it('confere quando o gravado diz o mesmo que o refeito', () => {
    expect(conferirRelatorioGravado(peloBanco(aprovado), aprovado).tipo).toBe('confere');
  });

  it('sinaliza o relatório forjado: aprovado no gravado, recusado refeito', () => {
    const conferencia = conferirRelatorioGravado(peloBanco(aprovado), recusado);
    expect(conferencia.tipo).toBe('diverge');
    if (conferencia.tipo !== 'diverge') return;
    expect(conferencia.diferencas[0]).toMatch(/gravado diz que o exercício passou.*não passou/);
    expect(conferencia.diferencas.some((d) => d.startsWith('“O defeito é um só'))).toBe(true);
    expect(conferencia.diferencas.some((d) => d.startsWith('Linha do defeito'))).toBe(true);
  });

  it('sinaliza a linha do defeito diferente, mesmo com todos os itens iguais', () => {
    const r = peloBanco(aprovado) as { derivado: { linhaDoDefeito: number; linhasAceitas: number[] } };
    r.derivado = { linhaDoDefeito: 3, linhasAceitas: [3] };
    const conferencia = conferirRelatorioGravado(r, aprovado);
    expect(conferencia).toMatchObject({
      tipo: 'diverge',
      diferencas: ['Linha do defeito: o gravado diz linha 3; refeito aqui, linha 12.'],
    });
  });

  it('sinaliza o item que falta no gravado', () => {
    const r = peloBanco(aprovado) as { itens: { chave: string }[] };
    r.itens = r.itens.filter((i) => i.chave !== 'quadro-denuncia');
    const conferencia = conferirRelatorioGravado(r, aprovado);
    expect(conferencia.tipo).toBe('diverge');
    if (conferencia.tipo !== 'diverge') return;
    expect(conferencia.diferencas).toEqual(['O gravado não tem o item “O defeito aparece no desenho?”.']);
  });

  it('sinaliza os avisos de estilo apagados do gravado', () => {
    const comAviso: RelatorioDaVerificacao = {
      ...aprovado,
      avisosDeEstilo: [
        { versao: 'correta', aviso: { linha: 1, construcao: 'let', sugestao: 'use var' } },
      ],
    };
    const conferencia = conferirRelatorioGravado(peloBanco(aprovado), comAviso);
    expect(conferencia).toMatchObject({
      tipo: 'diverge',
      diferencas: ['Avisos de estilo: 0 no gravado, 1 refeito aqui.'],
    });
  });

  it('não sinaliza explicações diferentes, que mudam de um navegador para outro', () => {
    const r = peloBanco(aprovado) as { itens: { explicacao: string }[] };
    r.itens = r.itens.map((i) => ({ ...i, explicacao: 'escrito por outro motor' }));
    expect(conferirRelatorioGravado(r, aprovado).tipo).toBe('confere');
  });

  it('distingue o relatório ausente do ilegível', () => {
    expect(conferirRelatorioGravado(null, aprovado).tipo).toBe('ausente');
    expect(conferirRelatorioGravado(undefined, aprovado).tipo).toBe('ausente');
    expect(conferirRelatorioGravado({ aprovado: true }, aprovado).tipo).toBe('ilegivel');
  });
});
