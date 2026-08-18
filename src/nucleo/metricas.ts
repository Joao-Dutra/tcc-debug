import type { ResultadoExecucao } from './tipos';

/**
 * Coleta das métricas da sessão de exercício.
 *
 * O registro é um LOG DE EVENTOS; as métricas agregadas são derivadas dele em
 * `resumirSessao`, e não armazenadas diretamente. A escolha é deliberada: um
 * agregado só responde às perguntas que já sabíamos formular na hora de
 * escrever o código, e o experimento não tem segunda chance — dado não
 * coletado não volta depois.
 *
 * Sem React e sem DOM aqui. Quem exibe e quem baixa o arquivo é a interface.
 */

/** Muda quando a forma dos dados muda, para que registros antigos continuem legíveis. */
export const VERSAO_DO_REGISTRO = 1;

/**
 * A execução disparada ao abrir o exercício não é uma tentativa do estudante.
 * Ela é registrada mesmo assim, mas fica fora das métricas — sem essa
 * separação, "tempo até a primeira execução" seria zero para todo participante.
 */
export type OrigemDaExecucao = 'estudante' | 'automatica';

/**
 * O evento 'localizacao' já faz parte do formato, mas nada o produz ainda: o
 * mecanismo de o estudante apontar a linha suspeita é a próxima fatia. Está
 * declarado para que o formato do dado — e o resumo que o consome — nasçam
 * prontos para recebê-lo.
 */
export type Evento =
  | {
      tipo: 'execucao';
      t: number;
      origem: OrigemDaExecucao;
      /** Código exato executado. Sem ele não dá para distinguir, na análise,
          uma correção de verdade de um caso de teste satisfeito na marra. */
      codigo: string;
      casosPassaram: number;
      casosTotal: number;
      todosPassaram: boolean;
      erro: string | null;
    }
  | { tipo: 'edicao'; t: number; codigo: string }
  | { tipo: 'dica'; t: number; indice: number }
  | { tipo: 'localizacao'; t: number; linha: number; correta: boolean };

/** Métricas agregadas. Sempre deriváveis do log; nunca a única cópia do dado. */
export interface ResumoDaSessao {
  /** Ausência é null, nunca 0 — "não corrigiu" não pode colidir com "corrigiu na hora". */
  tempoAtePrimeiraExecucaoMs: number | null;
  tempoAteLocalizacaoMs: number | null;
  tempoAteCorrecaoMs: number | null;
  execucoes: number;
  execucoesComErro: number;
  dicasReveladas: number;
  edicoes: number;
  localizacoesTentadas: number;
  corrigido: boolean;
}

export interface RegistroDeSessao {
  versao: number;
  id: string;
  exercicioId: string;
  /** Preenchido quando houver autenticação de participantes. */
  participanteId: string | null;
  /** Relógio de parede, ISO 8601 — única âncora absoluta do registro. */
  instanteDeInicio: string;
  duracaoTotalMs: number;
  eventos: Evento[];
  resumo: ResumoDaSessao;
}

export interface ExportacaoDeMetricas {
  versao: number;
  exportadoEm: string;
  sessoes: RegistroDeSessao[];
}

type EventoDeExecucao = Extract<Evento, { tipo: 'execucao' }>;

export function resumirSessao(eventos: Evento[]): ResumoDaSessao {
  const doEstudante = eventos.filter(
    (e): e is EventoDeExecucao => e.tipo === 'execucao' && e.origem === 'estudante'
  );
  const localizacoes = eventos.filter((e) => e.tipo === 'localizacao');
  const primeiraCorreta = eventos.find((e) => e.tipo === 'localizacao' && e.correta);
  const primeiraCorrecao = doEstudante.find((e) => e.todosPassaram);

  return {
    tempoAtePrimeiraExecucaoMs: doEstudante[0]?.t ?? null,
    tempoAteLocalizacaoMs: primeiraCorreta?.t ?? null,
    tempoAteCorrecaoMs: primeiraCorrecao?.t ?? null,
    execucoes: doEstudante.length,
    execucoesComErro: doEstudante.filter((e) => e.erro !== null).length,
    dicasReveladas: eventos.filter((e) => e.tipo === 'dica').length,
    edicoes: eventos.filter((e) => e.tipo === 'edicao').length,
    localizacoesTentadas: localizacoes.length,
    corrigido: primeiraCorrecao !== undefined,
  };
}

export interface OpcoesDaSessao {
  exercicioId: string;
  participanteId?: string | null;
  /** Relógio monotônico. Injetável para teste. */
  agora?: () => number;
}

export interface Sessao {
  readonly id: string;
  registrarExecucao(origem: OrigemDaExecucao, codigo: string, resultado: ResultadoExecucao): void;
  registrarEdicao(codigo: string): void;
  registrarDica(indice: number): void;
  /** Retrato do registro no instante da chamada; pode ser pedido quantas vezes for. */
  registro(): RegistroDeSessao;
}

function novoId(): string {
  // randomUUID exige contexto seguro. O reserva evita perder a sessão inteira
  // de um participante por causa de um navegador fora do padrão.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sessao-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function criarSessao(opcoes: OpcoesDaSessao): Sessao {
  // Relógio monotônico para as durações: Date.now() salta se o relógio do
  // computador se ajustar no meio da sessão, e um salto desses corromperia em
  // silêncio justamente as medidas que sustentam o estudo.
  const agora = opcoes.agora ?? (() => performance.now());
  const referencia = agora();
  const instanteDeInicio = new Date().toISOString();
  const eventos: Evento[] = [];
  const id = novoId();

  const t = () => Math.round(agora() - referencia);

  return {
    id,

    registrarExecucao(origem, codigo, resultado) {
      const casosTotal = resultado.casos.length;
      const casosPassaram = resultado.casos.filter((c) => c.passou).length;
      eventos.push({
        tipo: 'execucao',
        t: t(),
        origem,
        codigo,
        casosPassaram,
        casosTotal,
        // Sem casos não há aprovação: um erro de sintaxe devolve lista vazia, e
        // every() sobre lista vazia é true.
        todosPassaram: casosTotal > 0 && casosPassaram === casosTotal,
        erro: resultado.erro ?? null,
      });
    },

    registrarEdicao(codigo) {
      eventos.push({ tipo: 'edicao', t: t(), codigo });
    },

    registrarDica(indice) {
      eventos.push({ tipo: 'dica', t: t(), indice });
    },

    registro() {
      return {
        versao: VERSAO_DO_REGISTRO,
        id,
        exercicioId: opcoes.exercicioId,
        participanteId: opcoes.participanteId ?? null,
        instanteDeInicio,
        duracaoTotalMs: t(),
        eventos: [...eventos],
        resumo: resumirSessao(eventos),
      };
    },
  };
}

export function exportarSessoes(registros: RegistroDeSessao[]): string {
  const exportacao: ExportacaoDeMetricas = {
    versao: VERSAO_DO_REGISTRO,
    exportadoEm: new Date().toISOString(),
    sessoes: registros,
  };
  return JSON.stringify(exportacao, null, 2);
}
