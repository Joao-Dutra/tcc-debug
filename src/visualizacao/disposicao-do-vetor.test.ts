import { beforeAll, describe, expect, it } from 'vitest';
import { catalogo } from '../exercicios/catalogo';
import { abrirWorker } from '../nucleo/worker-em-teste';
import { FOLGA_DA_ETIQUETA, contem, meioDoArco, seSobrepoem } from './arco-da-escrita';
import { ALTURA_DO_QUADRO, disporVetor } from './disposicao-do-vetor';
import type { DisposicaoDoVetor } from './disposicao-do-vetor';
import type { RodarNoWorker } from '../nucleo/worker-em-teste';
import type { Instantaneo, LugarDoValor } from '../nucleo/tipos';

/**
 * O valor parado no meio do arco (D32), verificado por cálculo.
 *
 * A regra: em todo quadro em que o arco aparece, o valor aparece no meio dele,
 * dentro do quadro e sem cobrir célula, caixa de variável, nome de caixa,
 * marcador nem rótulo de marcador. Vale nos dois níveis de apoio, que mudam o
 * que está escrito no quadro e, portanto, o que pode ser coberto.
 *
 * Duas frentes. Os quadros de verdade de todo exercício de vetor do catálogo,
 * nas duas versões, rodados pelo mesmo Worker do navegador — é o que o
 * estudante vê. E uma bateria de quadros montados à mão com o que um
 * exercício de professor pode trazer: fileira cheia, caixas acima dela,
 * marcadores fora da fileira e valores longos.
 */

const NIVEIS = [
  { nome: 'com apoio', rotulos: true, legendas: true },
  { nome: 'sem apoio', rotulos: false, legendas: false },
] as const;

// Um Worker só por arquivo: ele se registra uma vez, na importação.
let rodar: RodarNoWorker;
beforeAll(async () => {
  rodar = await abrirWorker();
});

/** Por que o valor deste quadro está mal posto, ou nulo se está bem. */
function problemaDoValor(disposicao: DisposicaoDoVetor): string | null {
  const { movimento, obstaculos, largura } = disposicao;
  const QUADRO = { x: 0, y: 0, largura, altura: ALTURA_DO_QUADRO };
  if (!movimento) return null;
  const meio = meioDoArco(movimento.de, movimento.para, movimento.controle);
  if (Math.abs(meio.x - movimento.meio.x) > 1e-9 || Math.abs(meio.y - movimento.meio.y) > 1e-9) {
    return 'o valor não está no meio do arco desenhado';
  }
  if (!contem(QUADRO, movimento.etiqueta)) return 'o valor sai do quadro';
  const colisao = obstaculos.find((o) => seSobrepoem(movimento.etiqueta, o, FOLGA_DA_ETIQUETA));
  if (colisao) return `o valor cobre algo desenhado em ${JSON.stringify(colisao)}`;
  return null;
}

describe('nos quadros dos exercícios de vetor do catálogo', () => {
  const doVetor = catalogo.filter((e) => e.estrutura === 'vetor');

  it.each(doVetor.flatMap((e) => NIVEIS.map((n) => [e.id, n.nome, e, n] as const)))(
    '%s, %s',
    (_, __, exercicio, nivel) => {
      for (const codigo of [exercicio.codigoComDefeito, exercicio.codigoCorreto]) {
        const { instantaneos } = rodar({
          codigo,
          variaveisObservadas: exercicio.variaveisObservadas,
          marcadores: exercicio.marcadores,
          casos: exercicio.casosDeTeste,
        });
        for (const quadro of instantaneos) {
          const problema = problemaDoValor(disporVetor(quadro, nivel));
          expect(problema, `quadro ${quadro.ordem}`).toBeNull();
        }
      }
    }
  );

  // Sem este, o teste acima passaria com nenhum arco desenhado em quadro
  // nenhum — por exemplo, se a escrita deixasse de chegar ao instantâneo.
  it('a ordenação tem quadros com arco, e o valor aparece em todos eles', () => {
    const exercicio = doVetor.find((e) => e.id === 'vetor-ordenar')!;
    const { instantaneos } = rodar({
      codigo: exercicio.codigoComDefeito,
      variaveisObservadas: exercicio.variaveisObservadas,
      marcadores: exercicio.marcadores,
    });
    const comEscrita = instantaneos.filter((q) => q.escrita);
    expect(comEscrita.length).toBeGreaterThan(5);
    for (const quadro of comEscrita) {
      const { movimento } = disporVetor(quadro, NIVEIS[0]);
      expect(movimento?.valor, `quadro ${quadro.ordem}`).toBeTruthy();
    }
  });
});

