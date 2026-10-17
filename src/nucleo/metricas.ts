import type { OrigemDoExercicio, ResultadoExecucao } from './tipos';

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
 *
 * 5 — a execução passou a ser registrada no disparo, e não na chegada do
 * resultado (ver D23). O evento `execucao` ganhou `situacao` e `tResultado`, e
 * o `t` dele mudou de sentido: até a versão 4 era o instante em que o
 * resultado voltou do Worker; da 5 em diante é o instante do clique. Para
 * código comum a diferença é de milissegundos, mas num laço que esbarra no
 * tempo limite ela chega a segundos — e os tempos até a primeira execução e
 * até a correção, lidos desse `t`, mudariam de sentido sem aviso.
 *
 * 6 — entre duas tentativas de localização passou a haver um intervalo mínimo
 * (ver D25), e o clique no número da linha durante esse intervalo passou a
 * entrar no log como `localizacao-no-intervalo`, sem veredito. O número de
 * tentativas e o intervalo entre elas mudam de sentido: até a versão 5 o
 * estudante podia apontar a cada fração de segundo, e da 6 em diante não. Uma
 * análise que misturasse as duas leria como mudança de comportamento o que é
 * mudança da ferramenta.
 *
 * 7 — numa troca de ordem entre duas linhas vizinhas, as duas passaram a
 * contar como localização correta (D30). Até a versão 6, só a primeira
 * contava, e quem apontava a segunda ouvia "o defeito não está aqui" — um
 * retorno falso. No catálogo, isso muda `correta` em `lista-inserir-depois`:
 * a linha 16 era incorreta e passa a ser correta, e com ela o tempo até a
 * localização de quem a apontou primeiro.
 *
 * 8 — o registro ganhou `origemDoExercicio`: `catalogo` ou `professor` (D31).
 * Nas versões anteriores o campo não existe, e toda sessão é do catálogo — não
 * havia outra origem. A análise do estudo separa as duas: um exercício de
 * professor não passou pela suíte do catálogo, nem pelo congelamento.
 *
 * 9 — a tela de exercício ganhou o tutorial do participante (D32), e o log
 * ganhou `tutorial-aberto` e `tutorial-fechado`. Ele abre sozinho na primeira
 * entrada do aparelho, e o tempo dele cai dentro da sessão: na versão 9, o
 * tempo até a primeira execução da primeira sessão inclui o tutorial, e a
 * análise o desconta com os dois eventos. Até a versão 8 não havia tutorial, e
 * a ausência dos eventos não quer dizer que ele foi pulado.
 *
 * 10 — o log ganhou `navegacao`: os gestos no reprodutor e as paradas da
 * reprodução (D36). Até a versão 9 a navegação não era registrada, e a
 * ausência dos eventos quer dizer "não coletado", e não "não navegou"; os
 * campos de navegação do resumo ficam ausentes nesses registros. O sinal de
 * ociosidade (D26) muda junto: ele conta todo evento como atividade, e da
 * versão 10 em diante quem passa minutos navegando deixa de parecer ocioso.
 *
 * 11 — a área do estudo (D37). O registro ganhou `estudo`, a marca da sessão
 * aberta dentro do percurso, e o log ganhou `encerramento`, o fim da sessão
 * pelo botão de seguir ou pelo tempo esgotado. Fora da área do estudo nada
 * muda; dentro dela, a sessão passa a ter prazo, e a duração dela deixa de ser
 * só a vontade do estudante. Sem a versão, uma sessão de 8 minutos cortada
 * pelo prazo seria lida como alguém que ficou 8 minutos e saiu.
 */
export const VERSAO_DO_REGISTRO = 11;

