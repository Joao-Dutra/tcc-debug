import { Decoration, EditorView, StateEffect, StateField } from '@uiw/react-codemirror';
import type { Extension } from '@uiw/react-codemirror';

/**
 * Destaque, no editor, da linha do passo exibido pelo reprodutor (D9).
 *
 * Guarda só o número da linha e refaz a decoração a partir dele. Assim o
 * destaque aponta sempre o mesmo número que o indicador textual mostra, mesmo
 * depois de o estudante editar o código: os dois se referem ao instantâneo, e
 * nenhum inventa uma correspondência com o código novo que o instantâneo não
 * tem.
 *
 * Deriva só do instantâneo. Este módulo não recebe, e não pode receber, a
 * linha do defeito.
 *
 * A decoração é de linha e fica no conteúdo. O gutter fica de fora, porque é
 * nele que o estudante declara a localização (D7).
 */

const definirLinha = StateEffect.define<number | null>();

const linhaMarcada = StateField.define<number | null>({
  create: () => null,
  update: (linha, transacao) => {
    for (const efeito of transacao.effects) {
      if (efeito.is(definirLinha)) linha = efeito.value;
    }
    return linha;
  },
});

const faixa = Decoration.line({ class: 'cm-linha-em-execucao' });

const decoracoes = EditorView.decorations.compute([linhaMarcada, 'doc'], (estado) => {
  const linha = estado.field(linhaMarcada);
  // Linha que não existe mais, porque o código encolheu desde a execução, não
  // é marcada: o indicador textual continua dizendo qual era.
  if (linha === null || linha < 1 || linha > estado.doc.lines) return Decoration.none;
  return Decoration.set([faixa.range(estado.doc.line(linha).from)]);
});

export const linhaEmExecucao: Extension = [linhaMarcada, decoracoes];

/** `null` apaga o destaque. */
export function marcarLinhaEmExecucao(view: EditorView, linha: number | null): void {
  view.dispatch({ effects: definirLinha.of(linha) });

  // Num programa mais comprido que o editor, a faixa ficaria fora de vista.
  // Então o editor rola só o necessário para a linha marcada aparecer. Não é
  // o scrollIntoView do próprio editor, porque ele rola também a página: trocar
  // de passo com a visualização à vista jogaria a tela de volta para o código.
  const marcada = view.contentDOM.querySelector<HTMLElement>('.cm-linha-em-execucao');
  if (!marcada) return;
  const area = view.scrollDOM.getBoundingClientRect();
  const alvo = marcada.getBoundingClientRect();
  if (alvo.top < area.top) view.scrollDOM.scrollTop -= area.top - alvo.top;
  else if (alvo.bottom > area.bottom) view.scrollDOM.scrollTop += alvo.bottom - area.bottom;
}
