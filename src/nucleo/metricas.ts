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

/**
 * Muda quando a forma dos dados muda, para que registros antigos continuem
 * legíveis.
 *
 * 2 — o instantâneo passou a preservar a identidade dos objetos (ver D12). Os
 * campos do registro exportado não mudaram: instantâneos não entram nele. A
 * versão marca o ambiente de coleta, e é o que permite saber, na análise, se
 * uma sessão foi gravada antes ou depois da mudança.
 *
 * 3 — o andaime passou de três níveis para dois (ver D9). O campo `andaime`
 * continua sendo texto, mas o conjunto de valores mudou: sessões da versão 2
 * trazem `completo`, `parcial` ou `minimo`, e as da versão 3, `com-apoio` ou
 * `sem-apoio`. Sem a versão, uma análise somaria condições diferentes sob o
 * mesmo nome.
 *
 * 4 — a sessão passou a ser gravada sob uma identidade (ver D21). Nenhum campo
 * foi criado nem removido, mas `participanteId` deixou de ser sempre nulo:
 * registros da versão 3 e anteriores foram coletados sem identidade e não se
 * agrupam por pessoa, enquanto os da 4 se agrupam. Sem a versão, uma análise
 * leria "sem identidade" como se fosse um participante a mais.
 */
export const VERSAO_DO_REGISTRO = 4;

/**
 * A execução disparada ao abrir o exercício não é uma tentativa do estudante.
 * Ela é registrada mesmo assim, mas fica fora das métricas — sem essa
 * separação, "tempo até a primeira execução" seria zero para todo participante.
 */
export type OrigemDaExecucao = 'estudante' | 'automatica';

/**
 * Toda tentativa de localização vira um evento 'localizacao', acertando ou
 * errando. É de propósito: a sequência de palpites é o registro da estratégia
 * de investigação do estudante, e uma tentativa descartada some para sempre.
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
  /**
   * Identidade do participante (D21). Nulo em registros da versão 3 e
   * anteriores, coletados antes de haver identidade, e nas cargas em que o
   * Supabase não está configurado.
   */
  participanteId: string | null;
  /**
   * Nível de andaime sob o qual a sessão foi apresentada (ver D9). Segue a
   * mesma regra de participanteId: ausência é null, nunca um valor arbitrário,
   * para que a análise não confunda "não registrado" com um nível de verdade.
   *
   * Guardado como texto opaco: o núcleo registra o rótulo que a interface
   * informou e não conhece os níveis nem o que cada um revela.
   */
  andaime: string | null;
  /** Relógio de parede, ISO 8601 — única âncora absoluta do registro. */
  instanteDeInicio: string;
  duracaoTotalMs: number;
  eventos: Evento[];
  resumo: ResumoDaSessao;
}

export interface ExportacaoDeMetricas {
  versao: number;
  exportadoEm: string;
  /**
   * De onde as sessões vieram e que recorte foi aplicado. Um arquivo filtrado
   * sem essa anotação seria lido, meses depois, como se fosse a coleta
   * inteira. Ausente em exportações anteriores a D22, que eram sempre tudo o
   * que o aparelho tinha.
   */
  recorte?: RecorteDaExportacao;
  sessoes: RegistroDeSessao[];
}

export interface RecorteDaExportacao {
  origem: 'banco' | 'aparelho';
  filtro: FiltroDeSessoes;
  /** Quantas sessões havia na origem antes do filtro. */
  totalNaOrigem: number;
}

type EventoDeExecucao = Extract<Evento, { tipo: 'execucao' }>;
export type EventoDeLocalizacao = Extract<Evento, { tipo: 'localizacao' }>;

/**
 * Leitura das tentativas de localização direto do log. A interface consome
 * esta função em vez de manter uma lista própria: duas cópias do mesmo dado
 * divergem, e a que vale é sempre a que será exportada.
 */
export function localizacoesDe(eventos: Evento[]): EventoDeLocalizacao[] {
  return eventos.filter((e): e is EventoDeLocalizacao => e.tipo === 'localizacao');
}

/**
 * Critério de sessão válida (D22): ao menos uma execução feita pelo estudante.
 *
 * Nos dois pilotos, mais da metade das sessões foi de gente abrindo e fechando
 * o exercício. A análise precisa separá-las, e o critério é aplicado como
 * FILTRO, nunca como descarte: a sessão inválida continua gravada, porque o
 * abandono também é dado — e porque um critério errado, aplicado na coleta,
 * não se desfaz.
 *
 * Lido do log, e não de `resumo.execucoes`: é o log que é o dado (D6), e o
 * critério precisa valer igual para registros de qualquer versão.
 */