/**
 * Intervalo mínimo entre duas tentativas de localização julgadas (D25).
 *
 * Com veredito imediato e tentativas ilimitadas (D7), apontar linha por linha
 * até acertar dispensa a investigação — os dados mostraram 47 tentativas em 34
 * segundos, subindo linha a linha. As tentativas continuam ilimitadas e o
 * veredito continua imediato; o que muda é que a seguinte espera o intervalo.
 * Dez segundos são mais de trinta vezes o intervalo daquela varredura e ficam
 * abaixo de uma reprodução inteira da animação em seis dos nove exercícios do
 * catálogo: quem volta ao desenho entre um palpite e outro quase nunca espera.
 *
 * Mudar este valor muda o ambiente de coleta, e pede nova VERSAO_DO_REGISTRO.
 */
export const INTERVALO_ENTRE_LOCALIZACOES_MS = 10_000;

/**
 * A execução disparada ao abrir o exercício não é uma tentativa do estudante.
 * Ela é registrada mesmo assim, mas fica fora das métricas — sem essa
 * separação, "tempo até a primeira execução" seria zero para todo participante.
 */
export type OrigemDaExecucao = 'estudante' | 'automatica';

/**
 * Uma execução pode não chegar ao fim: o estudante que escreveu um laço
 * infinito, cansou de esperar e saiu do exercício antes do tempo limite. Ela
 * é gravada mesmo assim, como 'interrompida', porque o disparo foi uma ação
 * dele — e quase sempre a mais informativa da sessão (D23).
 */
export type SituacaoDaExecucao = 'concluida' | 'interrompida';

/**
 * Por que o tutorial abriu (D32): sozinho, na primeira entrada do aparelho, ou
 * porque o estudante pediu, no botão de ajuda. São coisas diferentes na
 * análise — quem volta ao tutorial no meio do exercício está procurando como
 * usar a ferramenta naquele instante.
 */
export type MotivoDoTutorial = 'primeira-entrada' | 'ajuda';

/**
 * Como o tutorial fechou: chegando ao último passo e encerrando, ou antes
 * disso — pelo botão de pular, pelo fechar ou pela tecla Esc.
 *
 * Quem sai do exercício com o tutorial aberto não gera fechamento: o log fica
 * com o `tutorial-aberto` sem par, e é isso que ele diz. Inventar um "pulado"
 * no desmonte afirmaria um gesto que ninguém fez.
 */
export type DesfechoDoTutorial = 'concluido' | 'pulado';

/**
 * Os gestos do estudante no reprodutor (D36). Os passos que a reprodução
 * automática percorre sozinha não entram — um a cada 600 ms seria ruído —;
 * o trecho assistido fica descrito pelo passo em que tocou e pelo passo em
 * que parou.
 */
export type GestoDeNavegacao = 'avancar' | 'voltar' | 'tocar' | 'pausar' | 'arrastar';

/**
 * Por que a reprodução parou sem gesto do estudante: chegou ao último passo,
 * ou o resultado de outra execução substituiu o que estava tocando.
 */
export type MotivoDaParada = 'fim' | 'nova-execucao';

/**
 * Como uma sessão da área do estudo terminou (D37): pelo botão de seguir ou
 * pelo prazo. O log guarda o gesto, e não o juízo — "desistiu" é derivado na
 * análise, de seguir sem nenhuma execução que passou em todos os casos. Quem
 * corrige e depois segue não desistiu, e um log que dissesse "desistência" no
 * clique o contaria como desistente.
 */
export type MotivoDoEncerramento = 'seguir' | 'tempo-esgotado';

/**
 * A marca de uma sessão aberta dentro do percurso do estudo (D37). Ausente em
 * toda sessão fora dele.
 *
 * O grupo não entra: a fonte dele é a tabela de participantes, que só o banco
 * escreve. A exceção é a instalação sem banco, em que o grupo é escolhido no
 * próprio aparelho — e aí ele vai aqui, para não se perder, marcado como tal.
 */
export interface MarcaDoEstudo {
  /** O código da aplicação, como `piloto-nov`. */
  aplicacao: string;
  /** 0 é o aquecimento; de 1 em diante, os exercícios da análise. */
  etapa: number;
  /** O aquecimento fica fora da análise, para todos os grupos. */
  aquecimento: boolean;
  /** Só sem banco: o grupo escolhido no aparelho, e não pelo banco. */
  grupoNoAparelho?: 'A' | 'B';
}

