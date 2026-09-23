import { parse } from 'acorn';
import { generate } from 'astring';
import type { Node } from 'acorn';

/**
 * Reescreve o código do exercício inserindo uma chamada a __passo() antes de
 * cada instrução, de modo que a execução produza uma sequência de instantâneos.
 *
 * A chamada injetada tem a forma:
 *
 *     __passo(<linha>, { <variaveis visiveis> });
 *
 * Quando a instrução é uma cópia simples de um lugar para outro, vai um
 * terceiro argumento dizendo de onde para onde o valor vai (D27):
 *
 *     __passo(<linha>, { ... }, { destino: {...}, origem: {...} });
 *
 * O objeto é montado no próprio ponto de inserção, portanto fecha sobre o
 * escopo local — é assim que conseguimos ler variáveis internas a funções sem
 * escrever um interpretador.
 *
 * Só entram no objeto as variáveis DECLARADAS ANTES da instrução instrumentada,
 * evitando erro de zona morta temporal (TDZ) com let/const.
 *
 * Depois da última instrução do programa vai mais uma sonda, com linha nula: é
 * o quadro final (D1). Sem ela, o efeito da última instrução executada nunca
 * chegava a instantâneo nenhum, e o último quadro mostrava a estrutura antes
 * dessa instrução — mentia sobre o resultado do programa.
 */

const NOME_SONDA = '__passo';

interface Declarada {
  nome: string;
  posicao: number;
}

type NoQualquer = Node & Record<string, any>;

/** Coleta os nomes ligados por um padrão de destructuring ou identificador. */
function nomesDoPadrao(padrao: NoQualquer, destino: string[]): void {
  if (!padrao) return;
  switch (padrao.type) {
    case 'Identifier':
      destino.push(padrao.name);
      break;
    case 'ObjectPattern':
      for (const prop of padrao.properties) {
        nomesDoPadrao(prop.type === 'RestElement' ? prop.argument : prop.value, destino);
      }
      break;
    case 'ArrayPattern':
      for (const el of padrao.elements) if (el) nomesDoPadrao(el, destino);
      break;
    case 'AssignmentPattern':
      nomesDoPadrao(padrao.left, destino);
      break;
    case 'RestElement':
      nomesDoPadrao(padrao.argument, destino);
      break;
  }
}

/** Propriedade de objeto literal, na forma que o astring imprime. */
function propriedade(nome: string, valor: NoQualquer): NoQualquer {
  return {
    type: 'Property',
    kind: 'init',
    method: false,
    shorthand: false,
    computed: false,
    key: { type: 'Identifier', name: nome },
    value: valor,
  } as unknown as NoQualquer;
}

const literal = (valor: string | number | null): NoQualquer =>
  ({ type: 'Literal', value: valor }) as unknown as NoQualquer;

const objeto = (propriedades: NoQualquer[]): NoQualquer =>
  ({ type: 'ObjectExpression', properties: propriedades }) as unknown as NoQualquer;

/**
 * Expressão que pode ser avaliada de novo dentro da sonda sem mudar o
 * programa. A sonda roda ANTES da instrução, e avaliar ali um índice com
 * efeito colateral — `itens[i++]` — executaria esse efeito duas vezes. Na
 * dúvida, a instrução não é anotada.
 */
function semEfeito(no: NoQualquer): boolean {
  if (!no || typeof no !== 'object') return false;
  switch (no.type) {
    case 'Identifier':
    case 'Literal':
      return true;
    case 'BinaryExpression':
      return semEfeito(no.left) && semEfeito(no.right);
    case 'UnaryExpression':
      return ['-', '+', '!', '~'].includes(no.operator) && semEfeito(no.argument);
    case 'MemberExpression':
      return (
        semEfeito(no.object) &&
        (no.computed ? semEfeito(no.property) : no.property?.type === 'Identifier')
      );
    default:
      return false;
  }
}

/** Cópia do nó, para a sonda não compartilhar objeto com o programa. */
const clonar = (no: NoQualquer): NoQualquer => JSON.parse(JSON.stringify(no)) as NoQualquer;

/**
 * O lugar que uma expressão designa, como objeto literal a ser montado em
 * tempo de execução: `{ variavel: 'temp' }` ou `{ vetor: 'itens', indice: j }`,
 * com o índice avaliado na sonda. Nulo quando não é lugar simples.
 */
function lugarDe(no: NoQualquer): NoQualquer | null {
  if (!no || typeof no !== 'object') return null;
  if (no.type === 'Identifier') {
    return objeto([propriedade('variavel', literal(no.name))]);
  }
  if (
    no.type === 'MemberExpression' &&
    no.computed &&
    no.object?.type === 'Identifier' &&
    semEfeito(no.property)
  ) {
    return objeto([
      propriedade('vetor', literal(no.object.name)),
      propriedade('indice', clonar(no.property)),
    ]);
  }
  return null;
}

/**
 * A escrita que a instrução vai fazer, quando ela for uma cópia simples de um
 * lugar para outro (D27). O desenho usa isso para mostrar o valor mudando de
 * lugar, em vez de aparecer trocado de um quadro para o outro.
 */
function escritaDaInstrucao(instrucao: NoQualquer): NoQualquer | null {
  let alvo: NoQualquer | null = null;
  let fonte: NoQualquer | null = null;

  if (
    instrucao.type === 'ExpressionStatement' &&
    instrucao.expression?.type === 'AssignmentExpression' &&
    instrucao.expression.operator === '='
  ) {
    alvo = lugarDe(instrucao.expression.left);
    fonte = lugarDe(instrucao.expression.right);
  } else if (instrucao.type === 'VariableDeclaration' && instrucao.declarations.length === 1) {
    const declaracao = instrucao.declarations[0];
    if (declaracao.id?.type === 'Identifier' && declaracao.init) {
      alvo = objeto([propriedade('variavel', literal(declaracao.id.name))]);
      fonte = lugarDe(declaracao.init);
    }
  }

  if (!alvo || !fonte) return null;
  return objeto([propriedade('destino', alvo), propriedade('origem', fonte)]);
}