export function sessaoValida(registro: RegistroDeSessao): boolean {
  return registro.eventos.some((e) => e.tipo === 'execucao' && e.origem === 'estudante');
}

/** Nulo em um critério quer dizer "qualquer um". */
export interface FiltroDeSessoes {
  participanteId: string | null;
  exercicioId: string | null;
  andaime: string | null;
  apenasValidas: boolean;
}

export const SEM_FILTRO: FiltroDeSessoes = {
  participanteId: null,
  exercicioId: null,
  andaime: null,
  apenasValidas: false,
};

/** Devolve uma lista nova; a de entrada não é tocada. */
export function filtrarSessoes(
  registros: RegistroDeSessao[],
  filtro: FiltroDeSessoes
): RegistroDeSessao[] {
  return registros.filter(
    (r) =>
      (filtro.participanteId === null || r.participanteId === filtro.participanteId) &&
      (filtro.exercicioId === null || r.exercicioId === filtro.exercicioId) &&
      (filtro.andaime === null || r.andaime === filtro.andaime) &&
      (!filtro.apenasValidas || sessaoValida(r))
  );
}

export function resumirSessao(eventos: Evento[]): ResumoDaSessao {
  const doEstudante = eventos.filter(
    (e): e is EventoDeExecucao => e.tipo === 'execucao' && e.origem === 'estudante'
  );
  const localizacoes = localizacoesDe(eventos);
  const primeiraCorreta = localizacoes.find((e) => e.correta);
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

/**
 * Identidade sob a qual as sessões estão sendo gravadas (D21).
 *
 * Fica no módulo, e não na criação da sessão, porque a entrada anônima do
 * primeiro acesso é uma ida à rede e o primeiro exercício não espera por ela:
 * a tela abre, a sessão começa, e o identificador chega depois. Como o
 * registro só é lido no arquivamento, ele chega a tempo.
 */
let participanteAtual: string | null = null;

export function definirParticipante(id: string | null): void {
  participanteAtual = id;
}

export function participante(): string | null {
  return participanteAtual;
}

export interface OpcoesDaSessao {
  exercicioId: string;
  /** Rótulo do nível de andaime da sessão (D9), definido pela interface. */
  andaime?: string;
  /**
   * Serve apenas para julgar a declaração de localização, dentro do núcleo.
   * Não entra no registro exportado e não é devolvida a quem desenha a tela —
   * a interface pergunta e recebe o veredito, sem nunca ver a resposta.
   */
  linhaDoDefeito: number;
  /** Fixa a identidade da sessão; sem ela, vale a do módulo no arquivamento. */
  participanteId?: string | null;
  /** Relógio monotônico. Injetável para teste. */
  agora?: () => number;
}

export interface Sessao {
  readonly id: string;
  registrarExecucao(origem: OrigemDaExecucao, codigo: string, resultado: ResultadoExecucao): void;
  registrarEdicao(codigo: string): void;
  registrarDica(indice: number): void;
  /** Registra a tentativa e devolve se ela acertou. Tentativas são ilimitadas. */
  registrarLocalizacao(linha: number): boolean;
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

    registrarLocalizacao(linha) {
      const correta = linha === opcoes.linhaDoDefeito;
      eventos.push({ tipo: 'localizacao', t: t(), linha, correta });
      return correta;
    },

    registro() {
      return {
        versao: VERSAO_DO_REGISTRO,
        id,
        exercicioId: opcoes.exercicioId,
        participanteId: opcoes.participanteId ?? participanteAtual,
        andaime: opcoes.andaime ?? null,
        instanteDeInicio,
        duracaoTotalMs: t(),
        eventos: [...eventos],
        resumo: resumirSessao(eventos),
      };
    },
  };
}

/**
 * Sessões já encerradas.
 *
 * Existe porque o estudante troca de exercício: ao sair de um, a sessão dele
 * precisa sobreviver à desmontagem da tela, senão o dado morre na navegação.
 *
 * A lista em memória continua sendo o arquivo de verdade. Desde D15 ela tem um
 * espelho durável no navegador: é recuperada dele ao iniciar e gravada nele a
 * cada arquivamento. O núcleo não sabe qual é o meio — quem o fornece é a
 * interface, por `ativarEspelho` — e continua sem DOM.
 */
const encerradas: RegistroDeSessao[] = [];

