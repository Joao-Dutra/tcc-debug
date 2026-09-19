import { EditorView } from '@uiw/react-codemirror';
import type { Extension } from '@uiw/react-codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Tema do editor: o "negativo" da direção D19.
 *
 * Escuro ao lado da mesa de luz, que é a superfície mais clara da tela: o
 * editor recua sem perder a leitura, e o olho vai para o desenho.
 *
 * O realce de sintaxe separa o que o estudante precisa ler — classe, função,
 * variável, propriedade — em famílias de cor próprias, e nenhuma delas é
 * azul, âmbar ou vermelho. Essas são as cores com significado da bancada
 * (D10), e o código não pode carregá-las: uma palavra-chave azul ao lado de
 * uma célula ativa azul sugeriria uma correspondência que não existe. Todos
 * os tons ficam a ΔE ≥ 34 das cores da bancada e a 4,6:1 ou mais sobre o
 * fundo; entre dois tons com cor própria, a distância mínima é ΔE 24.
 *
 * O realce é por tipo de token e uniforme no programa inteiro: a mesma
 * categoria tem a mesma cor em qualquer linha, então nenhum trecho se
 * diferencia dos demais (briefing, restrição 1).
 *
 * As cores estão escritas aqui, e não em variável CSS, porque o tema do
 * CodeMirror é gerado como folha de estilo própria. Os valores repetem os de
 * `--negativo*` e da anilina em src/index.css.
 */

const NEGATIVO = '#1e2926';
const TEXTO = '#e4eae6';
const SUAVE = '#7f948c';
const PONTUACAO = '#aebbb5';

// Uma família por categoria do que o estudante lê. Variável fica no tom do
// texto: é o que mais aparece, e o que mais aparece não precisa gritar.
const LILAS = '#c9b8f5'; //         palavras-chave, this, true, false, null
const VERDE_LIMA = '#b5da8e'; //    números e textos literais
const ROSA = '#f2a6c8'; //          funções: declaração e chamada
const CIANO_ESVERDEADO = '#6fd3db'; // classes: declaração e new
const CREME = '#ebd9a2'; //         propriedades: no.proximo, this.valor

const aparencia = EditorView.theme(
  {
    '&': { backgroundColor: NEGATIVO, color: TEXTO },
    '.cm-scroller': {
      fontFamily: 'var(--familia-mono)',
      fontSize: 'var(--fonte-codigo)',
      lineHeight: '22px',
    },
    '.cm-content': { caretColor: TEXTO, padding: '10px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: TEXTO, borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(201, 184, 245, .28)',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': {
      backgroundColor: NEGATIVO,
      color: SUAVE,
      border: 'none',
      borderRight: '1px solid rgba(228, 234, 230, .1)',
    },
    // Folga lateral no número: é o alvo da declaração (D7), e o realce ao
    // passar o mouse precisa de espaço para virar uma pastilha legível.
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 12px', minWidth: '40px' },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(228, 234, 230, .12)',
      outline: 'none',
    },
    '.cm-selectionMatch': { backgroundColor: 'rgba(228, 234, 230, .08)' },
    '.cm-tooltip': { backgroundColor: NEGATIVO, color: TEXTO, border: 'none' },
  },
  { dark: true }
);

// As tags compostas — função de variável, definição de classe — são as que o
// analisador de JavaScript emite para cada papel; o HighlightStyle escolhe a
// regra mais específica, então `no.proximo()` é função e `no.proximo` é
// propriedade.
const realce = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword,
    tags.operatorKeyword, tags.modifier, tags.self, tags.atom, tags.null, tags.bool],
    color: LILAS },
  { tag: [tags.string, tags.number, tags.regexp, tags.special(tags.string), tags.escape],
    color: VERDE_LIMA },
  { tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName)),
    tags.function(tags.propertyName), tags.function(tags.definition(tags.propertyName))],
    color: ROSA },
  { tag: [tags.className, tags.definition(tags.className)], color: CIANO_ESVERDEADO },
  { tag: [tags.propertyName, tags.definition(tags.propertyName),
    tags.special(tags.propertyName)], color: CREME },
  { tag: [tags.variableName, tags.definition(tags.variableName), tags.labelName],
    color: TEXTO },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: SUAVE },
  { tag: [tags.punctuation, tags.operator, tags.bracket, tags.separator,
    tags.derefOperator], color: PONTUACAO },
]);

export const temaDoEditor: Extension = [aparencia, syntaxHighlighting(realce)];
