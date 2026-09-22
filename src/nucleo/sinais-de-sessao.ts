import type { Evento, EventoDeLocalizacao, RegistroDeSessao } from './metricas';

/**
 * Sinais sobre a qualidade de uma sessão, lidos do log (D25, D26).
 *
 * São leituras, e não dado: calculados na hora de mostrar, a partir dos
 * eventos, sem alterar nem acrescentar nada ao registro. Por isso valem para
 * sessões de qualquer versão, inclusive as coletadas antes de o sinal existir,
 * e trocar um critério não exige recoletar nada. Um sinal chama a atenção do
 * pesquisador para uma sessão; não a exclui, não a corrige e não a julga — a
 * decisão sobre o que fazer com ela é da análise, com o log inteiro na mão.
 */

/** Tentativas seguidas a partir das quais o padrão vira sinal. */
export const TENTATIVAS_PARA_VARREDURA = 5;

/**
 * Maior salto entre duas linhas seguidas de uma varredura ordenada. Três, e
 * não um: quem desce o código linha por linha pula a linha em branco e a que
 * só fecha chave, e o padrão continua sendo o mesmo.
 */
export const SALTO_DA_VARREDURA = 3;

/**
 * Abaixo disto, duas tentativas seguidas não deram tempo de ler a linha
 * apontada. Só alcança sessões anteriores à versão 6: desde o intervalo de
 * D25, duas tentativas julgadas nunca ficam tão perto.
 */
export const INTERVALO_DA_RAJADA_MS = 2000;

export interface Varredura {
  /**
   * `ordenada`: linhas vizinhas, sempre no mesmo sentido — descer ou subir o
   * código apontando cada linha. `rajada`: tentativas em sequência rápida
   * demais para ler, em qualquer ordem.
   */
  forma: 'ordenada' | 'rajada';
  tentativas: number;
  primeiraLinha: number;
  ultimaLinha: number;
  duracaoMs: number;
}

/**
 * O que interrompe uma sequência de tentativas: uma ação de investigação do
 * estudante. Executar, editar e abrir dica contam; o clique no intervalo, não
 * — ele é a própria insistência. A execução automática da abertura também não,
 * porque não é ação de ninguém.
 *
 * A navegação no reprodutor não entra no log, e por isso não interrompe nada
 * aqui: quem assistiu à animação entre dois palpites, sem executar, aparece
 * como quem não fez nada no meio. É o motivo de o sinal pedir, além disso,
 * linhas vizinhas ou ritmo de rajada.
 */
function interrompeSequencia(evento: Evento): boolean {
  if (evento.tipo === 'execucao') return evento.origem === 'estudante';
  return evento.tipo === 'edicao' || evento.tipo === 'dica';
}

/** Tentativas julgadas agrupadas em sequências sem investigação no meio. */
function sequenciasSemInvestigacao(eventos: Evento[]): EventoDeLocalizacao[][] {
  const sequencias: EventoDeLocalizacao[][] = [];
  let atual: EventoDeLocalizacao[] = [];
  for (const evento of eventos) {
    if (evento.tipo === 'localizacao') {
      atual.push(evento);
    } else if (interrompeSequencia(evento) && atual.length > 0) {
      sequencias.push(atual);
      atual = [];
    }
  }
  if (atual.length > 0) sequencias.push(atual);
  return sequencias;
}

/**
 * O trecho contíguo mais longo em que cada tentativa se liga à anterior. A
 * ligação recebe o sentido do trecho até ali (0 no começo) e devolve o
 * sentido novo, ou nulo se não liga.
 */
function trechoMaisLongo(
  tentativas: EventoDeLocalizacao[],
  liga: (anterior: EventoDeLocalizacao, seguinte: EventoDeLocalizacao, sentido: number) => number | null
): { inicio: number; fim: number } {
  let melhor = { inicio: 0, fim: 0 };
  let inicio = 0;
  let sentido = 0;
  for (let i = 1; i < tentativas.length; i++) {
    const novo = liga(tentativas[i - 1], tentativas[i], sentido);
    if (novo !== null) {
      sentido = novo;
    } else {
      // O par que quebrou o trecho pode, sozinho, abrir o seguinte.
      const recomeco = liga(tentativas[i - 1], tentativas[i], 0);
      inicio = recomeco === null ? i : i - 1;
      sentido = recomeco ?? 0;
    }
    if (i - inicio > melhor.fim - melhor.inicio) melhor = { inicio, fim: i };
  }
  return melhor;
}

function ordenada(anterior: EventoDeLocalizacao, seguinte: EventoDeLocalizacao, sentido: number) {
  const salto = seguinte.linha - anterior.linha;
  if (salto === 0 || Math.abs(salto) > SALTO_DA_VARREDURA) return null;
  const novo = Math.sign(salto);
  return sentido === 0 || novo === sentido ? novo : null;
}

