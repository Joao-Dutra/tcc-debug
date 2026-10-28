import { describe, expect, it } from 'vitest';
import {
  TEMA_PADRAO,
  aplicarTema,
  assinarTema,
  carregarTema,
  escolherTema,
  guardarTema,
  lerTemaGuardado,
  temaDaTela,
  temaEscolhido,
  temaFixo,
} from './tema';
import type { ArmazenamentoDoTema } from './tema';

function armazenamento(inicial: Record<string, string> = {}): ArmazenamentoDoTema & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k) => dados[k] ?? null,
    setItem: (k, v) => {
      dados[k] = v;
    },
  };
}

const quebrado: ArmazenamentoDoTema = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  },
};

describe('o tema', () => {
  it('sem nada guardado, sem armazenamento ou com ele falhando, vale o padrão', () => {
    expect(TEMA_PADRAO).toBe('padrao');
    expect(lerTemaGuardado(armazenamento())).toBe('padrao');
    expect(lerTemaGuardado(null)).toBe('padrao');
    expect(lerTemaGuardado(quebrado)).toBe('padrao');
  });

  it('um valor que não é tema conhecido vale o padrão', () => {
    expect(lerTemaGuardado(armazenamento({ 'depurar:tema': 'roxo' }))).toBe('padrao');
  });

  it('o escolhido é guardado e lido de volta', () => {
    const a = armazenamento();
    guardarTema(a, 'azul');
    expect(a.dados['depurar:tema']).toBe('azul');
    expect(lerTemaGuardado(a)).toBe('azul');
  });

  it('guardar sem armazenamento não lança', () => {
    expect(() => guardarTema(quebrado, 'azul')).not.toThrow();
    expect(() => guardarTema(null, 'azul')).not.toThrow();
  });

  it('na área do estudo o tema é sempre o padrão, qualquer que seja o escolhido', () => {
    expect(temaFixo('estudo')).toBe(true);
    expect(temaFixo('conferir')).toBe(true);
    expect(temaDaTela('estudo', 'azul')).toBe('padrao');
    expect(temaDaTela('conferir', 'azul')).toBe('padrao');
  });

  it('fora dela, vale o escolhido', () => {
    for (const tela of ['inicial', 'entrar', 'exercicios', 'exercicio', 'metricas', 'controle', 'autoria', 'previa']) {
      expect(temaFixo(tela)).toBe(false);
      expect(temaDaTela(tela, 'azul')).toBe('azul');
    }
  });

  it('o atributo da raiz recebe o tema', () => {
    const atributos: Record<string, string> = {};
    aplicarTema({ setAttribute: (n, v) => (atributos[n] = v) }, 'azul');
    expect(atributos['data-tema']).toBe('azul');
  });

  it('escolher avisa quem assina e guarda', () => {
    const a = armazenamento({ 'depurar:tema': 'azul' });
    expect(carregarTema(a)).toBe('azul');
    let avisos = 0;
    const sair = assinarTema(() => avisos++);
    escolherTema(a, 'padrao');
    expect(temaEscolhido()).toBe('padrao');
    expect(a.dados['depurar:tema']).toBe('padrao');
    expect(avisos).toBe(1);
    sair();
    escolherTema(a, 'azul');
    expect(avisos).toBe(1);
  });
});