/** Meio durável onde o arquivo é espelhado. Só texto: o formato é do núcleo. */
export interface EspelhoDeSessoes {
  lerBruto(): string | null;
  gravarBruto(conteudo: string): void;
  /** Guarda à parte o que não pôde ser lido, para não ser sobrescrito. */
  preservar(conteudo: string): void;
  limpar(): void;
}

export interface EstadoDoEspelho {
  ativo: boolean;
  /** Algo guardado não pôde ser recuperado ao iniciar e ficou preservado à parte. */
  avisoDeLeitura: string | null;
  /** A última gravação falhou; o arquivo em memória segue inteiro. */
  falhaDeGravacao: string | null;
}

let espelho: EspelhoDeSessoes | null = null;
let avisoDeLeitura: string | null = null;
let falhaDeGravacao: string | null = null;

const descreverErro = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** O mínimo que um registro guardado precisa ter para voltar ao arquivo. */
function pareceRegistro(valor: unknown): valor is RegistroDeSessao {
  if (typeof valor !== 'object' || valor === null) return false;
  const r = valor as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.exercicioId === 'string' &&
    typeof r.versao === 'number' &&
    typeof r.instanteDeInicio === 'string' &&
    Array.isArray(r.eventos) &&
    typeof r.resumo === 'object' &&
    r.resumo !== null
  );
}

/**
 * O conteúdo guardado que não pôde ser lido vai para outra chave em vez de ser
 * sobrescrito no próximo arquivamento: dado não coletado não volta, e dado
 * ilegível ainda pode ser recuperado à mão.
 */
function preservarIlegivel(bruto: string, motivo: string): void {
  avisoDeLeitura = motivo;
  try {
    espelho?.preservar(bruto);
  } catch (e) {
    // Sem cópia à parte, gravar por cima destruiria o original. Melhor desligar
    // o espelho nesta carga e deixar o conteúdo intacto para ser recuperado.
    espelho = null;
    avisoDeLeitura =
      `o conteúdo guardado não pôde ser lido nem copiado à parte ` +
      `(${descreverErro(e)}); ficou intacto e o espelho foi desligado`;
  }
}

/**
 * Liga o espelho e recupera o que houver nele. Chamado uma vez, antes da
 * primeira tela. Os registros voltam como foram gravados, com a `versao` de
 * quando foram coletados: é ela que distingue coletas de formatos diferentes
 * (D6, D12), e reescrevê-la apagaria essa distinção.
 *
 * Nenhuma falha aqui derruba a aplicação — sem espelho, a coleta continua em
 * memória como antes de D15.
 */
export function ativarEspelho(novo: EspelhoDeSessoes): void {
  espelho = novo;
  let bruto: string | null;
  try {
    bruto = novo.lerBruto();
  } catch (e) {
    avisoDeLeitura = `o armazenamento do navegador não pôde ser lido (${descreverErro(e)})`;
    return;
  }
  if (bruto === null) return;

  let lido: unknown;
  try {
    lido = JSON.parse(bruto);
  } catch {
    preservarIlegivel(bruto, 'o conteúdo guardado não era JSON e foi preservado à parte');
    return;
  }

  const lista: unknown[] = Array.isArray(lido) ? lido : [lido];
  const validos = lista.filter(pareceRegistro);
  if (validos.length !== lista.length) {
    preservarIlegivel(
      bruto,
      `${lista.length - validos.length} registro(s) guardado(s) sem o formato esperado foram preservados à parte`
    );
  }
  for (const registro of validos) {
    if (!encerradas.some((s) => s.id === registro.id)) encerradas.push(registro);
  }
}

function espelhar(): void {
  if (!espelho) return;
  try {
    espelho.gravarBruto(JSON.stringify(encerradas));
    falhaDeGravacao = null;
  } catch (e) {
    falhaDeGravacao = descreverErro(e);
  }
}

/**
 * Destino durável fora do aparelho — o banco (D21).
 *
 * Mesma divisão do espelho: o núcleo declara o que precisa, e quem fala com a
 * rede é a interface. A diferença é que este destino é assíncrono e falha o
 * tempo todo — rede de sala de aula cai —, e a falha não pode custar o dado.
 */
export interface DestinoRemoto {
  /**
   * Grava ou regrava os registros e devolve os ids que de fato gravou. Pode
   * gravar só parte: um registro de outra identidade não pode ser gravado
   * pela identidade de agora (D22), e não deve impedir os demais de subir.
   * Lança quando não conseguiu gravar nada.
   */
  gravar(registros: RegistroDeSessao[]): Promise<string[]>;
}

export interface EstadoDoEnvio {
  ativo: boolean;
  /** Sessões que ainda não foram confirmadas pelo banco nesta carga da página. */
  pendentes: number;
  ultimaFalha: string | null;
}

