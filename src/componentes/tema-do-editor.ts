import { EditorView } from '@uiw/react-codemirror';
import type { Extension } from '@uiw/react-codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Tema do editor: a placa escura da direção D19.
 *
 * Escuro ao lado da mesa de luz, que é a superfície mais clara da tela: o
 * editor recua sem perder a leitura, e o olho vai para o desenho.
 *
 * O realce de sintaxe separa o que o estudante precisa ler — classe, função,
 * variável, propriedade — em famílias de cor próprias, e nenhuma delas é
 * azul, âmbar ou vermelho. Essas são as cores com significado da bancada
 * (D10), e o código não pode carregá-las: uma palavra-chave azul ao lado de
 * uma célula ativa azul sugeriria uma correspondência que não existe.
 *
 * O realce é por tipo de token e uniforme no programa inteiro: a mesma
 * categoria tem a mesma cor em qualquer linha, então nenhum trecho se
 * diferencia dos demais (briefing, restrição 1).
 *
 * Todas as cores vêm dos papéis `--editor-*` e `--sintaxe-*` de src/index.css,
 * que apontam para degraus das escalas. O tema do CodeMirror vira folha de
 * estilo comum, então `var()` funciona aqui como em qualquer regra, e a
 * validação de contraste feita lá vale para o que aparece aqui.
 */

const misturar = (cor: string, porcento: number) =>
  `color-mix(in srgb, var(${cor}) ${porcento}%, transparent)`;

const aparencia = EditorView.theme(
  {
    '&': { backgroundColor: 'var(--editor-fundo)', color: 'var(--editor-texto)' },
    '.cm-scroller': {
      fontFamily: 'var(--familia-mono)',
      fontSize: 'var(--fonte-codigo)',
      fontWeight: '400',
      lineHeight: '22px',
    },
    '.cm-content': { caretColor: 'var(--editor-texto)', padding: '10px 0' },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--editor-texto)',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: misturar('--anilina-300', 28),
    },
    '.cm-gutters': {
      backgroundColor: 'var(--editor-fundo)',
      color: 'var(--editor-suave)',
      border: 'none',
      borderRight: `1px solid ${misturar('--editor-texto', 10)}`,
    },
    // Folga lateral no número: é o alvo da declaração (D7), e o realce ao
    // passar o mouse precisa de espaço para virar uma pastilha legível.
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 12px', minWidth: '40px' },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: misturar('--editor-texto', 12),
      outline: 'none',
    },
    // Outras ocorrências do que está selecionado: selecionar uma variável e
    // ver onde ela é usada é ferramenta legítima de investigação. A 0,2 o
    // fundo fica a só ΔE 10 da faixa da linha em execução, então o que separa
    // os dois é a forma: a ocorrência é uma caixa contornada do tamanho da
    // palavra; a faixa, um fundo sem contorno na linha inteira.
    '.cm-selectionMatch': {
      backgroundColor: misturar('--anilina-300', 20),
      boxShadow: `inset 0 0 0 1px ${misturar('--anilina-300', 60)}`,
      borderRadius: '2px',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--editor-fundo)',
      color: 'var(--editor-texto)',
      border: 'none',
    },
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
    color: 'var(--sintaxe-palavra-chave)' },
  { tag: [tags.string, tags.number, tags.regexp, tags.special(tags.string), tags.escape],
    color: 'var(--sintaxe-literal)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName)),
    tags.function(tags.propertyName), tags.function(tags.definition(tags.propertyName))],
    color: 'var(--sintaxe-funcao)' },
  { tag: [tags.className, tags.definition(tags.className)], color: 'var(--sintaxe-classe)' },
  { tag: [tags.propertyName, tags.definition(tags.propertyName),
    tags.special(tags.propertyName)], color: 'var(--sintaxe-propriedade)' },
  { tag: [tags.variableName, tags.definition(tags.variableName), tags.labelName],
    color: 'var(--sintaxe-variavel)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: 'var(--sintaxe-comentario)' },
  { tag: [tags.punctuation, tags.operator, tags.bracket, tags.separator,
    tags.derefOperator], color: 'var(--sintaxe-pontuacao)' },
]);

export const temaDoEditor: Extension = [aparencia, syntaxHighlighting(realce)];