function rajada(anterior: EventoDeLocalizacao, seguinte: EventoDeLocalizacao) {
  return seguinte.t - anterior.t < INTERVALO_DA_RAJADA_MS ? 0 : null;
}

/**
 * Padrão de varredura (D25): ao menos TENTATIVAS_PARA_VARREDURA tentativas
 * seguidas, sem executar, editar ou abrir dica entre elas, e ou em linhas
 * vizinhas no mesmo sentido, ou em ritmo de rajada. Devolve o trecho mais
 * longo que atende ao critério, ou nulo.
 *
 * O sinal pede as duas coisas — nada no meio, e ordem ou pressa — porque
 * cada uma sozinha tem explicação inocente: quem testa hipóteses assistindo à
 * animação não deixa nada no log entre os palpites, e quem hesita entre duas
 * linhas vizinhas aponta uma e depois a outra.
 */
export function varreduraDe(eventos: Evento[]): Varredura | null {
  let melhor: Varredura | null = null;
  for (const sequencia of sequenciasSemInvestigacao(eventos)) {
    for (const [forma, liga] of [
      ['ordenada', ordenada],
      ['rajada', rajada],
    ] as const) {
      const { inicio, fim } = trechoMaisLongo(sequencia, liga);
      const tentativas = fim - inicio + 1;
      if (tentativas < TENTATIVAS_PARA_VARREDURA) continue;
      if (melhor !== null && tentativas <= melhor.tentativas) continue;
      melhor = {
        forma,
        tentativas,
        primeiraLinha: sequencia[inicio].linha,
        ultimaLinha: sequencia[fim].linha,
        duracaoMs: sequencia[fim].t - sequencia[inicio].t,
      };
    }
  }
  return melhor;
}

/**
 * Intervalo sem evento nenhum a partir do qual a sessão é sinalizada como
 * ociosa, e o trecho deixa de contar na duração ativa (D26).
 *
 * Cinco minutos: é da ordem de uma sessão resolvida inteira — nos pilotos, a
 * correção levou de 27 s a 313 s —, e um silêncio desse tamanho, sem executar,
 * editar, abrir dica nem apontar, não é parte de resolver. E é folgado para
 * quem passa minutos assistindo à animação e pensando: a navegação no
 * reprodutor não entra no log, e esse tempo aparece aqui como silêncio.
 */
export const LIMIAR_DE_OCIOSIDADE_MS = 5 * 60_000;

export interface IntervaloOcioso {
  /** Do último evento antes do silêncio — ou do início da sessão. */
  deMs: number;
  /** Até o evento seguinte — ou o fim da sessão. */
  ateMs: number;
}

/**
 * Os marcos da sessão em ordem: o início, cada evento e o fim. O núcleo grava
 * o log em ordem de tempo; ordenar aqui é salvaguarda para o registro que
 * chega de outra fonte — uma exportação editada à mão, uma linha alterada no
 * banco —, porque um intervalo negativo entraria calado na soma da duração
 * ativa.
 */
function marcos(registro: RegistroDeSessao): number[] {
  const instantes = registro.eventos.map((e) => e.t).sort((a, b) => a - b);
  return [0, ...instantes, Math.max(registro.duracaoTotalMs, instantes.at(-1) ?? 0)];
}

/** Os silêncios da sessão maiores que o limiar, em ordem. */
export function intervalosOciosos(
  registro: RegistroDeSessao,
  limiarMs: number = LIMIAR_DE_OCIOSIDADE_MS
): IntervaloOcioso[] {
  const m = marcos(registro);
  const ociosos: IntervaloOcioso[] = [];
  for (let i = 1; i < m.length; i++) {
    if (m[i] - m[i - 1] > limiarMs) ociosos.push({ deMs: m[i - 1], ateMs: m[i] });
  }
  return ociosos;
}

/**
 * Duração da sessão sem os silêncios maiores que o limiar (D26).
 *
 * O silêncio longo sai inteiro, e não cortado no limiar. Cortar seria contínuo
 * — quatro minutos e cinquenta e nove contam quase o mesmo que cinco e um —,
 * mas somaria até cinco minutos de atividade a cada aba esquecida, numa
 * tarefa que se resolve nesse mesmo tempo: a sessão de 28 minutos com uma
 * execução no começo sairia com mais de cinco minutos ativos. Tirar inteiro
 * erra para menos em quem pensou calado por mais de cinco minutos, que é o
 * caso raro, e acerta no comum.
 *
 * Não substitui a duração total, que continua no registro, intocada.
 */
export function duracaoAtivaMs(
  registro: RegistroDeSessao,
  limiarMs: number = LIMIAR_DE_OCIOSIDADE_MS
): number {
  const m = marcos(registro);
  let ativa = 0;
  for (let i = 1; i < m.length; i++) {
    const intervalo = m[i] - m[i - 1];
    if (intervalo <= limiarMs) ativa += intervalo;
  }
  return ativa;
}
