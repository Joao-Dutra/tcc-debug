/**
 * O questionário do fim do percurso (D37): a usabilidade, pelo SUS, e o que o
 * participante achou da visualização e dos exercícios, numa escala de 1 a 5,
 * e duas perguntas abertas.
 *
 * O texto é **pendente da orientadora**, como o do aviso. Quais itens existem,
 * e com que texto, é a versão que diz: ela vai para o banco com cada resposta,
 * e o teste do questionário guarda a impressão do texto de cada versão. Mudou
 * qualquer coisa que o participante lê aqui, suba VERSAO_DO_QUESTIONARIO.
 *
 * Os ids dos itens são as chaves de `escalas` no banco (0004). O banco só
 * confere que cada valor é um inteiro de 1 a 5; quais chaves valem é daqui.
 */

export const VERSAO_DO_QUESTIONARIO = 1;

/**
 * A versão brasileira do SUS, citada em D37. Os dez itens são os da Tabela 1
 * do artigo, transcritos do PDF em português — a versão que os autores
 * aplicaram no teste e que não recebeu mudança depois dele.
 */
export const FONTE_DO_SUS =
  'Lourenço DF, Carmona EV, Lopes MHBM. Tradução e adaptação transcultural da System ' +
  'Usability Scale para o português do Brasil. Aquichan. 2022;22(2):e2228. ' +
  'DOI: 10.5294/aqui.2022.22.2.8';

export type ValorDaEscala = 1 | 2 | 3 | 4 | 5;

export const VALORES_DA_ESCALA: readonly ValorDaEscala[] = [1, 2, 3, 4, 5];

export interface ItemDaEscala {
  id: string;
  texto: string;
}

/**
 * O SUS, na ordem e com o texto da fonte. É um instrumento validado: mudar
 * uma palavra aqui não é subir a versão, é deixar de aplicar o SUS — e o
 * escore deixa de ser comparável com o da literatura. O teste do questionário
 * cobra o texto por extenso, independente da versão.
 *
 * "O sistema" fica como na fonte; a introdução diz que ele é a ferramenta.
 */
export const ITENS_DO_SUS: readonly ItemDaEscala[] = [
  { id: 'sus-1', texto: 'Eu acho que gostaria de usar esse sistema frequentemente.' },
  { id: 'sus-2', texto: 'Eu achei esse sistema desnecessariamente complexo.' },
  { id: 'sus-3', texto: 'Eu achei esse sistema fácil de usar.' },
  {
    id: 'sus-4',
    texto: 'Eu achei que precisaria de ajuda de uma pessoa técnica para ser capaz de usar esse sistema.',
  },
  { id: 'sus-5', texto: 'Eu achei que as várias funções desse sistema foram bem integradas.' },
  { id: 'sus-6', texto: 'Eu acho que o sistema apresenta muita inconsistência.' },
  { id: 'sus-7', texto: 'Eu imagino que a maioria das pessoas pode aprender a usar esse sistema rapidamente.' },
  { id: 'sus-8', texto: 'Eu achei esse sistema muito pesado para usar.' },
  { id: 'sus-9', texto: 'Eu me senti muito seguro usando o sistema.' },
  { id: 'sus-10', texto: 'Eu precisei aprender muitas coisas antes que pudesse utilizar esse sistema.' },
];

/** O que o estudo pergunta além da usabilidade, na redação do pesquisador. */
export const ITENS_DA_VISUALIZACAO: readonly ItemDaEscala[] = [
  { id: 'vis-1', texto: 'A visualização me ajudou a entender o que o código estava fazendo' },
  { id: 'vis-2', texto: 'Encontrei defeitos observando a visualização, e não apenas lendo o código' },
  { id: 'vis-3', texto: 'Avançar a execução passo a passo foi útil para encontrar o defeito' },
  { id: 'vis-4', texto: 'Ver a estrutura desenhada me ajudou a entender melhor vetor, pilha, fila e lista' },
  { id: 'vis-5', texto: 'Exercícios com um defeito para encontrar me ajudaram a praticar depuração' },
  { id: 'vis-6', texto: 'Eu usaria esta ferramenta para estudar AEDS' },
];

export const ITENS_DAS_ESCALAS: readonly ItemDaEscala[] = [...ITENS_DO_SUS, ...ITENS_DA_VISUALIZACAO];

/** O limite das respostas abertas é o do `check` da tabela. */
export const LIMITE_DA_RESPOSTA_ABERTA = 2000;

export type CampoAberto = 'oQueAjudou' | 'oQueAtrapalhou';

