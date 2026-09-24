import { parse } from 'acorn';
import { full } from 'acorn-walk';
import type { AnyNode } from 'acorn';

/**
 * Aviso de estilo: construções que só existem em JavaScript (D17).
 *
 * O público são estudantes que aprenderam algoritmos em Java ou em C. Se o
 * estudante tropeça na sintaxe, a ferramenta passa a medir desconhecimento de
 * linguagem em vez de habilidade de depuração, e as duas coisas não se separam
 * depois nos dados. O catálogo segue a regra por revisão; o código de um
 * professor passa por aqui na submissão.
 *
 * É aviso, e não recusa: a lista de D17 não esgota a regra, e o critério — um
 * estudante de Java ou C entende a linha sem consultar nada? — pede
 * julgamento. O que ela faz é apontar, linha a linha, o que certamente não
 * passa, e dizer o que usar no lugar.
 *
 * O mesmo verificador roda sobre o catálogo num teste, que exige zero avisos:
 * é o que garante que ele não acusa o que o próprio projeto usa.
 */

export interface AvisoDeEstilo {
  linha: number;
  /** A construção, com o nome que o professor procuraria. */
  construcao: string;
  /** O que usar no lugar, numa frase. */
  sugestao: string;
}

/**
 * Métodos que em Java e em C não existem para vetor. `indexOf`, `charAt` e
 * `concat` ficam de fora: o `String` de Java tem os três com o mesmo nome e o
 * mesmo sentido, e a pilha que inverte uma palavra usa `charAt`.
 */
const METODOS_DE_VETOR = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'slice',
  'map',
  'filter',
  'forEach',
  'reduce',
  'reduceRight',
  'some',
  'every',
  'find',
  'findIndex',
  'includes',
  'join',
  'reverse',
  'sort',
  'flat',
  'flatMap',
  'fill',
]);

function avisoDoNo(no: AnyNode): Omit<AvisoDeEstilo, 'linha'> | null {
  switch (no.type) {
    case 'VariableDeclaration':
      if (no.kind === 'let' || no.kind === 'const') {
        return {
          construcao: `declaração com ${no.kind}`,
          sugestao: 'use var, como o resto do catálogo.',
        };
      }
      return null;
    case 'ArrowFunctionExpression':
      return {
        construcao: 'função com =>',
        sugestao: 'declare a função com function e um nome.',
      };
    case 'TemplateLiteral':
      return {
        construcao: 'texto entre crases, com ${...}',
        sugestao: "monte o texto com aspas e +, como em 'topo = ' + topo.",
      };
    case 'ObjectPattern':
    case 'ArrayPattern':
      return {
        construcao: 'desestruturação',
        sugestao: 'leia cada campo ou posição numa variável própria, uma por linha.',
      };
    case 'SpreadElement':
    case 'RestElement':
      return {
        construcao: 'espalhamento (...)',
        sugestao: 'copie ou passe os elementos um a um, com um laço.',
      };
    case 'BinaryExpression':
      if (no.operator === '===' || no.operator === '!==') {
        return {
          construcao: `comparação com ${no.operator}`,
          sugestao: `use ${no.operator === '===' ? '==' : '!='}.`,
        };
      }
      return null;
    case 'LogicalExpression':
      if (no.operator === '??') {
        return {
          construcao: 'operador ??',
          sugestao: 'escreva a condição com if e ==.',
        };
      }
      return null;
    case 'ChainExpression':
      return {
        construcao: 'acesso com ?.',
        sugestao: 'confira antes com if (x != null) e acesse com o ponto.',
      };
    case 'ForOfStatement':
    case 'ForInStatement':
      return {
        construcao: no.type === 'ForOfStatement' ? 'laço for...of' : 'laço for...in',
        sugestao: 'use o laço com índice: for (var i = 0; i < n; i = i + 1).',
      };
    case 'CallExpression': {
      const alvo = no.callee;
      if (
        alvo.type === 'MemberExpression' &&
        !alvo.computed &&
        alvo.property.type === 'Identifier' &&
        METODOS_DE_VETOR.has(alvo.property.name)
      ) {
        return {
          construcao: `método de vetor ${alvo.property.name}()`,
          sugestao: 'use atribuição por índice e um laço, como em itens[topo] = valor.',
        };
      }
      return null;
    }
    case 'AssignmentExpression':
      if (
        no.left.type === 'MemberExpression' &&
        !no.left.computed &&
        no.left.property.type === 'Identifier' &&
        no.left.property.name === 'length'
      ) {
        return {
          construcao: 'atribuição a length',
          sugestao:
            'o vetor não encolhe em Java nem em C: guarde o tamanho numa variável, como o topo da pilha (D18).',
        };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Os avisos do código, em ordem de linha, sem repetir a mesma construção na
 * mesma linha. Código que não compila não tem aviso: a sintaxe é conferida em
 * outro lugar, e com a mensagem certa.
 */
export function avisosDeEstilo(codigo: string): AvisoDeEstilo[] {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(codigo, { ecmaVersion: 2022, sourceType: 'script', locations: true });
  } catch {
    return [];
  }

  const vistos = new Set<string>();
  const avisos: AvisoDeEstilo[] = [];
  full(ast, (no) => {
    // O caminhante entrega o nó pelo tipo geral; todo nó que ele visita é um
    // dos da união, e é ela que dá nome aos campos de cada tipo.
    const aviso = avisoDoNo(no as AnyNode);
    const linha = no.loc?.start.line;
    if (!aviso || linha === undefined) return;
    const chave = `${linha}:${aviso.construcao}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    avisos.push({ linha, ...aviso });
  });
  return avisos.sort((a, b) => a.linha - b.linha);
}
