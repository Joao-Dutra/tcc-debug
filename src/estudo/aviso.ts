import { LIMITE_DO_AQUECIMENTO_MS, LIMITE_POR_EXERCICIO_MS, EXERCICIOS_DA_ANALISE } from './percurso';

/**
 * O aviso da entrada no estudo, com o consentimento (D37).
 *
 * **Pendente da orientadora.** Ela ainda vai decidir se o estudo passa por
 * comitê de ética, e o texto pode mudar. Por isso ele vive aqui, separado da
 * tela, e tem versão: a versão aceita vai para o banco junto com a entrada
 * (0004), e sem ela não se saberia depois com que termos cada um consentiu.
 *
 * **Mudou uma palavra, sobe a versão.** O teste do aviso guarda a impressão
 * do texto de cada versão e falha se o texto mudar sem a versão mudar. Os
 * tempos entram no texto a partir do percurso, e por isso recalibrá-los
 * também sobe a versão.
 *
 * O que o texto precisa dizer: que o que já foi feito fica salvo para quem
 * fecha a página antes do fim, sem como ser excluído depois, porque o
 * registro é anônimo, que o registro inclui o código escrito, que só os
 * pesquisadores têm acesso aos dados, que os resultados saem só de forma
 * agregada, e um contato para dúvidas. É lido em pé, na sala: curto.
 *
 * Versão 2: o acesso aos dados, a apresentação agregada, o que fica de quem
 * para no meio e o contato.
 *
 * Versão 3: texto mais curto, a pedido da orientação. O parágrafo da
 * participação foi trocado por uma frase só, sobre o que fica de quem fecha a
 * página, e com ele saíram a participação voluntária, a nota e o parar a
 * qualquer momento.
 */
export const VERSAO_DO_AVISO = 3;

/**
 * O contato para dúvidas. Provisório, o do autor, até a orientadora confirmar
 * qual e-mail usar; trocá-lo muda o texto, e por isso sobe a versão.
 */
export const CONTATO_DO_ESTUDO = 'jaumdutra744@gmail.com';

const minutos = (ms: number) => `${Math.round(ms / 60_000)} minutos`;

export const AVISO = {
  titulo: 'Antes de começar',
  paragrafos: [
    'Este é um estudo do Trabalho de Conclusão de Curso de João Victor Dutra Martins Silva, do ' +
      'Bacharelado em Sistemas de Informação do IFMG — Campus Ouro Branco, orientado pela ' +
      'professora Suelen Mapa de Paula. Ele avalia uma ferramenta para praticar a depuração de ' +
      'programas com estruturas de dados.',
    `Você vai resolver um exercício de aquecimento e mais ${EXERCICIOS_DA_ANALISE} exercícios. Em ` +
      'cada um há um código com um defeito de lógica colocado de propósito, e a tarefa é ' +
      'encontrar e corrigir esse defeito. No fim, há um questionário curto sobre a ferramenta.',
    `Cada exercício tem um tempo máximo: ${minutos(LIMITE_DO_AQUECIMENTO_MS)} no aquecimento e ` +
      `${minutos(LIMITE_POR_EXERCICIO_MS)} nos demais. Quando o tempo acaba, você segue para o ` +
      'próximo. Você também pode seguir antes, quando quiser, mas não dá para voltar a um ' +
      'exercício que ficou para trás.',
    'Se você fechar a página antes do fim, o que já foi feito até ali fica salvo — e, como o ' +
      'registro é anônimo, depois não há como identificar e excluir os dados de uma pessoa.',
    'O registro é anônimo: não pedimos nome, e-mail, matrícula nem nenhum outro dado que ' +
      'identifique você. Fica registrado o que você faz na ferramenta — inclusive o código que ' +
      'você escrever — e as respostas do questionário. Só os pesquisadores têm acesso aos dados, ' +
      'e os resultados serão apresentados apenas de forma agregada, no TCC e em possíveis ' +
      'publicações, sem identificar ninguém.',
    `Dúvidas sobre o estudo: ${CONTATO_DO_ESTUDO}.`,
  ],
  concordo: 'Concordo em participar',
  comecar: 'Começar',
} as const;

/** O texto inteiro, na ordem em que aparece: é o que o teste da versão lê. */
export function textoDoAviso(): string {
  return [AVISO.titulo, ...AVISO.paragrafos, AVISO.concordo, AVISO.comecar].join('\n');
}
