import { beforeAll, describe, expect, it } from 'vitest';
import { verificarExercicio } from '../nucleo/verificacao-do-exercicio';
import { abrirWorker } from '../nucleo/worker-em-teste';
import {
  CAMPOS_COM_EXEMPLO,
  campoVazio,
  exercicioDeExemplo,
  inserirExemplo,
  textoDoExemplo,
} from './exemplos-do-formulario';
import { ESTRUTURAS, formularioVazio, rascunhoDoFormulario } from './formulario-do-exercicio';
import type { FormularioDoExercicio } from './formulario-do-exercicio';
import type { Executor } from '../nucleo/verificacao-do-exercicio';
import type { SecaoEspecial, TipoEstrutura } from '../nucleo/tipos';

/**
 * Os exemplos do formulário do professor (D35).
 *
 * A regra que sustenta o botão: os exemplos de uma estrutura são coerentes
 * entre si. Preencher o formulário inteiro com eles, campo a campo, pelo mesmo
 * caminho que o botão usa, produz um exercício que a verificação aprova.
 */

let executar: Executor;
beforeAll(async () => {
  const rodar = await abrirWorker();
  executar = (exercicio, codigo) =>
    Promise.resolve(
      rodar({
        codigo,
        variaveisObservadas: exercicio.variaveisObservadas,
        marcadores: exercicio.marcadores,
        casos: exercicio.casosDeTeste,
      })
    );
});

const ESCOLHAS: [string, TipoEstrutura, SecaoEspecial | null][] = [
  ...ESTRUTURAS.map((e): [string, TipoEstrutura, null] => [e.rotulo, e.valor, null]),
  ['Vetor, agrupado em ordenação', 'vetor', 'ordenacao'],
];

function preenchidoComExemplos(estrutura: TipoEstrutura, agrupamento: SecaoEspecial | null) {
  let formulario: FormularioDoExercicio = { ...formularioVazio(), estrutura, agrupamento };
  for (const campo of CAMPOS_COM_EXEMPLO) formulario = inserirExemplo(formulario, campo);
  return formulario;
}

describe('o formulário inteiro preenchido com os exemplos', () => {
  it.each(ESCOLHAS)('%s passa na verificação', async (_, estrutura, agrupamento) => {
    const conversao = rascunhoDoFormulario(preenchidoComExemplos(estrutura, agrupamento));
    expect(conversao.erros).toEqual([]);
    const relatorio = await verificarExercicio(conversao.rascunho!, executar);
    const recusas = relatorio.itens.filter((i) => !i.aprovado).map((i) => i.explicacao);
    expect(recusas).toEqual([]);
    expect(relatorio.aprovado).toBe(true);
    expect(relatorio.avisosDeEstilo).toEqual([]);
  });

  it('o agrupamento da ordenação chega ao rascunho, e a estrutura continua vetor', () => {
    const { rascunho } = rascunhoDoFormulario(preenchidoComExemplos('vetor', 'ordenacao'));
    expect(rascunho?.estrutura).toBe('vetor');
    expect(rascunho?.secao).toBe('ordenacao');
    // Os marcadores e a temporária da troca vêm junto do exemplo.
    expect(rascunho?.marcadores.length).toBeGreaterThan(0);
    expect(rascunho?.variaveisDeValor).toContain('temp');
  });

  it('fora do vetor, o agrupamento não vale', () => {
    const { rascunho } = rascunhoDoFormulario({ ...preenchidoComExemplos('pilha', null), agrupamento: 'ordenacao' });
    expect(rascunho?.secao).toBeUndefined();
  });
});

describe('o exemplo nunca sobrescreve o que o professor escreveu', () => {
  it.each(CAMPOS_COM_EXEMPLO)('%s com conteúdo fica como está', (campo) => {
    // Qualquer conteúdo diferente do exemplo serve: o formulário de outra estrutura.
    const doProfessor: FormularioDoExercicio = {
      ...preenchidoComExemplos('pilha', null),
      marcadores: 'meu',
      variaveisDeValor: 'minha',
      estrutura: 'fila',
    };
    expect(campoVazio(doProfessor, campo)).toBe(false);
    expect(inserirExemplo(doProfessor, campo)).toBe(doProfessor);
  });

  it('uma dica escrita basta para as dicas não receberem exemplo', () => {
    const formulario: FormularioDoExercicio = { ...formularioVazio(), dicas: ['minha', '', ''] };
    expect(inserirExemplo(formulario, 'dicas').dicas).toEqual(['minha', '', '']);
  });

  it('um caso escrito basta para os casos não receberem exemplo', () => {
    const formulario: FormularioDoExercicio = {
      ...formularioVazio(),
      casos: [{ descricao: 'meu caso', expressao: '', esperado: '' }],
    };
    expect(inserirExemplo(formulario, 'casos').casos).toHaveLength(1);
  });
});

describe('a estrutura escolhida decide os exemplos', () => {
  it('cada estrutura, e a ordenação, têm um exercício de exemplo próprio, da estrutura certa', () => {
    const ids = ESCOLHAS.map(([, estrutura, agrupamento]) => {
      const exemplo = exercicioDeExemplo(estrutura, agrupamento);
      expect(exemplo.estrutura).toBe(estrutura);
      if (agrupamento) expect(exemplo.secao).toBe(agrupamento);
      return exemplo.id;
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('trocar a estrutura troca o texto do exemplo', () => {
    const vetor = textoDoExemplo({ ...formularioVazio(), estrutura: 'vetor' }, 'codigoCorreto');
    const pilha = textoDoExemplo({ ...formularioVazio(), estrutura: 'pilha' }, 'codigoCorreto');
    expect(vetor).not.toBe(pilha);
    expect(pilha).toMatch(/\btopo\b/);
  });
});