let destino: DestinoRemoto | null = null;
let ultimaFalhaDeEnvio: string | null = null;
let envioEmCurso: Promise<void> | null = null;

/**
 * Ids já confirmados pelo banco. Vive só nesta carga da página, de propósito:
 * na carga seguinte, tudo o que está no aparelho é reenviado. O id da sessão é
 * a chave primária da tabela, então reenviar atualiza a linha em vez de
 * duplicá-la, e o custo de reenviar algumas dezenas de registros é menor do
 * que o de inventar um controle de "já enviado" que pode ficar mentindo.
 */
const confirmadas = new Set<string>();

function pendentes(): RegistroDeSessao[] {
  return encerradas.filter((s) => !confirmadas.has(s.id));
}

/**
 * Liga o banco e sobe o que estiver acumulado no aparelho. É aqui que a sessão
 * que ficou só local por falta de rede volta a ser tentada.
 */
export function ativarDestinoRemoto(novo: DestinoRemoto): Promise<void> {
  destino = novo;
  return sincronizarPendentes();
}

/**
 * Sobe as sessões ainda não confirmadas. Nunca rejeita: falhar em gravar no
 * banco é situação prevista, não erro de programa — o arquivo em memória e o
 * espelho local seguem inteiros, e a próxima chamada tenta de novo.
 *
 * Uma sincronização por vez: duas em paralelo gravariam os mesmos registros e
 * a segunda poderia confirmar o que a primeira ainda não conseguiu.
 */
export function sincronizarPendentes(): Promise<void> {
  if (!destino) return Promise.resolve();
  if (envioEmCurso) return envioEmCurso;

  const fila = pendentes();
  if (fila.length === 0) return Promise.resolve();

  const atual = destino;
  envioEmCurso = atual
    .gravar(fila)
    .then((gravados) => {
      for (const id of gravados) confirmadas.add(id);
      ultimaFalhaDeEnvio = null;
    })
    .catch((e: unknown) => {
      ultimaFalhaDeEnvio = descreverErro(e);
    })
    .finally(() => {
      envioEmCurso = null;
    });
  return envioEmCurso;
}

export function estadoDoEnvio(): EstadoDoEnvio {
  return {
    ativo: destino !== null,
    pendentes: pendentes().length,
    ultimaFalha: ultimaFalhaDeEnvio,
  };
}

/**
 * Arquiva uma sessão e grava o arquivo no espelho. Idempotente por id:
 * arquivar a mesma sessão de novo atualiza o retrato em vez de duplicá-lo, o
 * que também protege do ciclo monta/desmonta/monta que o StrictMode faz em
 * desenvolvimento.
 */
export function arquivarSessao(registro: RegistroDeSessao): void {
  const i = encerradas.findIndex((s) => s.id === registro.id);
  if (i >= 0) encerradas[i] = registro;
  else encerradas.push(registro);
  espelhar();
  // O retrato mudou, então a cópia que já esteja no banco está velha.
  confirmadas.delete(registro.id);
  void sincronizarPendentes();
}

export function sessoesArquivadas(): RegistroDeSessao[] {
  return [...encerradas];
}

export function estadoDoEspelho(): EstadoDoEspelho {
  return { ativo: espelho !== null, avisoDeLeitura, falhaDeGravacao };
}

/**
 * Apaga o arquivo: memória e espelho juntos. Limpar só o espelho não bastaria —
 * o próximo arquivamento gravaria a memória de volta, e as sessões do
 * participante anterior reapareceriam misturadas às do seguinte.
 */
export function limparArquivo(): void {
  encerradas.length = 0;
  avisoDeLeitura = null;
  falhaDeGravacao = null;
  // Limpa o aparelho, e só ele: o que já subiu continua no banco, que é o
  // ponto de D21. Apagar do banco não é operação de navegador (não há política
  // de delete), e a sessão do participante anterior não deve mesmo sumir.
  confirmadas.clear();
  ultimaFalhaDeEnvio = null;
  if (!espelho) return;
  try {
    espelho.limpar();
  } catch (e) {
    falhaDeGravacao = descreverErro(e);
  }
}

export function exportarSessoes(
  registros: RegistroDeSessao[],
  recorte?: RecorteDaExportacao
): string {
  const exportacao: ExportacaoDeMetricas = {
    versao: VERSAO_DO_REGISTRO,
    exportadoEm: new Date().toISOString(),
    ...(recorte ? { recorte } : {}),
    sessoes: registros,
  };
  return JSON.stringify(exportacao, null, 2);
}
