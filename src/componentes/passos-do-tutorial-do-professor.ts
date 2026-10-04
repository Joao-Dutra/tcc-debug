/**
 * O texto do tutorial do professor: como criar a primeira atividade (D33).
 *
 * Segue a ordem do trabalho no editor, que é a ordem do caminho até o aluno:
 * escolher a estrutura e ver os nomes esperados, escrever o código correto,
 * implantar o defeito numa única linha, escrever os casos e as três dicas,
 * verificar, ver como o aluno veria e publicar.
 *
 * Desde D33 não há revisão humana entre o professor e o aluno: a verificação
 * automática é a única porta. Por isso o tutorial diz o que ela cobra antes de
 * o professor esbarrar nela, e diz o que o próprio professor precisa cuidar —
 * o que a verificação não consegue julgar, como dica que entrega a resposta.
 *
 * Mora fora do componente, como o do participante, para o teste alcançá-lo.
 */

export type IlustracaoDoProfessor =
  | 'estrutura'
  | 'codigo'
  | 'defeito'
  | 'casos'
  | 'dicas'
  | 'verificar'
  | 'previa'
  | 'publicar';

export interface PassoDoTutorialDoProfessor {
  titulo: string;
  texto: string;
  ilustracao: IlustracaoDoProfessor;
}

export const PASSOS_DO_TUTORIAL_DO_PROFESSOR: readonly PassoDoTutorialDoProfessor[] = [
  {
    titulo: 'Escolher a estrutura e ver os nomes esperados',
    texto:
      'Comece pela estrutura de dados: vetor, pilha, fila ou lista encadeada. Logo abaixo ' +
      'aparecem os nomes que o desenho procura no código — no vetor, por exemplo, itens. Use ' +
      'exatamente esses nomes nas duas versões do código. No vetor, diga também quais ' +
      'variáveis apontam posições e quais guardam valores. Um algoritmo de ordenação é vetor, ' +
      'agrupado em Ordenação: ele aparece nesse filtro, dentro dos propostos por professores.',
    ilustracao: 'estrutura',
  },
  {
    titulo: 'Escrever o código correto',
    texto:
      'Escreva o programa funcionando, no estilo de Java ou C que a disciplina usa: var, ' +
      'laços for e while, funções. Ele define o comportamento certo, e o aluno nunca o recebe. ' +
      'Cada campo tem um botão de exemplo, tirado de um exercício do catálogo da mesma ' +
      'estrutura; com o campo vazio, dá para usá-lo como ponto de partida.',
    ilustracao: 'codigo',
  },
  {
    titulo: 'Implantar o defeito numa única linha',
    texto:
      'No código com defeito, comece pela cópia do correto e mude uma linha só — ou troque ' +
      'duas linhas vizinhas de lugar. Você não informa a linha: ela sai da comparação entre as ' +
      'duas versões. Prefira um defeito que apareça no desenho, como um índice deslocado ou ' +
      'uma condição de parada.',
    ilustracao: 'defeito',
  },
  {
    titulo: 'Escrever os casos de teste',
    texto:
      'Cada caso é uma expressão avaliada depois do programa e o valor esperado, em JSON: 42, ' +
      '"ana", [1, 2]. Com o código correto todos precisam passar, e com o defeito ao menos um ' +
      'precisa falhar — é o que leva o aluno a investigar.',
    ilustracao: 'casos',
  },
  {
    titulo: 'Escrever as três dicas',
    texto:
      'Três, em ordem crescente: a primeira dirige a atenção, a segunda aponta a relação onde ' +
      'está o problema, a terceira diz a propriedade que deveria valer. Nenhuma nomeia a linha ' +
      'do defeito nem diz a correção. Esta parte é com você: a verificação não julga o texto ' +
      'das dicas.',
    ilustracao: 'dicas',
  },
  {
    titulo: 'Verificar',
    texto:
      'A verificação executa as duas versões e confere os nomes, os casos, o defeito numa ' +
      'linha só e se o desenho mostra a diferença entre elas. O que não passa fica bloqueado, ' +
      'com o motivo. Ela vale para o que está no formulário: editou depois, verifique de novo.',
    ilustracao: 'verificar',
  },
  {
    titulo: 'Ver como o aluno veria',
    texto:
      'Abre o exercício em outra aba, exatamente como o aluno o verá, com apoio e sem apoio. ' +
      'Nada ali é gravado. Execute, avance os passos e confira se o defeito aparece no desenho ' +
      'e se o enunciado se entende sem a sua explicação.',
    ilustracao: 'previa',
  },
  {
    titulo: 'Publicar',
    texto:
      'Publicado, o exercício entra na seção “Propostos por professores” da vitrine e não muda ' +
      'mais: para corrigir, crie um rascunho a partir dele e retire o antigo. Durante a coleta ' +
      'da pesquisa a seção pode estar oculta aos alunos — a área avisa quando estiver.',
    ilustracao: 'publicar',
  },
];
