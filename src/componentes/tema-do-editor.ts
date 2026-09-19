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
 * O realce de sintaxe tem três tons só — lilás para palavras-chave, verde-claro
 * para literais, cinza para comentários — e nenhum deles é vermelho, âmbar ou
 * azul. Essas são as cores com significado da bancada (D10), e o código não
 * pode carregá-las: uma palavra-chave azul ao lado de uma célula ativa azul
 * sugeriria uma correspondência que não existe. O realce é por tipo de token e
 * uniforme no programa inteiro, então não diferencia trecho nenhum (briefing,
 * restrição 1).
 *
 * As cores estão escritas aqui, e não em variável CSS, porque o tema do
 * CodeMirror é gerado como folha de estilo própria. Os valores repetem os de
 * `--negativo*` e da anilina em src/index.css.
 */

const NEGATIVO = '#1e2926';
const TEXTO = '#e4eae6';
const SUAVE = '#7f948c';
const PONTUACAO = '#b7c4be';
const LILAS = '#c9b8f5';
const VERDE_CLARO = '#9fd6b4';

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

const realce = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword,
    tags.operatorKeyword, tags.self, tags.null, tags.bool], color: LILAS },
  { tag: [tags.string, tags.number, tags.regexp, tags.special(tags.string)],
    color: VERDE_CLARO },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: SUAVE },
  { tag: [tags.punctuation, tags.operator, tags.bracket], color: PONTUACAO },
]);

export const temaDoEditor: Extension = [aparencia, syntaxHighlighting(realce)];
