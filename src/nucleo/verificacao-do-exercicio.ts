import { analisarDivergencia } from './divergencia';
import { avisosDeEstilo as avisosDoCodigo } from './estilo';
import { instrumentar } from './instrumentar';
import { naoTerminou } from './limites';
import { compararVersoes } from './quadro-denuncia';
import type { AvisoDeEstilo } from './estilo';
import type {
  CasoDeTeste,
  CategoriaDefeito,
  Exercicio,
  Instantaneo,
  ResultadoExecucao,
  TipoEstrutura,
} from './tipos';

/**
 * A verificação de um exercício escrito por um professor, na submissão (D31).
 *
 * As regras são as mesmas do catálogo, e moram no núcleo exatamente por isso:
 * o defeito único (D30), o quadro-denúncia (D16) e o estilo (D17) são as
 * funções que os testes do catálogo usam. O que muda é quem executa — aqui, o
 * Worker de verdade, no navegador de quem submete — e que o resultado vira um
 * relatório para uma pessoa, com a razão de cada recusa, em vez de um teste
 * vermelho.
 *
 * Roda no navegador do professor ao enviar, e de novo no do pesquisador ao
 * publicar. Não é barreira contra quem fala direto com a API: o acesso à área
 * é restrito a pessoas selecionadas, e a decisão está registrada em D31.
 */

/** Uma variável que o desenho da estrutura procura pelo nome. */
export interface NomeEsperado {
  nome: string;
  /** O que ela é, na frase que o formulário mostra ao professor. */
  papel: string;
}

export interface NomesDaEstrutura {
  /** Precisam existir com este nome exato: é por eles que o desenho acha a estrutura. */
  obrigatorios: NomeEsperado[];
  /** O desenho usa se existirem. */
  opcionais: NomeEsperado[];
  /**
   * Só o vetor: os marcadores de posição são declarados pelo exercício, porque
   * `j` e `temp` são os dois números e só a declaração os separa (D27).
   */
  declaraMarcadores: boolean;
}

/**
 * O contrato de nomes de cada estrutura. Os desenhos de pilha, fila e lista
 * leem as variáveis pelo nome, e o formulário mostra este contrato antes de o
 * professor começar a escrever — recusar só na verificação seria deixá-lo
 * descobrir a regra depois de escrever o programa inteiro.
 */
export const NOMES_DA_ESTRUTURA: Record<TipoEstrutura, NomesDaEstrutura> = {
  vetor: {
    obrigatorios: [{ nome: 'itens', papel: 'o vetor' }],
    opcionais: [],
    declaraMarcadores: true,
  },
  pilha: {
    obrigatorios: [
      { nome: 'itens', papel: 'o vetor que guarda a pilha' },
      { nome: 'topo', papel: 'a posição do topo' },
    ],
    opcionais: [{ nome: 'capacidade', papel: 'o tamanho fixo, se a pilha tiver um' }],
    declaraMarcadores: false,
  },
  fila: {
    obrigatorios: [
      { nome: 'itens', papel: 'o vetor que guarda a fila' },
      { nome: 'inicio', papel: 'a posição de quem sai' },
      { nome: 'fim', papel: 'a posição de quem entrou por último' },
    ],
    opcionais: [],
    declaraMarcadores: false,
  },
  'lista-encadeada': {
    obrigatorios: [{ nome: 'cabeca', papel: 'o primeiro nó' }],
    opcionais: [{ nome: 'atual', papel: 'o nó que a operação percorre' }],
    declaraMarcadores: false,
  },
};

/** O que o formulário do professor produz, e o que fica guardado no banco. */
export interface RascunhoDeExercicio {
  titulo: string;
  enunciado: string;
  estrutura: TipoEstrutura;
  dificuldade: 1 | 2 | 3;
  categoriaDefeito: CategoriaDefeito;
  codigoCorreto: string;
  codigoComDefeito: string;
  casosDeTeste: CasoDeTeste[];
  dicas: string[];
  /** Só no vetor: as posições, em ordem; a primeira é a principal (D27). */
  marcadores: string[];
  /** Só no vetor: variáveis de valor desenhadas em caixas, como a temporária. */
  variaveisDeValor: string[];
}

