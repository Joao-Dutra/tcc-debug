import type { EspelhoDeSessoes } from '../nucleo/metricas';

/**
 * Espelho do arquivo de sessões no localStorage do navegador (D15).
 *
 * Mora na interface porque mexe no navegador; o núcleo recebe o espelho pronto
 * e é dono do formato. O localStorage é acessado a cada chamada, e não uma vez
 * na criação: em alguns contextos o simples acesso a ele lança erro, e é o
 * núcleo que trata a falha sem derrubar a aplicação.
 */

const CHAVE = 'depurar:sessoes-arquivadas';
const CHAVE_ILEGIVEL = 'depurar:sessoes-ilegiveis';

export function espelhoLocal(): EspelhoDeSessoes {
  const armazenamento = () => window.localStorage;
  return {
    lerBruto: () => armazenamento().getItem(CHAVE),
    gravarBruto: (conteudo) => armazenamento().setItem(CHAVE, conteudo),
    // Uma cópia ilegível anterior não é sobrescrita: a primeira é a que ainda
    // pode ter o dado original.
    preservar: (conteudo) => {
      if (armazenamento().getItem(CHAVE_ILEGIVEL) === null) {
        armazenamento().setItem(CHAVE_ILEGIVEL, conteudo);
      }
    },
    limpar: () => {
      armazenamento().removeItem(CHAVE);
      armazenamento().removeItem(CHAVE_ILEGIVEL);
    },
  };
}
