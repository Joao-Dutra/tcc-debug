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
 * O objeto é montado no próprio ponto de inserção, portanto fecha sobre o
 * escopo local — é assim que conseguimos ler variáveis internas a funções sem
 * escrever um interpretador.
 *
 * Só entram no objeto as variáveis DECLARADAS ANTES da instrução instrumentada,
 * evitando erro de zona morta temporal (TDZ) com let/const.
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

/** Monta o nó de AST correspondente à chamada da sonda. */
function chamadaDaSonda(linha: number, visiveis: string[]): NoQualquer {
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      optional: false,
      callee: { type: 'Identifier', name: NOME_SONDA },
      arguments: [
        { type: 'Literal', value: linha },
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
        },
      ],
    },
  } as unknown as NoQualquer;
}

/**
 * Percorre um corpo de instruções inserindo a sonda antes de cada uma.
 * `herdadas` são as variáveis já visíveis vindas de escopos externos.
 */
function instrumentarCorpo(corpo: NoQualquer[], herdadas: Declarada[]): NoQualquer[] {
  const locais: Declarada[] = [];
  const saida: NoQualquer[] = [];

  for (const instrucao of corpo) {
    const visiveis = [...herdadas, ...locais]
      .filter((d) => d.posicao <= instrucao.start)
      .map((d) => d.nome);

    // Nomes repetidos por sombreamento: mantém apenas a última ocorrência.
    const unicas = [...new Set(visiveis)];

    if (instrucao.loc) {
      saida.push(chamadaDaSonda(instrucao.loc.start.line, unicas));
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

  return saida;
}

/** Percorre recursivamente um nó, instrumentando todos os blocos encontrados. */
function percorrer(no: NoQualquer, herdadas: Declarada[]): NoQualquer {
  if (!no || typeof no !== 'object') return no;

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
        ? instrumentarCorpo(valor as NoQualquer[], escopo)
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
