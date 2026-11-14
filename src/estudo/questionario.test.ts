import { describe, expect, it } from 'vitest';
import {
  ITENS_DA_VISUALIZACAO,
  ITENS_DAS_ESCALAS,
  ITENS_DOS_RECURSOS,
  NAO_USEI,
  ITENS_DO_SUS,
  QUESTIONARIO,
  VERSAO_DO_QUESTIONARIO,
  afirmacoesQueFaltam,
  escoreDoSus,
  montarResposta,
  textoDoQuestionario,
} from './questionario';
import type { EscalasEmAndamento, ValorDaEscala } from './questionario';

/**
 * O questionário do estudo (D37).
 *
 * Como no aviso, a versão vai para o banco com cada resposta, e só serve se
 * cada versão tiver um texto só: a impressão de cada versão fica guardada
 * aqui. Mudou o texto, suba VERSAO_DO_QUESTIONARIO e acrescente a impressão
 * nova — sem apagar as antigas, que são as de quem já respondeu.
 */

const IMPRESSOES: Record<number, string> = {
  1: '786c7e75',
  // D42: o bloco dos recursos, com "Não usei", e a primeira aberta reescrita.
  2: '33da6408',
};

/** FNV-1a de 32 bits, a mesma do teste do aviso. */
function impressao(texto: string): string {
  let h = 0x811c9dc5;
  for (const unidade of new TextEncoder().encode(texto)) {
    h ^= unidade;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Todas as afirmações com o mesmo valor, e o SUS com os valores dados. */
function respostas(sus: number[], resto: ValorDaEscala = 3): EscalasEmAndamento {
  const escalas: EscalasEmAndamento = Object.fromEntries(ITENS_DAS_ESCALAS.map((i) => [i.id, resto]));
  sus.forEach((v, i) => (escalas[`sus-${i + 1}`] = v as ValorDaEscala));
  return escalas;
}

describe('o texto do questionário', () => {
  it('o texto desta versão é o mesmo de quando ela foi registrada', () => {
    expect(impressao(textoDoQuestionario()), 'mudou o texto do questionário: suba a versão').toBe(
      IMPRESSOES[VERSAO_DO_QUESTIONARIO]
    );
  });

  it('o SUS é o da fonte, palavra por palavra, em qualquer versão', () => {
    // Lourenço, Carmona e Lopes (2022), Aquichan 22(2):e2228, Tabela 1,
    // conferida no PDF em português. Mudar um item é deixar de aplicar o SUS.
    expect(ITENS_DO_SUS).toEqual([
      { id: 'sus-1', texto: 'Eu acho que gostaria de usar esse sistema frequentemente.' },
      { id: 'sus-2', texto: 'Eu achei esse sistema desnecessariamente complexo.' },
      { id: 'sus-3', texto: 'Eu achei esse sistema fácil de usar.' },
      {
        id: 'sus-4',
        texto: 'Eu achei que precisaria de ajuda de uma pessoa técnica para ser capaz de usar esse sistema.',
      },
      { id: 'sus-5', texto: 'Eu achei que as várias funções desse sistema foram bem integradas.' },
      { id: 'sus-6', texto: 'Eu acho que o sistema apresenta muita inconsistência.' },
      {
        id: 'sus-7',
        texto: 'Eu imagino que a maioria das pessoas pode aprender a usar esse sistema rapidamente.',
      },
      { id: 'sus-8', texto: 'Eu achei esse sistema muito pesado para usar.' },
      { id: 'sus-9', texto: 'Eu me senti muito seguro usando o sistema.' },
      { id: 'sus-10', texto: 'Eu precisei aprender muitas coisas antes que pudesse utilizar esse sistema.' },
    ]);
    expect(QUESTIONARIO.ancoras).toEqual({ 1: 'Discordo fortemente', 5: 'Concordo fortemente' });
  });

  it('as afirmações sobre a visualização são as seis pedidas, na ordem', () => {
    expect(ITENS_DA_VISUALIZACAO.map((i) => i.id)).toEqual(['vis-1', 'vis-2', 'vis-3', 'vis-4', 'vis-5', 'vis-6']);
    expect(ITENS_DA_VISUALIZACAO.map((i) => i.texto)).toEqual([
      'A visualização me ajudou a entender o que o código estava fazendo',
      'Encontrei defeitos observando a visualização, e não apenas lendo o código',
      'Avançar a execução passo a passo foi útil para encontrar o defeito',
      'Ver a estrutura desenhada me ajudou a entender melhor vetor, pilha, fila e lista',
      'Exercícios com um defeito para encontrar me ajudaram a praticar depuração',
      'Eu usaria esta ferramenta para estudar AEDS',
    ]);
  });

  it('as duas abertas são as pedidas', () => {
    expect(QUESTIONARIO.abertas.map((a) => a.pergunta)).toEqual([
      'O que foi mais útil na ferramenta, e por quê?',
      'O que atrapalhou ou faltou?',
    ]);
  });

  it('o bloco dos recursos tem os quatro dos dois níveis de apoio, com escala de utilidade e "Não usei" (D42)', () => {
    expect(ITENS_DOS_RECURSOS.map((i) => i.id)).toEqual(['rec-1', 'rec-2', 'rec-3', 'rec-4']);
    expect(ITENS_DOS_RECURSOS.map((i) => i.texto)).toEqual([
      'Apontar a linha do defeito, clicando no número dela',
      'Avançar e voltar a execução passo a passo',
      'O desenho da estrutura de dados',
      'Os casos de teste',
    ]);
    // As dicas só existem com apoio (D9): não entram.
    expect(ITENS_DOS_RECURSOS.map((i) => i.texto).join(' ')).not.toMatch(/dica/i);
    const bloco = QUESTIONARIO.blocos.find((b) => b.titulo === 'Os recursos da ferramenta')!;
    expect(bloco.itens).toBe(ITENS_DOS_RECURSOS);
    expect(bloco.ancoras).toEqual({ 1: 'Nada útil', 5: 'Muito útil' });
    expect(bloco.naoUsei).toBe(true);
    // Só os recursos aceitam "Não usei"; o SUS e a visualização seguem com a escala da fonte.
    expect(QUESTIONARIO.blocos.filter((b) => b.naoUsei)).toEqual([bloco]);
    for (const b of QUESTIONARIO.blocos.filter((x) => !x.naoUsei)) expect(b.ancoras).toEqual(QUESTIONARIO.ancoras);
  });

  it('cada item tem um id só, e o banco recebe exatamente estas chaves', () => {
    const ids = ITENS_DAS_ESCALAS.map((i) => i.id);
    expect(new Set(ids).size).toBe(20);
    expect(Object.keys(montarResposta(respostas([]), {})!.escalas)).toEqual(ids);
  });
});

describe('a resposta', () => {
  it('só sai com todas as afirmações respondidas', () => {
    const quase = respostas([]);
    delete quase['vis-6'];
    expect(afirmacoesQueFaltam(quase)).toBe(1);
    expect(montarResposta(quase, {})).toBeNull();
    expect(afirmacoesQueFaltam({})).toBe(20);
  });

  it('"Não usei" conta como resposta, e fica ausente, e não como nota (D42)', () => {
    const escalas = respostas([]);
    escalas['rec-1'] = NAO_USEI;
    escalas['rec-4'] = NAO_USEI;
    expect(afirmacoesQueFaltam(escalas)).toBe(0);
    const resposta = montarResposta(escalas, {})!;
    expect(resposta.escalas).not.toHaveProperty('rec-1');
    expect(resposta.escalas).not.toHaveProperty('rec-4');
    expect(resposta.escalas['rec-2']).toBe(3);
    // O que vai ao banco passa no check da 0004: só inteiros de 1 a 5.
    for (const valor of Object.values(resposta.escalas)) expect([1, 2, 3, 4, 5]).toContain(valor);
    // E o escore do SUS não muda com os recursos.
    expect(escoreDoSus(escalas)).toBe(escoreDoSus(respostas([])));
  });

  it('"Não usei" não vale fora do bloco dos recursos', () => {
    // O formulário não oferece a opção lá; se chegasse, o item sairia ausente, e o SUS sem escore.
    const escalas = respostas([]);
    escalas['sus-3'] = NAO_USEI;
    expect(escoreDoSus(escalas)).toBeNull();
  });

  it('as abertas são opcionais, e a em branco vai nula', () => {
    const resposta = montarResposta(respostas([]), { oQueAjudou: '  o passo a passo  ', oQueAtrapalhou: '   ' });
    expect(resposta).toMatchObject({
      versao: VERSAO_DO_QUESTIONARIO,
      oQueAjudou: 'o passo a passo',
      oQueAtrapalhou: null,
    });
  });

  it('a aberta não passa do limite do banco', () => {
    const resposta = montarResposta(respostas([]), { oQueAjudou: 'x'.repeat(3000) });
    expect(resposta!.oQueAjudou).toHaveLength(2000);
  });
});

describe('o escore do SUS', () => {
  it('vai de 0 a 100, com os pares invertidos', () => {
    expect(escoreDoSus(respostas([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]))).toBe(100);
    expect(escoreDoSus(respostas([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]))).toBe(0);
    // Tudo neutro é o meio da escala.
    expect(escoreDoSus(respostas([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]))).toBe(50);
    // Concordar com tudo: os ímpares somam 20 e os pares, 0.
    expect(escoreDoSus(respostas([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]))).toBe(50);
  });

  it('um caso calculado à mão', () => {
    // Ímpares 4,4,3,5,4 → 3+3+2+4+3 = 15; pares 2,1,2,1,3 → 3+4+3+4+2 = 16.
    // (15 + 16) × 2,5 = 77,5.
    expect(escoreDoSus(respostas([4, 2, 4, 1, 3, 2, 5, 1, 4, 3]))).toBe(77.5);
  });

  it('não depende das afirmações sobre a visualização', () => {
    expect(escoreDoSus(respostas([4, 2, 4, 1, 3, 2, 5, 1, 4, 3], 1))).toBe(77.5);
  });

  it('é nulo se falta algum dos dez, ou se algum está fora da escala', () => {
    const falta = respostas([4, 2, 4, 1, 3, 2, 5, 1, 4, 3]);
    delete falta['sus-7'];
    expect(escoreDoSus(falta)).toBeNull();
    const com = (valor: number): Partial<Record<string, number>> => ({ ...respostas([]), 'sus-2': valor });
    expect(escoreDoSus(com(6))).toBeNull();
    expect(escoreDoSus(com(2.5))).toBeNull();
  });
});
