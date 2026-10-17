import { interpretarPercurso } from '../estudo/percurso';
import type { EstadoDoPercurso, GrupoDoEstudo } from '../estudo/percurso';
import type { RespostaDoQuestionario } from '../estudo/questionario';

/**
 * O percurso do estudo guardado na aba (D37).
 *
 * `sessionStorage`, e não `localStorage`: recarregar a página mantém o lugar
 * do participante, mas outra aba, ou o navegador fechado e aberto de novo
 * pelo próximo participante, começa do aviso. Um percurso que atravessasse
 * pessoas levaria o grupo e o prazo de uma para a outra.
 *
 * Sem armazenamento, o percurso vive só em memória e um recarregamento
 * recomeça do aviso — com identidade nova e outra vaga. É o lado certo do
 * erro: perde-se a continuidade, mas ninguém herda o lugar de outro.
 */

const CHAVE = 'depurar:percurso-do-estudo';

export function lerPercurso(aplicacao: string): EstadoDoPercurso | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    return bruto === null ? null : interpretarPercurso(JSON.parse(bruto), aplicacao);
  } catch {
    return null;
  }
}

export function guardarPercurso(estado: EstadoDoPercurso): void {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Sem armazenamento: ver acima.
  }
}

export function esquecerPercurso(): void {
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    // Idem.
  }
}

const CHAVE_DA_ALTERNANCIA = 'depurar:alternancia-no-aparelho';

/**
 * O grupo, quando não há banco para atribuí-lo (D37). Alterna A e B no
 * aparelho, como o banco faz na turma, para o percurso poder ser exercitado
 * sem banco — em desenvolvimento e nos testes. Nunca é o caso do estudo: com
 * o banco configurado, a entrada exige o banco.
 */
export function grupoNoAparelho(): GrupoDoEstudo {
  try {
    const entradas = Number(window.localStorage.getItem(CHAVE_DA_ALTERNANCIA) ?? '0') + 1;
    window.localStorage.setItem(CHAVE_DA_ALTERNANCIA, String(entradas));
    return entradas % 2 === 1 ? 'A' : 'B';
  } catch {
    return 'A';
  }
}

const CHAVE_DAS_RESPOSTAS = 'depurar:respostas-do-questionario';

/** A resposta guardada no aparelho, quando não há banco para recebê-la. */
export interface RespostaNoAparelho extends RespostaDoQuestionario {
  aplicacao: string;
  grupoNoAparelho: GrupoDoEstudo | null;
  respondidoEm: string;
}

/**
 * Sem banco, a resposta do questionário fica no aparelho, ao lado das sessões
 * arquivadas: nenhuma tela do estudante depende do banco, e a coleta continua
 * só no aparelho. Como o grupo, é coisa de desenvolvimento e de teste.
 */
export function guardarRespostasNoAparelho(resposta: RespostaNoAparelho): void {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DAS_RESPOSTAS);
    const guardadas: unknown = bruto === null ? [] : JSON.parse(bruto);
    const lista = Array.isArray(guardadas) ? guardadas : [];
    window.localStorage.setItem(CHAVE_DAS_RESPOSTAS, JSON.stringify([...lista, resposta]));
  } catch {
    // Sem armazenamento, a resposta se perde, e o percurso segue para o fim.
  }
}