/** Monta o nó de AST correspondente à chamada da sonda. Linha nula: quadro final. */
function chamadaDaSonda(
  linha: number | null,
  visiveis: string[],
  escrita: NoQualquer | null = null
): NoQualquer {
  const argumentos: NoQualquer[] = [
    literal(linha),
    {
      type: 'ObjectExpression',
      properties: visiveis.map((nome) => ({
        type: 'Property',
        kind: 'init',
        method: false,
        shorthand: true,
        computed: false,
        key: { type: 'Identifier', name: nome },
        value: { type: 'Identifier', name: nome },
      })),
    } as unknown as NoQualquer,
  ];
  if (escrita) argumentos.push(escrita);

  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      optional: false,
      callee: { type: 'Identifier', name: NOME_SONDA },
      arguments: argumentos,
    },
  } as unknown as NoQualquer;
}

/**
 * Percorre um corpo de instruções inserindo a sonda antes de cada uma.
 * `herdadas` são as variáveis já visíveis vindas de escopos externos.
 * `comQuadroFinal` acrescenta a sonda de depois da última instrução — só no
 * corpo do programa, que é onde a execução termina.
 */
function instrumentarCorpo(
  corpo: NoQualquer[],
  herdadas: Declarada[],
  comQuadroFinal = false
): NoQualquer[] {
  const locais: Declarada[] = [];
  const saida: NoQualquer[] = [];

  for (const instrucao of corpo) {
    const visiveis = [...herdadas, ...locais]
      .filter((d) => d.posicao <= instrucao.start)
      .map((d) => d.nome);

    // Nomes repetidos por sombreamento: mantém apenas a última ocorrência.
    const unicas = [...new Set(visiveis)];

    if (instrucao.loc) {
      // A escrita vai na sonda de ANTES da instrução, com os índices ainda por
      // avaliar; quem a guarda até o quadro seguinte — o que a escrita produz
      // — é o Worker.
      saida.push(chamadaDaSonda(instrucao.loc.start.line, unicas, escritaDaInstrucao(instrucao)));
    }
    saida.push(percorrer(instrucao, [...herdadas, ...locais]));

    // Declarações desta instrução passam a valer para as seguintes.
    if (instrucao.type === 'VariableDeclaration') {
      for (const d of instrucao.declarations) {
        const nomes: string[] = [];
        nomesDoPadrao(d.id, nomes);
        for (const n of nomes) locais.push({ nome: n, posicao: instrucao.end });
      }
    } else if (instrucao.type === 'FunctionDeclaration' && instrucao.id) {
      locais.push({ nome: instrucao.id.name, posicao: 0 }); // hoisting
    }
  }

  // Ao fim do programa, tudo o que foi declarado nele está visível. Variáveis
  // locais a funções não existem mais aqui e ficam de fora, como no programa.
  if (comQuadroFinal) {
    saida.push(chamadaDaSonda(null, [...new Set([...herdadas, ...locais].map((d) => d.nome))]));
  }

  return saida;
}

/** Percorre recursivamente um nó, instrumentando todos os blocos encontrados. */
function percorrer(no: NoQualquer, herdadas: Declarada[]): NoQualquer {
  if (!no || typeof no !== 'object') return no;

  // Corpo de classe não recebe sonda (D1). A classe vem no topo do programa, e
  // a sonda dentro do construtor só enxergaria o que foi declarado antes dela
  // — nenhuma variável da estrutura. Cada `new No(...)` feito dentro de uma
  // função virava quadros vazios, e o desenho sumia no meio da operação. Sem
  // sonda, o construtor é um passo só, no ponto do `new`.
  if (no.type === 'ClassDeclaration' || no.type === 'ClassExpression') return no;

  // Ao entrar numa função, os parâmetros passam a ser visíveis.
  let escopo = herdadas;
  if (
    no.type === 'FunctionDeclaration' ||
    no.type === 'FunctionExpression' ||
    no.type === 'ArrowFunctionExpression'
  ) {
    const nomes: string[] = [];
    for (const p of no.params) nomesDoPadrao(p, nomes);
    escopo = [...herdadas, ...nomes.map((nome) => ({ nome, posicao: 0 }))];
  }

  for (const chave of Object.keys(no)) {
    if (chave === 'type' || chave === 'start' || chave === 'end' || chave === 'loc') continue;
    const valor = no[chave];

    if (Array.isArray(valor)) {
      const ehCorpo =
        (no.type === 'BlockStatement' || no.type === 'Program') && chave === 'body';
      no[chave] = ehCorpo
        ? instrumentarCorpo(valor as NoQualquer[], escopo, no.type === 'Program')
        : valor.map((v) => (v && typeof v === 'object' ? percorrer(v, escopo) : v));
    } else if (valor && typeof valor === 'object' && 'type' in valor) {
      no[chave] = percorrer(valor as NoQualquer, escopo);
    }
  }

  return no;
}

export function instrumentar(codigo: string): string {
  const ast = parse(codigo, {
    ecmaVersion: 2022,
    sourceType: 'script',
    locations: true,
  }) as unknown as NoQualquer;

  const instrumentado = percorrer(ast, []);
  return generate(instrumentado as never);
}
