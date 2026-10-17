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
 * O que o texto precisa dizer, a pedido do pesquisador: que a participação é
 * voluntária, que não afeta a nota, que se pode parar a qualquer momento e
 * que o registro é anônimo e inclui o código escrito.
 */
export const VERSAO_DO_AVISO = 1;

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
    'A participação é voluntária e não afeta a sua nota em nenhuma disciplina. Você pode parar a ' +
      'qualquer momento, sem precisar explicar o motivo: basta fechar a página.',
    'O registro é anônimo: não pedimos nome, e-mail, matrícula nem nenhum outro dado que ' +
      'identifique você. Fica registrado o que você faz na ferramenta — inclusive o código que ' +
      'você escrever — e as respostas do questionário.',
  ],
  concordo: 'Concordo em participar',
  comecar: 'Começar',
} as const;

/** O texto inteiro, na ordem em que aparece: é o que o teste da versão lê. */
export function textoDoAviso(): string {
  return [AVISO.titulo, ...AVISO.paragrafos, AVISO.concordo, AVISO.comecar].join('\n');
}
