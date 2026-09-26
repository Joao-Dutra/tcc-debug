import type {
  RascunhoDeExercicio,
} from '../nucleo/verificacao-do-exercicio';
import type { CategoriaDefeito, TipoEstrutura } from '../nucleo/tipos';

/**
 * O formulário da área do professor, e a conversão dele para o rascunho que o
 * núcleo verifica (D31).
 *
 * Fora do componente porque é onde mora a validação que não é regra de
 * exercício, e sim de digitação: o valor esperado de um caso escrito em JSON
 * inválido, um nome de variável com espaço. Isso o formulário diz na hora, na
 * linha em que aconteceu; o que é regra — defeito único, quadro-denúncia — é a
 * verificação que diz.
 */

export interface CasoNoFormulario {
  descricao: string;
  expressao: string;
  /** Como o professor digitou: JSON, convertido só na hora de usar. */
  esperado: string;
}

export interface FormularioDoExercicio {
  titulo: string;
  enunciado: string;
  estrutura: TipoEstrutura;
  dificuldade: 1 | 2 | 3;
  categoriaDefeito: CategoriaDefeito;
  codigoCorreto: string;
  codigoComDefeito: string;
  casos: CasoNoFormulario[];
  /** Sempre três, como no catálogo (D9). */
  dicas: [string, string, string];
  /** Nomes separados por vírgula, na ordem; só no vetor. */
  marcadores: string;
  variaveisDeValor: string;
}

export const ESTRUTURAS: readonly { valor: TipoEstrutura; rotulo: string }[] = [
  { valor: 'vetor', rotulo: 'Vetor' },
  { valor: 'pilha', rotulo: 'Pilha' },
  { valor: 'fila', rotulo: 'Fila' },
  { valor: 'lista-encadeada', rotulo: 'Lista encadeada' },
];

export const CATEGORIAS: readonly { valor: CategoriaDefeito; rotulo: string }[] = [
  { valor: 'indice-deslocado', rotulo: 'Índice deslocado — uma posição a mais ou a menos' },
  { valor: 'condicao-de-parada', rotulo: 'Condição de parada — o laço termina cedo ou tarde demais' },
  { valor: 'referencia-incorreta', rotulo: 'Referência incorreta — lê ou escreve no lugar errado' },
  { valor: 'ordem-de-operacoes', rotulo: 'Ordem das operações — as instruções certas, na ordem errada' },
  { valor: 'inicializacao-incorreta', rotulo: 'Inicialização incorreta — começa com o valor errado' },
];

export function formularioVazio(): FormularioDoExercicio {
  return {
    titulo: '',
    enunciado: '',
    estrutura: 'vetor',
    dificuldade: 1,
    categoriaDefeito: 'indice-deslocado',
    codigoCorreto: '',
    codigoComDefeito: '',
    casos: [{ descricao: '', expressao: '', esperado: '' }],
    dicas: ['', '', ''],
    marcadores: '',
    variaveisDeValor: '',
  };
}

export function formularioDe(rascunho: RascunhoDeExercicio): FormularioDoExercicio {
  const dicas = [...rascunho.dicas, '', '', ''].slice(0, 3) as [string, string, string];
  return {
    titulo: rascunho.titulo,
    enunciado: rascunho.enunciado,
    estrutura: rascunho.estrutura,
    dificuldade: rascunho.dificuldade,
    categoriaDefeito: rascunho.categoriaDefeito,
    codigoCorreto: rascunho.codigoCorreto,
    codigoComDefeito: rascunho.codigoComDefeito,
    casos: rascunho.casosDeTeste.map((c) => ({
      descricao: c.descricao,
      expressao: c.expressao,
      esperado: JSON.stringify(c.esperado),
    })),
    dicas,
    marcadores: rascunho.marcadores.join(', '),
    variaveisDeValor: rascunho.variaveisDeValor.join(', '),
  };
}

/** Um identificador de JavaScript, como o código precisa usar. */
const NOME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function nomesDe(texto: string): { nomes: string[]; invalidos: string[] } {
  const nomes = texto
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '');
  return { nomes, invalidos: nomes.filter((n) => !NOME.test(n)) };
}

export type ConversaoDoFormulario =
  | { rascunho: RascunhoDeExercicio; erros: [] }
  | { rascunho: null; erros: string[] };

/**
 * O rascunho do formulário, ou os erros de digitação que o impedem. Caso sem
 * descrição e sem expressão é linha vazia, e sai sem virar erro: é o que
 * sobra quando o professor acrescenta uma linha e não a usa.
 */
export function rascunhoDoFormulario(formulario: FormularioDoExercicio): ConversaoDoFormulario {
  const erros: string[] = [];

  // Numerados pela posição em que o professor os vê, antes de tirar as linhas
  // vazias: "caso 3" precisa ser a terceira linha da tela.
  const casos = formulario.casos
    .map((c, i) => ({ c, numero: i + 1 }))
    .filter(({ c }) => c.descricao.trim() || c.expressao.trim() || c.esperado.trim())
    .map(({ c, numero }) => {
      try {
        return {
          descricao: c.descricao.trim(),
          expressao: c.expressao.trim(),
          esperado: JSON.parse(c.esperado) as unknown,
        };
      } catch {
        erros.push(
          `O valor esperado do caso ${numero} não é JSON válido. Números como 42, textos entre ` +
            'aspas como "ana", vetores como [1, 2] e true, false ou null.'
        );
        return null;
      }
    });

  const vetor = formulario.estrutura === 'vetor';
  const marcadores = vetor ? nomesDe(formulario.marcadores) : { nomes: [], invalidos: [] };
  const valores = vetor ? nomesDe(formulario.variaveisDeValor) : { nomes: [], invalidos: [] };
  for (const invalido of [...marcadores.invalidos, ...valores.invalidos]) {
    erros.push(`"${invalido}" não é um nome de variável: use letras, algarismos e _, sem espaço.`);
  }
  const repetidos = marcadores.nomes.filter((n) => valores.nomes.includes(n));
  for (const repetido of repetidos) {
    erros.push(`${repetido} está como marcador e como variável de valor: é uma coisa ou outra.`);
  }

  if (erros.length > 0) return { rascunho: null, erros };

  return {
    rascunho: {
      titulo: formulario.titulo.trim(),
      enunciado: formulario.enunciado.trim(),
      estrutura: formulario.estrutura,
      dificuldade: formulario.dificuldade,
      categoriaDefeito: formulario.categoriaDefeito,
      codigoCorreto: formulario.codigoCorreto,
      codigoComDefeito: formulario.codigoComDefeito,
      casosDeTeste: casos.filter((c): c is NonNullable<typeof c> => c !== null),
      dicas: formulario.dicas.map((d) => d.trim()),
      marcadores: marcadores.nomes,
      variaveisDeValor: valores.nomes,
    },
    erros: [],
  };
}