describe('numa bateria de quadros montados à mão', () => {
  const VALORES = [7, -12, 1234567, 'texto longo demais'];
  const NOMES_DE_CAIXA = ['temp', 'alvo', 'aux', 'chave'];
  const NOMES_DE_MARCADOR = ['i', 'j', 'k'];

  /** Todos os lugares de um quadro entre os quais pode haver uma cópia. */
  function lugares(tamanho: number, caixas: string[], marcadores: string[]): LugarDoValor[] {
    return [
      ...Array.from({ length: Math.min(tamanho, 8) }, (_, indice) => ({ vetor: 'itens', indice })),
      ...caixas.map((variavel) => ({ variavel })),
      ...marcadores.map((variavel) => ({ variavel })),
    ];
  }

  const casos: [string, Instantaneo][] = [];
  for (const tamanho of [1, 2, 5, 7, 8, 10]) {
    for (const quantasCaixas of [0, 1, 3, 4]) {
      for (const quantosMarcadores of [0, 1, 3]) {
        for (const posicao of ['inicio', 'fim', 'fora'] as const) {
          for (const valor of VALORES) {
            const caixas = NOMES_DE_CAIXA.slice(0, quantasCaixas);
            const marcadores = NOMES_DE_MARCADOR.slice(0, quantosMarcadores);
            const indiceDoMarcador = (m: number) =>
              posicao === 'inicio' ? m : posicao === 'fim' ? tamanho - 1 - m : tamanho + m;
            const variaveis: Record<string, unknown> = {
              itens: Array.from({ length: tamanho }, () => valor),
              ...Object.fromEntries(caixas.map((c) => [c, valor])),
              ...Object.fromEntries(marcadores.map((m, i) => [m, indiceDoMarcador(i)])),
            };
            const todos = lugares(tamanho, caixas, marcadores);
            for (const origem of todos) {
              for (const destino of todos) {
                if (origem === destino) continue;
                casos.push([
                  `${tamanho} posições, ${quantasCaixas} caixas, ${quantosMarcadores} marcadores ` +
                    `(${posicao}), valor ${JSON.stringify(valor)}, ` +
                    `${JSON.stringify(origem)} → ${JSON.stringify(destino)}`,
                  {
                    ordem: 0,
                    linha: 1,
                    variaveis,
                    marcadores,
                    observadas: ['itens', ...caixas, ...marcadores],
                    escrita: { origem, destino },
                  },
                ]);
              }
            }
          }
        }
      }
    }
  }

  it.each(NIVEIS)('$nome', (nivel) => {
    const problemas = casos
      .map(([nome, quadro]) => [nome, problemaDoValor(disporVetor(quadro, nivel))])
      .filter(([, problema]) => problema !== null);
    expect(problemas.slice(0, 5), `${problemas.length} de ${casos.length} quadros`).toEqual([]);
  });
});

describe('o arranjo das caixas e do arco (D32)', () => {
  // A largura sai do que o exercício observa, e não do quadro: se mudasse
  // quando uma variável aparece, o desenho inteiro mudaria de escala entre um
  // passo e o seguinte.
  it.each(catalogo.filter((e) => e.estrutura === 'vetor'))(
    '$id mantém a mesma largura em todo quadro com a fileira desenhada',
    (exercicio) => {
      const { instantaneos } = rodar({
        codigo: exercicio.codigoComDefeito,
        variaveisObservadas: exercicio.variaveisObservadas,
        marcadores: exercicio.marcadores,
      });
      const larguras = new Set(
        instantaneos
          .filter((q) => Array.isArray(q.variaveis.itens))
          .map((q) => disporVetor(q, NIVEIS[0]).largura)
      );
      expect([...larguras]).toHaveLength(1);
    }
  );

  it('a caixa fica na mesma vaga com ou sem a vizinha', () => {
    const quadro = (variaveis: Record<string, unknown>): Instantaneo => ({
      ordem: 0,
      linha: 1,
      variaveis: { itens: [1, 2, 3], ...variaveis },
      observadas: ['itens', 'temp', 'alvo'],
    });
    const sozinha = disporVetor(quadro({ alvo: 4 }), NIVEIS[0]).caixas;
    const comVizinha = disporVetor(quadro({ temp: 9, alvo: 4 }), NIVEIS[0]).caixas;
    expect(sozinha.find((c) => c.nome === 'alvo')?.x).toBe(
      comVizinha.find((c) => c.nome === 'alvo')?.x
    );
  });

  // A busca binária é o caso: oito posições, a caixa de `alvo` e `inicio`
  // passando da última posição quando o valor é maior que todos.
  it('a caixa não fica em cima da vaga do marcador que passou da fileira', () => {
    const disposicao = disporVetor(
      {
        ordem: 0,
        linha: 1,
        variaveis: { itens: [1, 2, 3, 4, 5, 6, 7, 8], inicio: 8, alvo: 9 },
        marcadores: ['inicio'],
        observadas: ['itens', 'inicio', 'alvo'],
      },
      NIVEIS[0]
    );
    const [marcador] = disposicao.marcadores;
    expect(marcador.fora).toBe(true);
    for (const caixa of disposicao.caixas) {
      expect(caixa.x, 'a caixa começa antes do fim da cabeça do marcador').toBeGreaterThan(
        marcador.x + 6
      );
    }
  });

  // `inicio = meio` move o marcador, e o movimento já é o próprio marcador
  // indo para a posição do outro (D27).
  it('a cópia entre dois marcadores não desenha arco', () => {
    const disposicao = disporVetor(
      {
        ordem: 0,
        linha: 1,
        variaveis: { itens: [1, 2, 3, 4, 5], meio: 2, inicio: 2 },
        marcadores: ['meio', 'inicio'],
        escrita: { origem: { variavel: 'meio' }, destino: { variavel: 'inicio' } },
      },
      NIVEIS[0]
    );
    expect(disposicao.movimento).toBeNull();
  });
});