/**
 * Campos comuns a todo evento de navegação. Os passos contam a partir de 1,
 * como o contador que o estudante vê; `total` é o número de passos da
 * execução exibida, que muda de uma execução para outra.
 */
interface PosicaoNoReprodutor {
  de: number;
  para: number;
  total: number;
}

/**
 * Toda tentativa de localização vira um evento 'localizacao', acertando ou
 * errando. É de propósito: a sequência de palpites é o registro da estratégia
 * de investigação do estudante, e uma tentativa descartada some para sempre.
 *
 * Pela mesma razão, o clique no número da linha durante o intervalo entre
 * tentativas (D25) também entra, como 'localizacao-no-intervalo': não é
 * julgado nem conta como tentativa, mas insistir enquanto a ferramenta pede
 * espera é justamente o comportamento que a análise da varredura procura.
 */
export type Evento =
  | {
      tipo: 'execucao';
      /** Instante do disparo — o clique do estudante —, desde a versão 5. */
      t: number;
      origem: OrigemDaExecucao;
      /** Código exato executado. Sem ele não dá para distinguir, na análise,
          uma correção de verdade de um caso de teste satisfeito na marra. */
      codigo: string;
      /** Ausente em registros da versão 4 e anteriores, que só gravavam o que
          concluía. */
      situacao?: SituacaoDaExecucao;
      /** Instante em que o resultado voltou; nulo se interrompida. Ausente em
          registros anteriores à versão 5. */
      tResultado?: number | null;
      /** Numa execução interrompida, 0, 0, false e null: não houve resultado. */
      casosPassaram: number;
      casosTotal: number;
      todosPassaram: boolean;
      erro: string | null;
    }
  | { tipo: 'edicao'; t: number; codigo: string }
  | { tipo: 'dica'; t: number; indice: number }
  | { tipo: 'localizacao'; t: number; linha: number; correta: boolean }
  /** Desde a versão 6. Sem veredito: a linha não chegou a ser julgada. */
  | { tipo: 'localizacao-no-intervalo'; t: number; linha: number }
  /** Desde a versão 9 (D32). */
  | { tipo: 'tutorial-aberto'; t: number; motivo: MotivoDoTutorial }
  | {
      tipo: 'tutorial-fechado';
      t: number;
      desfecho: DesfechoDoTutorial;
      /** O passo mais adiantado que chegou a ser mostrado, a partir de 1. */
      passoAlcancado: number;
      totalDePassos: number;
    }
  /**
   * Desde a versão 10 (D36). Em avançar e voltar, `de` é o passo de saída e
   * `para` o de chegada; em tocar, os dois são o passo de partida; em pausar,
   * `de` é onde a reprodução começou e `para` onde o estudante a parou.
   */
  | ({ tipo: 'navegacao'; t: number; gesto: Exclude<GestoDeNavegacao, 'arrastar'> } &
      PosicaoNoReprodutor)
  /**
   * Um arrasto contínuo da barra vira um evento só: `t` é o começo, `tFim` o
   * último movimento, `de` o passo antes de arrastar e `para` o de chegada. Os
   * passos atravessados no meio não ficam: passaram diante do estudante por
   * frações de segundo.
   */
  | ({ tipo: 'navegacao'; t: number; gesto: 'arrastar'; tFim: number } & PosicaoNoReprodutor)
  /** A reprodução parou sozinha. Não é gesto, e não conta como navegação. */
  | ({ tipo: 'navegacao'; t: number; gesto: 'parou'; motivo: MotivoDaParada } &
      PosicaoNoReprodutor)
  /**
   * Desde a versão 11, e só na área do estudo (D37). O último evento da
   * sessão: o que vier depois dele não é arquivado.
   */
  | { tipo: 'encerramento'; t: number; motivo: MotivoDoEncerramento };

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
  // Navegação no reprodutor (D36). Ausentes nos registros anteriores à versão
  // 10, que não a coletavam: ausente é "não coletado", e nunca 0.
  /** Gestos do estudante no reprodutor; as paradas sozinhas não contam. */
  navegacoes?: number;
  /**
   * Pares (execução, passo) a que o estudante chegou por ação própria: a
   * chegada de avançar, voltar e arrastar, e cada passo de um trecho tocado.
   */
  passosDistintosVisitados?: number;
  /** Voltar, e arrastos que terminam antes de onde começaram. */
  retrocessos?: number;
  tempoAtePrimeiraNavegacaoMs?: number | null;
}

