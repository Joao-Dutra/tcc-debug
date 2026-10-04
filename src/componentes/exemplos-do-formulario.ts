import { catalogo } from '../exercicios/catalogo';
import { rascunhoDoExercicio } from '../nucleo/verificacao-do-exercicio';
import { formularioDe } from './formulario-do-exercicio';
import type { FormularioDoExercicio } from './formulario-do-exercicio';
import type { Exercicio, SecaoEspecial, TipoEstrutura } from '../nucleo/tipos';

/**
 * O exemplo de cada campo do formulário do professor (D35).
 *
 * Os exemplos de um formulário vêm todos de **um** exercício do catálogo, o da
 * estrutura escolhida — ou o da ordenação, quando é esse o agrupamento. Assim
 * eles são coerentes entre si: o código com defeito é o do código correto ao
 * lado, os casos testam aquele programa, os marcadores são as variáveis dele,
 * e tudo segue o contrato de nomes da estrutura (D31). Trocar a estrutura
 * troca o exercício, e com ele todos os exemplos.
 *
 * **O exemplo nunca sobrescreve o que o professor escreveu.** Inserir só vale
 * com o campo vazio; com conteúdo, o exemplo só é mostrado. A regra mora aqui,
 * e não no componente, para o teste alcançá-la.
 */

/** O exercício do catálogo de onde vêm os exemplos de cada estrutura. */
const EXEMPLO_DA_ESTRUTURA: Record<TipoEstrutura, string> = {
  vetor: 'vetor-dobrar',
  pilha: 'pilha-desempilhar',
  fila: 'fila-atender-todos',
  'lista-encadeada': 'lista-inserir-depois',
};

/** E o da ordenação: a bolha, que tem os dois marcadores e a temporária da troca. */
const EXEMPLO_DO_AGRUPAMENTO: Record<SecaoEspecial, string> = {
  ordenacao: 'vetor-ordenar',
};

export function exercicioDeExemplo(
  estrutura: TipoEstrutura,
  agrupamento: SecaoEspecial | null
): Exercicio {
  // O agrupamento só vale no vetor, como no formulário.
  const id =
    estrutura === 'vetor' && agrupamento
      ? EXEMPLO_DO_AGRUPAMENTO[agrupamento]
      : EXEMPLO_DA_ESTRUTURA[estrutura];
  const exercicio = catalogo.find((e) => e.id === id);
  if (!exercicio) throw new Error(`o exemplo ${id} não está no catálogo`);
  return exercicio;
}

/** O formulário inteiro preenchido com o exemplo da estrutura escolhida. */
export function formularioDeExemplo(
  estrutura: TipoEstrutura,
  agrupamento: SecaoEspecial | null
): FormularioDoExercicio {
  return formularioDe(rascunhoDoExercicio(exercicioDeExemplo(estrutura, agrupamento)));
}

/** Os campos que têm exemplo. Estrutura, complexidade e tipo do defeito são escolhas, e não texto. */
export type CampoComExemplo =
  | 'titulo'
  | 'enunciado'
  | 'codigoCorreto'
  | 'codigoComDefeito'
  | 'casos'
  | 'dicas'
  | 'marcadores'
  | 'variaveisDeValor';

export const CAMPOS_COM_EXEMPLO: readonly CampoComExemplo[] = [
  'titulo',
  'enunciado',
  'marcadores',
  'variaveisDeValor',
  'codigoCorreto',
  'codigoComDefeito',
  'casos',
  'dicas',
];

/**
 * O campo está vazio? Os casos e as dicas são grupos: vazios só quando todas
 * as linhas estão. Uma dica escrita e duas em branco não é campo vazio — o
 * exemplo completaria o que o professor começou com um texto de outro
 * exercício.
 */
export function campoVazio(formulario: FormularioDoExercicio, campo: CampoComExemplo): boolean {
  if (campo === 'casos') {
    return formulario.casos.every(
      (c) => !c.descricao.trim() && !c.expressao.trim() && !c.esperado.trim()
    );
  }
  if (campo === 'dicas') return formulario.dicas.every((d) => !d.trim());
  return !formulario[campo].trim();
}

/**
 * O formulário com o exemplo no campo — ou o mesmo formulário, se o campo não
 * estiver vazio. É a única porta de entrada de um exemplo no formulário.
 */
export function inserirExemplo(
  formulario: FormularioDoExercicio,
  campo: CampoComExemplo
): FormularioDoExercicio {
  if (!campoVazio(formulario, campo)) return formulario;
  const exemplo = formularioDeExemplo(formulario.estrutura, formulario.agrupamento);
  if (campo === 'casos') return { ...formulario, casos: exemplo.casos.map((c) => ({ ...c })) };
  if (campo === 'dicas') return { ...formulario, dicas: [...exemplo.dicas] };
  return { ...formulario, [campo]: exemplo[campo] };
}

/** O exemplo como texto, para ser mostrado sem ser inserido. */
export function textoDoExemplo(formulario: FormularioDoExercicio, campo: CampoComExemplo): string {
  const exemplo = formularioDeExemplo(formulario.estrutura, formulario.agrupamento);
  if (campo === 'casos') {
    return exemplo.casos
      .map((c) => `${c.descricao}\n  expressão: ${c.expressao}\n  esperado: ${c.esperado}`)
      .join('\n\n');
  }
  if (campo === 'dicas') return exemplo.dicas.map((d, i) => `${i + 1}. ${d}`).join('\n\n');
  return exemplo[campo];
}