/** As variáveis que o desenho recebe, fixas pela estrutura (D31). */
export function variaveisObservadasDe(rascunho: RascunhoDeExercicio): string[] {
  const contrato = NOMES_DA_ESTRUTURA[rascunho.estrutura];
  const nomes = [
    ...contrato.obrigatorios.map((n) => n.nome),
    ...contrato.opcionais.map((n) => n.nome),
  ];
  if (contrato.declaraMarcadores) nomes.push(...rascunho.marcadores, ...rascunho.variaveisDeValor);
  return [...new Set(nomes)];
}

/** O exercício que o rascunho vira, com o que a verificação deriva dele. */
export function exercicioDoRascunho(
  id: string,
  rascunho: RascunhoDeExercicio,
  derivado: { linhaDoDefeito: number; linhasAceitas: number[] }
): Exercicio {
  const contrato = NOMES_DA_ESTRUTURA[rascunho.estrutura];
  return {
    id,
    // Um exercício que nasce de um rascunho é sempre de professor: o catálogo
    // mora no repositório (D31).
    origem: 'professor',
    titulo: rascunho.titulo,
    enunciado: rascunho.enunciado,
    estrutura: rascunho.estrutura,
    categoriaDefeito: rascunho.categoriaDefeito,
    dificuldade: rascunho.dificuldade,
    codigoComDefeito: rascunho.codigoComDefeito,
    codigoCorreto: rascunho.codigoCorreto,
    linhaDoDefeito: derivado.linhaDoDefeito,
    ...(derivado.linhasAceitas.length > 1 ? { linhasAceitas: derivado.linhasAceitas } : {}),
    variaveisObservadas: variaveisObservadasDe(rascunho),
    ...(contrato.declaraMarcadores ? { marcadores: rascunho.marcadores } : {}),
    casosDeTeste: rascunho.casosDeTeste,
    dicas: rascunho.dicas,
  };
}

export interface ItemDaVerificacao {
  chave:
    | 'modelo'
    | 'defeito-unico'
    | 'sintaxe'
    | 'termina'
    | 'correto-passa'
    | 'defeito-quebra'
    | 'nomes'
    | 'quadro-denuncia';
  /** A regra, como pergunta que o professor lê de relance. */
  titulo: string;
  aprovado: boolean;
  /** Por que passou ou por que não — na recusa, o que fazer. */
  explicacao: string;
}

export interface RelatorioDaVerificacao {
  /** Todos os itens aprovados. Os avisos não contam. */
  aprovado: boolean;
  itens: ItemDaVerificacao[];
  /** Não bloqueiam, mas o professor precisa ver. */
  avisos: string[];
  avisosDeEstilo: { versao: 'com defeito' | 'correta'; aviso: AvisoDeEstilo }[];
  /** Presente quando o defeito é único: o que a publicação grava. */
  derivado?: { linhaDoDefeito: number; linhasAceitas: number[] };
}

/** Quem executa: o Worker de verdade no navegador, o de mentira nos testes. */
export type Executor = (exercicio: Exercicio, codigo: string) => Promise<ResultadoExecucao>;

const TITULOS: Record<ItemDaVerificacao['chave'], string> = {
  modelo: 'O modelo está preenchido?',
  'defeito-unico': 'O defeito é um só, numa linha que se possa apontar?',
  sintaxe: 'As duas versões compilam?',
  termina: 'As duas versões rodam até o fim?',
  'correto-passa': 'O código correto passa em todos os casos?',
  'defeito-quebra': 'O código com defeito falha em algum caso?',
  nomes: 'O código usa os nomes que o desenho procura?',
  'quadro-denuncia': 'O defeito aparece no desenho?',
};

const item = (
  chave: ItemDaVerificacao['chave'],
  aprovado: boolean,
  explicacao: string
): ItemDaVerificacao => ({ chave, titulo: TITULOS[chave], aprovado, explicacao });

/** Item que depende de outro que falhou: não há como conferi-lo. */
const naoConferido = (chave: ItemDaVerificacao['chave'], porque: string) =>
  item(chave, false, `Não conferido: ${porque}`);