export interface RegistroDeSessao {
  versao: number;
  id: string;
  exercicioId: string;
  /**
   * De onde veio o exercício (D31). Ausente até a versão 7, quando todo
   * exercício era do catálogo; `origemDe` lê os dois casos do mesmo jeito.
   */
  origemDoExercicio?: OrigemDoExercicio;
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
  /** A marca do percurso do estudo (D37). Ausente fora dele, e até a versão 10. */
  estudo?: MarcaDoEstudo;
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
export type EventoDeNavegacao = Extract<Evento, { tipo: 'navegacao' }>;
type EventoDeArrasto = Extract<EventoDeNavegacao, { gesto: 'arrastar' }>;

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
 *
 * A execução interrompida conta (D23). O estudante disparou, e o disparo é a
 * ação que o critério procura; quem escreveu um laço infinito e desistiu de
 * esperar não é quem abriu e fechou.
 */
export function sessaoValida(registro: RegistroDeSessao): boolean {
  return registro.eventos.some((e) => e.tipo === 'execucao' && e.origem === 'estudante');
}

/** A origem da sessão, valendo também para os registros anteriores ao campo. */
export function origemDe(registro: RegistroDeSessao): OrigemDoExercicio {
  return registro.origemDoExercicio ?? 'catalogo';
}

/** Nulo em um critério quer dizer "qualquer um". */
export interface FiltroDeSessoes {
  participanteId: string | null;
  exercicioId: string | null;
  andaime: string | null;
  /** Texto, como o andaime: é o valor que o seletor do painel devolve. */
  origemDoExercicio: string | null;
  apenasValidas: boolean;
}

export const SEM_FILTRO: FiltroDeSessoes = {
  participanteId: null,
  exercicioId: null,
  andaime: null,
  origemDoExercicio: null,
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
      (filtro.origemDoExercicio === null || origemDe(r) === filtro.origemDoExercicio) &&
      (!filtro.apenasValidas || sessaoValida(r))
  );
}

/**
 * Quantos passos distintos o estudante visitou, contados por execução (D36).
 *
 * O evento de navegação não diz a que execução se refere, e não precisa: o
 * reprodutor mostra sempre o resultado da última execução concluída. A
 * exceção é a parada por `nova-execucao`, registrada justamente quando o
 * resultado novo chega — e o trecho que ela fecha é o do resultado anterior.
 */
function passosDistintosVisitados(eventos: Evento[]): number {
  // As execuções na ordem em que o resultado chegou, que é a ordem em que
  // passaram a ser exibidas. A posição no log identifica cada uma.
  const chegadas = eventos
    .flatMap((e, posicao) =>
      e.tipo === 'execucao' && typeof e.tResultado === 'number'
        ? [{ posicao, tResultado: e.tResultado }]
        : []
    )
    .sort((a, b) => a.tResultado - b.tResultado);

  const exibidaEm = (t: number, anterior: boolean): number => {
    const ate = chegadas.filter((c) => c.tResultado <= t);
    return ate.at(anterior ? -2 : -1)?.posicao ?? -1;
  };

  const visitados = new Set<string>();
  for (const e of eventos) {
    if (e.tipo !== 'navegacao') continue;
    const execucao = exibidaEm(e.t, e.gesto === 'parou' && e.motivo === 'nova-execucao');
    const visitar = (passo: number) => visitados.add(`${execucao}:${passo}`);
    switch (e.gesto) {
      case 'avancar':
      case 'voltar':
      case 'arrastar':
        visitar(e.para);
        break;
      case 'pausar':
      case 'parou':
        for (let p = Math.min(e.de, e.para); p <= Math.max(e.de, e.para); p++) visitar(p);
        break;
      case 'tocar':
        // O passo de partida já estava na tela; o trecho entra quando fecha.
        break;
    }
  }
  return visitados.size;
}