export const QUESTIONARIO = {
  titulo: 'Para terminar',
  introducao: [
    'Conte como foi usar a ferramenta. Não há resposta certa ou errada, e nada daqui volta para você ' +
      'como nota ou resultado.',
    'Para cada afirmação, marque de 1 a 5 o quanto você concorda com ela. Nas afirmações, “o sistema” ' +
      'é a ferramenta que você acabou de usar.',
  ],
  // As âncoras são as da fonte do SUS, que nomeia só os extremos.
  ancoras: { 1: 'Discordo fortemente', 5: 'Concordo fortemente' } as Partial<Record<ValorDaEscala, string>>,
  blocos: [
    { titulo: 'Sobre a ferramenta', itens: ITENS_DO_SUS },
    { titulo: 'Sobre a visualização e os exercícios', itens: ITENS_DA_VISUALIZACAO },
  ],
  abertas: [
    { campo: 'oQueAjudou', pergunta: 'O que mais ajudou?' },
    { campo: 'oQueAtrapalhou', pergunta: 'O que atrapalhou ou faltou?' },
  ] as { campo: CampoAberto; pergunta: string }[],
  opcional: 'opcional',
  enviar: 'Enviar respostas',
};

/** Tudo o que o participante lê, na ordem: é o que a impressão da versão cobre. */
export function textoDoQuestionario(): string {
  return [
    QUESTIONARIO.titulo,
    ...QUESTIONARIO.introducao,
    ...VALORES_DA_ESCALA.map((v) => `${v} ${QUESTIONARIO.ancoras[v] ?? ''}`.trim()),
    ...QUESTIONARIO.blocos.flatMap((b) => [b.titulo, ...b.itens.map((i) => i.texto)]),
    ...QUESTIONARIO.abertas.map((a) => a.pergunta),
    QUESTIONARIO.opcional,
    QUESTIONARIO.enviar,
  ].join('\n');
}

export type EscalasEmAndamento = Partial<Record<string, ValorDaEscala>>;

/** Quantas afirmações ainda estão sem resposta: todas são obrigatórias. */
export function afirmacoesQueFaltam(escalas: EscalasEmAndamento): number {
  return ITENS_DAS_ESCALAS.filter((i) => escalas[i.id] === undefined).length;
}

export interface RespostaDoQuestionario {
  versao: number;
  escalas: Record<string, ValorDaEscala>;
  oQueAjudou: string | null;
  oQueAtrapalhou: string | null;
}

/**
 * A resposta pronta para gravar, ou nula se falta alguma afirmação. A
 * resposta aberta em branco vira nula, e não texto vazio: ausente é nulo, como
 * no registro das sessões.
 */
export function montarResposta(
  escalas: EscalasEmAndamento,
  abertas: Partial<Record<CampoAberto, string>>
): RespostaDoQuestionario | null {
  if (afirmacoesQueFaltam(escalas) > 0) return null;
  const aberta = (campo: CampoAberto) => {
    const texto = (abertas[campo] ?? '').trim().slice(0, LIMITE_DA_RESPOSTA_ABERTA);
    return texto === '' ? null : texto;
  };
  return {
    versao: VERSAO_DO_QUESTIONARIO,
    escalas: Object.fromEntries(ITENS_DAS_ESCALAS.map((i) => [i.id, escalas[i.id]!])),
    oQueAjudou: aberta('oQueAjudou'),
    oQueAtrapalhou: aberta('oQueAtrapalhou'),
  };
}

/**
 * O escore do SUS, de 0 a 100 (Brooke, 1996; a mesma regra da fonte): nos
 * itens ímpares, que afirmam bem do sistema, vale a resposta menos 1; nos
 * pares, que afirmam mal, 5 menos a resposta. A soma, vezes 2,5.
 *
 * A fonte escreve a regra dos pares como "subtraindo-se 5 do escore", mas é 5
 * menos a resposta: lida ao pé da letra, a soma sairia negativa, e o escore,
 * fora da faixa de 0 a 100 que o próprio artigo usa.
 *
 * Nulo se falta algum dos dez: o SUS não tem escore parcial, e um zero no
 * lugar da falta puxaria a média para baixo.
 */
export function escoreDoSus(escalas: Partial<Record<string, number>>): number | null {
  let soma = 0;
  for (const [indice, item] of ITENS_DO_SUS.entries()) {
    const valor = escalas[item.id];
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > 5) return null;
    // O índice começa em 0: o item 1 está no índice 0, que é par.
    soma += indice % 2 === 0 ? valor - 1 : 5 - valor;
  }
  return soma * 2.5;
}
