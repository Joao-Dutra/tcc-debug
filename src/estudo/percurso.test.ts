import { describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import {
  ETAPAS,
  LIMITE_DO_AQUECIMENTO_MS,
  LIMITE_POR_EXERCICIO_MS,
  abrirEtapa,
  comecarPercurso,
  concluirQuestionario,
  continuarDepoisDoTempo,
  encerrarEtapa,
  entrarComGrupo,
  interpretarPercurso,
  marcaDaEtapa,
  rotuloDaEtapa,
} from './percurso';
import { interpretarHash } from '../componentes/usar-rota';

/**
 * O percurso do estudo (D37): a sequência, o plano de apoio e os tempos
 * pedidos, e as passagens de uma tela para outra.
 *
 * O plano é o desenho do experimento. Um apoio trocado numa etapa não quebra
 * nada que se veja — o exercício abre igual —, e só apareceria na análise,
 * depois da coleta. Por isso ele é cobrado aqui, por extenso.
 */

describe('a sequência e o plano', () => {
  it('é a sequência pedida, com o aquecimento primeiro', () => {
    expect(ETAPAS.map((e) => e.exercicioId)).toEqual([
      'vetor-zerar-negativos',
      'pilha-desempilhar',
      'fila-atender-todos',
      'lista-inserir-depois',
      'vetor-ordenar-por-selecao',
      'vetor-ordenar',
    ]);
    expect(ETAPAS.map((e) => e.aquecimento)).toEqual([true, false, false, false, false, false]);
  });

  it('toda etapa é um exercício do catálogo', () => {
    for (const etapa of ETAPAS) {
      expect(catalogo.some((e) => e.id === etapa.exercicioId), etapa.exercicioId).toBe(true);
    }
  });

  it('o aquecimento é com apoio para todos; depois, A alterna a partir de com, e B, o inverso', () => {
    const com = 'com-apoio';
    const sem = 'sem-apoio';
    expect(ETAPAS.map((e) => e.apoio.A)).toEqual([com, com, sem, com, sem, com]);
    expect(ETAPAS.map((e) => e.apoio.B)).toEqual([com, sem, com, sem, com, sem]);
  });

  it('10 minutos no aquecimento e 8 em cada exercício', () => {
    expect(LIMITE_DO_AQUECIMENTO_MS).toBe(10 * 60_000);
    expect(LIMITE_POR_EXERCICIO_MS).toBe(8 * 60_000);
    expect(ETAPAS.map((e) => e.limiteMs / 60_000)).toEqual([10, 8, 8, 8, 8, 8]);
  });

  it('a posição diz a etapa e o total, e nada sobre o que foi resolvido', () => {
    expect(ETAPAS.map((_, i) => rotuloDaEtapa(i))).toEqual([
      'Aquecimento',
      'Exercício 1 de 5',
      'Exercício 2 de 5',
      'Exercício 3 de 5',
      'Exercício 4 de 5',
      'Exercício 5 de 5',
    ]);
  });
});

describe('as passagens', () => {
  const inicio = () => entrarComGrupo(comecarPercurso('piloto-nov', 1, 'uid'), 'B', false);

  it('do aviso ao perfil, e do perfil ao aquecimento', () => {
    const comecado = comecarPercurso('piloto-nov', 1, 'uid');
    expect(comecado.passo).toEqual({ tela: 'perfil' });
    expect(comecado.grupo).toBeNull();
    expect(inicio().passo).toEqual({ tela: 'exercicio', etapa: 0 });
    expect(inicio().grupo).toBe('B');
  });

  it('o prazo é gravado na primeira abertura e não recomeça', () => {
    const aberto = abrirEtapa(inicio(), 0, 1_000);
    expect(aberto.prazos[0]).toBe(1_000 + LIMITE_DO_AQUECIMENTO_MS);
    // Recarregar a página abre a mesma etapa de novo, mais tarde.
    expect(abrirEtapa(aberto, 0, 90_000).prazos[0]).toBe(1_000 + LIMITE_DO_AQUECIMENTO_MS);
  });

  it('seguir vai direto à etapa seguinte; o prazo passa antes pela tela do tempo', () => {
    expect(encerrarEtapa(inicio(), 0, 'seguir').passo).toEqual({ tela: 'exercicio', etapa: 1 });
    const esgotado = encerrarEtapa(inicio(), 0, 'tempo-esgotado');
    expect(esgotado.passo).toEqual({ tela: 'tempo-esgotado', etapa: 0 });
    expect(continuarDepoisDoTempo(esgotado).passo).toEqual({ tela: 'exercicio', etapa: 1 });
  });

  it('depois do último exercício, o questionário, pelos dois caminhos', () => {
    const ultima = ETAPAS.length - 1;
    expect(encerrarEtapa(inicio(), ultima, 'seguir').passo).toEqual({ tela: 'questionario' });
    const esgotado = encerrarEtapa(inicio(), ultima, 'tempo-esgotado');
    expect(continuarDepoisDoTempo(esgotado).passo).toEqual({ tela: 'questionario' });
  });

  it('o questionário respondido leva ao agradecimento, e só ele', () => {
    const noQuestionario = encerrarEtapa(inicio(), ETAPAS.length - 1, 'seguir');
    expect(concluirQuestionario(noQuestionario).passo).toEqual({ tela: 'agradecimento' });
    // Fora do questionário, nada muda: não se pula um exercício por ele.
    expect(concluirQuestionario(inicio())).toEqual(inicio());
  });

  it('a marca da sessão leva o grupo só quando ele foi escolhido no aparelho', () => {
    expect(marcaDaEtapa(inicio(), 0)).toEqual({ aplicacao: 'piloto-nov', etapa: 0, aquecimento: true });
    const semBanco = entrarComGrupo(comecarPercurso('piloto-nov', 1, null), 'A', true);
    expect(marcaDaEtapa(semBanco, 2)).toEqual({
      aplicacao: 'piloto-nov',
      etapa: 2,
      aquecimento: false,
      grupoNoAparelho: 'A',
    });
  });
});

describe('o percurso guardado', () => {
  const guardado = abrirEtapa(entrarComGrupo(comecarPercurso('piloto-nov', 1, 'uid'), 'A', false), 0, 5);
  const ida = (e: unknown) => JSON.parse(JSON.stringify(e));

  it('volta igual', () => {
    expect(interpretarPercurso(ida(guardado), 'piloto-nov')).toEqual(guardado);
    const noQuestionario = { ...guardado, passo: { tela: 'questionario' } };
    expect(interpretarPercurso(ida(noQuestionario), 'piloto-nov')).toEqual(noQuestionario);
  });

  it('não serve a outra aplicação', () => {
    expect(interpretarPercurso(ida(guardado), 'aeds1-2026')).toBeNull();
  });

  it('descarta o que não tem a forma esperada, em vez de abrir fora da sequência', () => {
    const com = (mudanca: object) => interpretarPercurso({ ...ida(guardado), ...mudanca }, 'piloto-nov');
    expect(com({ passo: { tela: 'exercicio', etapa: 9 } })).toBeNull();
    expect(com({ passo: { tela: 'exercicio', etapa: 1.5 } })).toBeNull();
    expect(com({ passo: { tela: 'vitrine' } })).toBeNull();
    // Exercício sem grupo seria exercício sem apoio definido.
    expect(com({ grupo: null })).toBeNull();
    expect(com({ grupo: 'C' })).toBeNull();
    expect(com({ passo: { tela: 'questionario' }, grupo: null })).toBeNull();
    expect(com({ prazos: [] })).toBeNull();
    expect(interpretarPercurso('lixo', 'piloto-nov')).toBeNull();
  });
});

describe('as rotas do estudo', () => {
  it('o código vai no caminho, e a conferência fica embaixo dele', () => {
    expect(interpretarHash('#/estudo/piloto-nov')).toEqual({ tela: 'estudo', aplicacao: 'piloto-nov' });
    expect(interpretarHash('#/estudo/piloto-nov/conferir')).toEqual({
      tela: 'conferir',
      aplicacao: 'piloto-nov',
    });
    // Sem código não há estudo: cai na inicial, como qualquer endereço sem sentido.
    expect(interpretarHash('#/estudo')).toEqual({ tela: 'inicial' });
  });
});