export function resumirSessao(eventos: Evento[]): ResumoDaSessao {
  const doEstudante = eventos.filter(
    (e): e is EventoDeExecucao => e.tipo === 'execucao' && e.origem === 'estudante'
  );
  const localizacoes = localizacoesDe(eventos);
  const primeiraCorreta = localizacoes.find((e) => e.correta);
  const primeiraCorrecao = doEstudante.find((e) => e.todosPassaram);
  const gestos = eventos.filter(
    (e): e is EventoDeNavegacao => e.tipo === 'navegacao' && e.gesto !== 'parou'
  );

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
    navegacoes: gestos.length,
    passosDistintosVisitados: passosDistintosVisitados(eventos),
    retrocessos: gestos.filter(
      (e) => e.gesto === 'voltar' || (e.gesto === 'arrastar' && e.para < e.de)
    ).length,
    tempoAtePrimeiraNavegacaoMs: gestos[0]?.t ?? null,
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
  /** Ausente, é do catálogo (D31). */
  origemDoExercicio?: OrigemDoExercicio;
  /** Rótulo do nível de andaime da sessão (D9), definido pela interface. */
  andaime?: string;
  /**
   * Serve apenas para julgar a declaração de localização, dentro do núcleo.
   * Não entra no registro exportado e não é devolvida a quem desenha a tela —
   * a interface pergunta e recebe o veredito, sem nunca ver a resposta.
   */
  linhaDoDefeito: number;
  /**
   * Todas as linhas em que apontar conta como acerto, quando é mais de uma — a
   * troca de ordem entre duas vizinhas (D30). Ausente, só `linhaDoDefeito`.
   * Mesma regra: fica no núcleo e não volta para a tela.
   */
  linhasAceitas?: number[];
  /** Fixa a identidade da sessão; sem ela, vale a do módulo no arquivamento. */
  participanteId?: string | null;
  /** Presente, a sessão é do percurso do estudo (D37). */
  estudo?: MarcaDoEstudo;
  /** Relógio monotônico. Injetável para teste. */
  agora?: () => number;
}

/** Identifica uma execução disparada, para completá-la quando o resultado chegar. */
export type ExecucaoDisparada = number;

/**
 * O que aconteceu com um clique no número da linha. Durante o intervalo entre
 * tentativas (D25) não há veredito — só quanto falta para a próxima poder ser
 * julgada, que é o que a interface precisa para dizer ao estudante que espere.
 */
export type DeclaracaoDeLocalizacao =
  | { julgada: true; correta: boolean }
  | { julgada: false; restanteMs: number };