function faltasNoModelo(rascunho: RascunhoDeExercicio): string[] {
  const faltas: string[] = [];
  if (!rascunho.titulo.trim()) faltas.push('o título');
  if (!rascunho.enunciado.trim()) faltas.push('o enunciado');
  if (!rascunho.codigoCorreto.trim()) faltas.push('o código correto');
  if (!rascunho.codigoComDefeito.trim()) faltas.push('o código com defeito');
  if (rascunho.casosDeTeste.length === 0) faltas.push('ao menos um caso de teste');
  if (rascunho.casosDeTeste.some((c) => !c.descricao.trim() || !c.expressao.trim())) {
    faltas.push('a descrição e a expressão de cada caso');
  }
  // Três, como no catálogo: o apoio oferece três dicas (D9), e um exercício
  // com menos daria menos apoio sob o mesmo nome de nível.
  if (rascunho.dicas.length !== 3 || rascunho.dicas.some((d) => !d.trim())) {
    faltas.push('exatamente três dicas');
  }
  if (NOMES_DA_ESTRUTURA[rascunho.estrutura].declaraMarcadores && rascunho.marcadores.length === 0) {
    faltas.push('ao menos um marcador de posição');
  }
  return faltas;
}

function erroDeSintaxe(codigo: string): string | null {
  try {
    instrumentar(codigo);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Os nomes que a versão não produz em quadro nenhum. */
function nomesAusentes(nomes: string[], instantaneos: Instantaneo[]): string[] {
  return nomes.filter((nome) => !instantaneos.some((i) => nome in i.variaveis));
}

const lista = (itens: string[]) =>
  itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;

export async function verificarExercicio(
  rascunho: RascunhoDeExercicio,
  executar: Executor
): Promise<RelatorioDaVerificacao> {
  const itens: ItemDaVerificacao[] = [];
  const avisos: string[] = [];

  const faltas = faltasNoModelo(rascunho);
  itens.push(
    item(
      'modelo',
      faltas.length === 0,
      faltas.length === 0 ? 'Todos os campos estão preenchidos.' : `Falta ${lista(faltas)}.`
    )
  );

  const avisosDeEstilo = [
    ...avisosDoCodigo(rascunho.codigoComDefeito).map((aviso) => ({
      versao: 'com defeito' as const,
      aviso,
    })),
    ...avisosDoCodigo(rascunho.codigoCorreto).map((aviso) => ({
      versao: 'correta' as const,
      aviso,
    })),
  ];

  const divergencia = analisarDivergencia(rascunho.codigoCorreto, rascunho.codigoComDefeito);
  const derivado =
    divergencia.tipo === 'recusada'
      ? undefined
      : { linhaDoDefeito: divergencia.linha, linhasAceitas: divergencia.linhasAceitas };
  itens.push(
    item(
      'defeito-unico',
      derivado !== undefined,
      divergencia.tipo === 'recusada'
        ? divergencia.motivo
        : divergencia.tipo === 'linha-alterada'
          ? `Uma linha alterada: a ${divergencia.linha}. É ela que conta como localização.`
          : `Uma linha fora do lugar. Contam como localização ${
              divergencia.linhasAceitas.length > 1 ? 'as linhas' : 'a linha'
            } ${lista(divergencia.linhasAceitas.map(String))}.`
    )
  );

  const erroCorreto = erroDeSintaxe(rascunho.codigoCorreto);
  const erroDefeito = erroDeSintaxe(rascunho.codigoComDefeito);
  const compilam = erroCorreto === null && erroDefeito === null;
  itens.push(
    item(
      'sintaxe',
      compilam,
      compilam
        ? 'As duas versões compilam.'
        : [
            erroCorreto && `O código correto não compila: ${erroCorreto}.`,
            erroDefeito && `O código com defeito não compila: ${erroDefeito}.`,
          ]
            .filter(Boolean)
            .join(' ')
    )
  );

  if (!compilam) {
    const porque = 'as duas versões precisam compilar antes.';
    for (const chave of ['termina', 'correto-passa', 'defeito-quebra', 'nomes', 'quadro-denuncia'] as const) {
      itens.push(naoConferido(chave, porque));
    }
    return { aprovado: false, itens, avisos, avisosDeEstilo, derivado };
  }

  // Um exercício provisório só para executar: o id e a linha não entram na
  // execução, e as variáveis observadas são as do contrato da estrutura.
  const provisorio = exercicioDoRascunho('verificacao', rascunho, {
    linhaDoDefeito: derivado?.linhaDoDefeito ?? 1,
    linhasAceitas: derivado?.linhasAceitas ?? [1],
  });
  const [comDefeito, correto] = await Promise.all([
    executar(provisorio, rascunho.codigoComDefeito),
    executar(provisorio, rascunho.codigoCorreto),
  ]);

  const problemaDeExecucao = (versao: string, r: ResultadoExecucao): string | null => {
    if (!r.erro) return null;
    if (naoTerminou(r.erro)) {
      return (
        `${versao} não termina: foi cortado pelo limite de execução. O estudante receberia ` +
        'o aviso de laço infinito, e não um quadro que mostre o defeito.'
      );
    }
    return `${versao} lança erro ao rodar: ${r.erro}.`;
  };
  const problemas = [
    problemaDeExecucao('O código correto', correto),
    problemaDeExecucao('O código com defeito', comDefeito),
  ].filter((p): p is string => p !== null);
  itens.push(
    item(
      'termina',
      problemas.length === 0,
      problemas.length === 0 ? 'As duas versões rodam até o fim, sem erro.' : problemas.join(' ')
    )
  );

  if (problemas.length > 0) {
    const porque = 'as duas versões precisam rodar até o fim antes.';
    for (const chave of ['correto-passa', 'defeito-quebra', 'nomes', 'quadro-denuncia'] as const) {
      itens.push(naoConferido(chave, porque));
    }
    return { aprovado: false, itens, avisos, avisosDeEstilo, derivado };
  }

  const falhasDoCorreto = correto.casos.filter((c) => !c.passou).map((c) => `"${c.descricao}"`);
  itens.push(
    item(
      'correto-passa',
      falhasDoCorreto.length === 0,
      falhasDoCorreto.length === 0
        ? `Passa nos ${correto.casos.length} casos.`
        : `Falha em ${lista(falhasDoCorreto)}. Confira a expressão e o valor esperado do caso.`
    )
  );

  const quebrados = comDefeito.casos.filter((c) => !c.passou).length;
  itens.push(
    item(
      'defeito-quebra',
      quebrados > 0,
      quebrados > 0
        ? `Falha em ${quebrados} de ${comDefeito.casos.length} casos.`
        : 'Passa em todos os casos. Um defeito que não quebra caso nenhum não se distingue do ' +
            'programa certo — é o que D28 chamou de mutante equivalente.'
    )
  );
  if (quebrados > 0 && quebrados === comDefeito.casos.length) {
    avisos.push(
      'O código com defeito falha em todos os casos. Vale ter ao menos um que passe: é o que ' +
        'mostra ao estudante que o resto do programa está certo.'
    );
  }

  const contrato = NOMES_DA_ESTRUTURA[rascunho.estrutura];
  const esperados = [
    ...contrato.obrigatorios.map((n) => n.nome),
    ...(contrato.declaraMarcadores ? [...rascunho.marcadores, ...rascunho.variaveisDeValor] : []),
  ];
  const ausentes = [
    ...new Set([
      ...nomesAusentes(esperados, comDefeito.instantaneos),
      ...nomesAusentes(esperados, correto.instantaneos),
    ]),
  ];
  itens.push(
    item(
      'nomes',
      ausentes.length === 0,
      ausentes.length === 0
        ? 'Todas as variáveis que o desenho procura aparecem na execução.'
        : `${lista(ausentes)} não ${ausentes.length > 1 ? 'aparecem' : 'aparece'} em quadro ` +
            'nenhum da execução, e o desenho fica sem ' +
            `${ausentes.length > 1 ? 'elas' : 'ela'}. Use exatamente os nomes que o formulário ` +
            'mostra para a estrutura.'
    )
  );

  const comparacao = compararVersoes(
    provisorio.variaveisObservadas,
    comDefeito.instantaneos,
    correto.instantaneos
  );
  itens.push(
    item(
      'quadro-denuncia',
      comparacao.aprovada,
      comparacao.aprovada
        ? `As versões divergem em ${comparacao.quadrosDivergentes} quadros, e o desenho ` +
            'atravessa estados diferentes com e sem o defeito.'
        : comparacao.trajetoriasIdenticas
          ? 'As duas versões atravessam os mesmos estados no desenho: o defeito muda o valor ' +
            'devolvido ou o momento das mudanças, mas não o que a visualização mostra. O ' +
            'estudante não teria como encontrá-lo pelo desenho (D16).'
          : 'As versões divergem em um quadro só, e o estudante dificilmente o veria (D16).'
    )
  );

  return {
    aprovado: itens.every((i) => i.aprovado),
    itens,
    avisos,
    avisosDeEstilo,
    derivado,
  };
}
