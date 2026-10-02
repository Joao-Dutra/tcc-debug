/**
 * O texto do tutorial do participante (D32).
 *
 * Duas regras, e as duas protegem o estudo:
 *
 * - **Ensina a interface, nunca a estratégia.** Diz o que cada parte da tela
 *   faz e como se usa — executar, avançar os passos, ler o desenho, apontar a
 *   linha, editar e executar de novo. Nunca diz onde procurar, o que comparar
 *   nem como reconhecer um defeito: isso é o que o estudo observa, e ensinar
 *   aqui seria fazer pelo estudante o esforço investigativo que a ferramenta
 *   existe para provocar.
 * - **É o mesmo nos dois níveis de apoio.** Por isso o texto é uma constante,
 *   e não uma função do nível: se o tutorial variasse com o apoio, a diferença
 *   entre as condições deixaria de ser só o que o apoio revela (D9). Também
 *   por isso nenhum passo descreve o que só um dos níveis mostra — os rótulos
 *   dos marcadores, a linha marcada no editor, o esperado e o obtido, as
 *   dicas.
 *
 * Mora fora do componente para o teste alcançá-lo sem navegador.
 */

export type IlustracaoDoPasso =
  | 'tela'
  | 'executar'
  | 'controles'
  | 'observar'
  | 'apontar'
  | 'editar';

export interface PassoDoTutorial {
  titulo: string;
  texto: string;
  ilustracao: IlustracaoDoPasso;
}

export const PASSOS_DO_TUTORIAL: readonly PassoDoTutorial[] = [
  {
    titulo: 'Como esta tela funciona',
    texto:
      'À esquerda está o código do exercício. À direita, o desenho da estrutura de dados e, ' +
      'embaixo dele, os casos de teste. Este guia mostra para que serve cada parte. Você pode ' +
      'pulá-lo agora e voltar a ele quando quiser, pelo botão Ajuda, no alto da tela.',
    ilustracao: 'tela',
  },
  {
    titulo: 'Executar',
    texto:
      'O botão Executar roda o código que está no editor e confere o resultado nos casos de ' +
      'teste, que aparecem abaixo do desenho. Quando o exercício abre, o código já é executado ' +
      'uma vez.',
    ilustracao: 'executar',
  },
  {
    titulo: 'Avançar os passos',
    texto:
      'Cada execução fica guardada passo a passo. Use as setas para voltar e avançar um passo, ' +
      'o botão do meio para tocar a execução inteira, ou arraste a barra até um passo. Ao lado ' +
      'dos controles, o texto diz qual linha do código está sendo executada no passo mostrado.',
    ilustracao: 'controles',
  },
  {
    titulo: 'Ler a visualização',
    texto:
      'O desenho mostra a estrutura de dados no passo escolhido. As caixas guardam os valores; ' +
      'as setas e os marcadores fora delas são as variáveis que apontam para partes da ' +
      'estrutura. Quando um valor é copiado de um lugar para outro, um arco liga a origem ao ' +
      'destino, com o valor copiado no meio.',
    ilustracao: 'observar',
  },
  {
    titulo: 'Apontar a linha',
    texto:
      'Quando achar que sabe em que linha está o defeito, clique no número dessa linha, na ' +
      'margem esquerda do código. A resposta aparece logo abaixo do código, em “Onde você ' +
      'apontou”. Depois de uma espera curta você pode apontar outra linha, antes ou depois de ' +
      'editar.',
    ilustracao: 'apontar',
  },
  {
    titulo: 'Editar e executar de novo',
    texto:
      'Para corrigir, edite o código direto no editor. Enquanto houver alteração ainda não ' +
      'executada, o botão Executar fica destacado. Execute de novo para conferir os casos de ' +
      'teste com o código novo: quando todos passarem, o exercício está resolvido.',
    ilustracao: 'editar',
  },
];