export interface Sessao {
  readonly id: string;
  /**
   * Grava a execução no instante do disparo, ainda sem resultado. Até ser
   * concluída, é assim que ela aparece em qualquer retrato: interrompida, com
   * o código que foi executado.
   */
  iniciarExecucao(origem: OrigemDaExecucao, codigo: string): ExecucaoDisparada;
  /** Completa a execução com o resultado. Ignorada se ela já foi concluída. */
  concluirExecucao(execucao: ExecucaoDisparada, resultado: ResultadoExecucao): void;
  /** Disparo e resultado juntos, para quando o resultado já está na mão. */
  registrarExecucao(origem: OrigemDaExecucao, codigo: string, resultado: ResultadoExecucao): void;
  registrarEdicao(codigo: string): void;
  registrarDica(indice: number): void;
  /**
   * Registra a tentativa e devolve o veredito. Tentativas são ilimitadas, mas
   * entre duas julgadas há o intervalo de D25: o clique que chega antes dele é
   * registrado sem veredito, e não adia o fim do intervalo.
   */
  registrarLocalizacao(linha: number): DeclaracaoDeLocalizacao;
  /** O tutorial do participante abriu (D32). */
  registrarTutorialAberto(motivo: MotivoDoTutorial): void;
  /** O tutorial fechou, com o passo mais adiantado que chegou a mostrar. */
  registrarTutorialFechado(
    desfecho: DesfechoDoTutorial,
    passoAlcancado: number,
    totalDePassos: number
  ): void;
  /** Um gesto no reprodutor, menos o arrasto, que tem caminho próprio (D36). */
  registrarNavegacao(
    gesto: Exclude<GestoDeNavegacao, 'arrastar'>,
    de: number,
    para: number,
    total: number
  ): void;
  /** A reprodução parou sozinha. */
  registrarParada(motivo: MotivoDaParada, de: number, para: number, total: number): void;
  /**
   * Um movimento da barra. Movimentos seguidos se juntam num arrasto só, até
   * `encerrarArrasto` ou até qualquer outro evento entrar no log — o que
   * garante que o arrasto apareça antes dele na sequência, e não depois.
   */
  moverBarra(de: number, para: number, total: number): void;
  encerrarArrasto(): void;
  /** O fim da sessão no percurso do estudo (D37). */
  registrarEncerramento(motivo: MotivoDoEncerramento): void;
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
  /** Posições, no log, das execuções disparadas que ainda esperam resultado. */
  const emCurso = new Set<ExecucaoDisparada>();
  /** Instante da última tentativa julgada, no relógio monotônico; nulo antes da primeira. */
  let ultimaJulgada: number | null = null;

  const t = () => Math.round(agora() - referencia);

  /**
   * O arrasto da barra ainda aberto (D36). Fica fora do log até fechar,
   * porque o `para` e o `tFim` dele ainda mudam; um retrato tirado nesse meio
   * o leva como está.
   */
  let arrasto: EventoDeArrasto | null = null;

  const fecharArrasto = () => {
    if (arrasto) eventos.push(arrasto);
    arrasto = null;
  };

  /** Todo evento entra por aqui, para o arrasto aberto vir antes dele no log. */
  const anotar = (evento: Evento) => {
    fecharArrasto();
    eventos.push(evento);
  };

  const sessao: Sessao = {
    id,

    iniciarExecucao(origem, codigo) {
      // Entra no log já na forma interrompida: se a sessão acabar sem
      // resultado, é exatamente isto que deve ficar, e nenhum passo posterior
      // precisa lembrar de escrevê-lo. O resultado, quando vem, substitui.
      anotar({
        tipo: 'execucao',
        t: t(),
        origem,
        codigo,
        situacao: 'interrompida',
        tResultado: null,
        casosPassaram: 0,
        casosTotal: 0,
        todosPassaram: false,
        erro: null,
      });
      const posicao = eventos.length - 1;
      emCurso.add(posicao);
      return posicao;
    },

    concluirExecucao(execucao, resultado) {
      if (!emCurso.delete(execucao)) return;
      const disparo = eventos[execucao];
      if (disparo.tipo !== 'execucao') return;
      const casosTotal = resultado.casos.length;
      const casosPassaram = resultado.casos.filter((c) => c.passou).length;
      // Substitui o objeto em vez de alterá-lo: retratos já tirados guardam o
      // evento antigo, e não podem mudar por baixo de quem os arquivou.
      eventos[execucao] = {
        ...disparo,
        situacao: 'concluida',
        tResultado: t(),
        casosPassaram,
        casosTotal,
        // Sem casos não há aprovação: um erro de sintaxe devolve lista vazia, e
        // every() sobre lista vazia é true.
        todosPassaram: casosTotal > 0 && casosPassaram === casosTotal,
        erro: resultado.erro ?? null,
      };
    },

    registrarExecucao(origem, codigo, resultado) {
      sessao.concluirExecucao(sessao.iniciarExecucao(origem, codigo), resultado);
    },

    registrarEdicao(codigo) {
      anotar({ tipo: 'edicao', t: t(), codigo });
    },

    registrarDica(indice) {
      anotar({ tipo: 'dica', t: t(), indice });
    },

    registrarLocalizacao(linha) {
      const instante = agora();
      const tRelativo = Math.round(instante - referencia);
      const decorrido = ultimaJulgada === null ? Infinity : instante - ultimaJulgada;
      if (decorrido < INTERVALO_ENTRE_LOCALIZACOES_MS) {
        // Registrado, e não descartado: insistir durante a espera é dado. O
        // intervalo continua contando da última julgada — se cada clique o
        // reiniciasse, quem clica de novo por impaciência esperaria para sempre.
        anotar({ tipo: 'localizacao-no-intervalo', t: tRelativo, linha });
        return {
          julgada: false,
          restanteMs: Math.ceil(INTERVALO_ENTRE_LOCALIZACOES_MS - decorrido),
        };
      }
      ultimaJulgada = instante;
      const correta = (opcoes.linhasAceitas ?? [opcoes.linhaDoDefeito]).includes(linha);
      anotar({ tipo: 'localizacao', t: tRelativo, linha, correta });
      return { julgada: true, correta };
    },

    registrarTutorialAberto(motivo) {
      anotar({ tipo: 'tutorial-aberto', t: t(), motivo });
    },

    registrarTutorialFechado(desfecho, passoAlcancado, totalDePassos) {
      anotar({ tipo: 'tutorial-fechado', t: t(), desfecho, passoAlcancado, totalDePassos });
    },

    registrarNavegacao(gesto, de, para, total) {
      anotar({ tipo: 'navegacao', t: t(), gesto, de, para, total });
    },

    registrarParada(motivo, de, para, total) {
      anotar({ tipo: 'navegacao', t: t(), gesto: 'parou', motivo, de, para, total });
    },

    moverBarra(de, para, total) {
      const instante = t();
      // Outra execução na tela é outro arrasto, mesmo sem pausa no meio.
      if (arrasto && arrasto.total === total) {
        arrasto = { ...arrasto, para, tFim: instante };
        return;
      }
      fecharArrasto();
      arrasto = { tipo: 'navegacao', t: instante, gesto: 'arrastar', de, para, total, tFim: instante };
    },

    encerrarArrasto() {
      fecharArrasto();
    },

    registrarEncerramento(motivo) {
      anotar({ tipo: 'encerramento', t: t(), motivo });
    },

    registro() {
      // O arrasto aberto entra no retrato sem ser fechado: quem continua
      // arrastando depois do retrato continua o mesmo arrasto.
      const comArrasto = arrasto ? [...eventos, arrasto] : [...eventos];
      return {
        versao: VERSAO_DO_REGISTRO,
        id,
        exercicioId: opcoes.exercicioId,
        origemDoExercicio: opcoes.origemDoExercicio ?? 'catalogo',
        participanteId: opcoes.participanteId ?? participanteAtual,
        andaime: opcoes.andaime ?? null,
        // Só quando existe: a sessão de fora do estudo continua com a mesma
        // forma de antes.
        ...(opcoes.estudo ? { estudo: opcoes.estudo } : {}),
        instanteDeInicio,
        duracaoTotalMs: t(),
        eventos: comArrasto,
        resumo: resumirSessao(comArrasto),
      };
    },
  };
  return sessao;
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

/**
 * Se ainda há sessão desta identidade sem confirmação do banco. É o que a área
 * do estudo consulta antes de trocar de identidade no fim do percurso (D37):
 * depois da troca, o que ficou pendente não sobe mais pela identidade nova, e
 * o RLS recusaria se subisse.
 */
export function haPendentesDe(participanteId: string): boolean {
  return pendentesDe(participanteId) > 0;
}

/** Quantas sessões desta identidade ainda não têm confirmação do banco. */
export function pendentesDe(participanteId: string): number {
  return pendentes().filter((s) => s.participanteId === participanteId).length;
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
