# Briefing visual

Documento autocontido, para uso em ferramentas de design que não têm acesso ao
repositório. Descreve a ferramenta, as telas e as restrições visuais que não
podem ser violadas.

Mantenha este arquivo atualizado quando as decisões de projeto mudarem: ele é a
única versão do contexto que chega a quem trabalha na aparência.

---

## O que é a ferramenta

Uma aplicação web para o ensino de algoritmos e estruturas de dados. O estudante
recebe um programa **já escrito e quase correto**, no qual foi implantado **um
defeito lógico deliberado**. A tarefa dele é localizar e corrigir esse defeito.

Enquanto o programa executa, uma **representação gráfica animada da estrutura de
dados** — vetor, pilha, fila ou lista encadeada — mostra passo a passo o que
está acontecendo com os dados. O estudante avança e retrocede a execução como em
um reprodutor de vídeo.

**Público:** estudantes universitários de computação, cursando ou recém-saídos da
disciplina de algoritmos e estruturas de dados.

**Contexto de uso:** sessões individuais de 15 a 40 minutos, em computador de
mesa ou notebook, presencialmente acompanhadas. É também instrumento de coleta de
dados de uma pesquisa acadêmica, e algumas das restrições abaixo existem por
causa disso.

## O princípio que governa o desenho

A visualização **não é ilustração de apoio: é o instrumento de investigação.**
O estudante olha para ela porque precisa dela para encontrar o defeito.

Disso decorre a regra mais importante deste documento: **a interface nunca
resolve nada pelo estudante.** Todo recurso que torne a caça ao defeito
desnecessária destrói o propósito da ferramenta.

## As três telas

### 1. Lista de exercícios

Cartões, um por exercício. Cada cartão traz o título, a estrutura de dados
envolvida, uma indicação de complexidade e duas opções de abertura — com apoio
ou sem apoio — que são as ações do cartão. Um dos exercícios é
marcado como tutorial. Há um botão discreto de exportar dados.

São **duas escalas diferentes** e elas não podem ser confundidas visualmente:
*complexidade* é uma característica do exercício; *apoio* é quanta ajuda a
ferramenta oferece naquela abertura. Hoje são separadas por linha, por rótulo e
por tratamento — complexidade como texto, apoio como botões.

### 2. Tela de exercício — a mais importante

Título, enunciado e a escolha do apoio no topo. Abaixo, duas colunas:

- À esquerda, o **código**, com editor, numeração de linhas e botão de executar.
  O estudante clica no *número* da linha para declarar onde acredita estar o
  defeito, e recebe na hora se acertou. Pode tentar quantas vezes quiser.
- À direita, em cima, as **dicas**, reveladas uma a uma pelo estudante — junto
  da visualização, porque é para ela que as dicas mandam olhar. Sem apoio não
  há dicas, e a visualização sobe.
- À direita, embaixo das dicas, a **visualização**, com o desenho animado da
  estrutura sobre uma bancada clara, o indicador da linha que está sendo
  executada e os controles de reprodução: anterior, tocar, próximo, e uma barra
  de posição com o contador de passos.

Embaixo das duas colunas fica o retorno do que o estudante fez: os **casos de
teste** com seus resultados, à esquerda, e as linhas que ele **apontou** como
suspeitas, à direita.

Esta tela segue a direção 2a (bancada clara, anatomia de nó rotulada, ponteiro
em seta, nulo aterrado), com Space Grotesk no texto e JetBrains Mono no código e
nos rótulos do desenho. As outras duas telas ainda têm a aparência anterior.

Em telas estreitas os painéis empilham.

### 3. Painel de métricas

Tela de uso exclusivo do pesquisador, alcançável apenas por endereço direto.
Tabela de sessões com exercício, nível de apoio, duração, tempos até a primeira
execução, até a localização e até a correção, contagens e desfecho. Cada linha
abre a sequência completa de eventos com carimbo de tempo. Exporta em JSON.

É uma tela de análise: densidade de informação vale mais que respiro.

---

## Restrições que não podem ser violadas

### 1. Nada indica onde está o defeito

Nem cor, nem ícone, nem destaque de linha, nem ordenação, nem animação que chame
atenção para a região certa. A única confirmação de localização que existe é a
resposta a um palpite que o estudante deu.

Isto vale inclusive para sutilezas: não destaque a linha onde o teste falhou, não
enfatize a função que contém o problema, não use ênfase tipográfica que
diferencie um trecho do código dos demais.

### 2. Seis estados da visualização precisam continuar distinguíveis

Cada um é sinalizado **por cor e também por forma**. A redundância é proposital —
a informação não pode depender só de cor. Ao redesenhar, a forma é tão parte do
significado quanto a cor:

| Estado | Cor | Forma que acompanha |
|---|---|---|
| Célula ativa | azul | borda contínua, opacidade cheia |
| Célula consumida | cinza | borda tracejada, opacidade reduzida |
| Elemento apontado pelo marcador | âmbar | anel em volta da célula |
| Marcador fora da estrutura | sem cor própria | posição além da ponta, mais rótulo |
| Ponteiro nulo | sem cor própria | seta que termina em aterramento; numa variável, estacionada fora da fileira, mais rótulo |
| Ligação cíclica | vermelho | gancho por baixo da fileira, seta de retorno, rótulo |

A descrição de cada estado diz o que ele é, e nunca se está certo ou errado: a
ferramenta desenha o estado e não opina sobre ele. O aterramento — dois traços
paralelos, o de cima mais longo — marca ausência de destino onde quer que
apareça, inclusive no fim normal de uma lista correta. Por isso o estado se
chama *ponteiro nulo*, e não *ligação perdida*: no fim de uma lista, nada se
perdeu.

Dois pontos delicados:

- **O anel âmbar não é cor de erro.** Ele diz o que o programa vai tratar em
  seguida segundo o estado atual, nunca que aquilo está errado. Se virar
  vermelho, a ferramenta passa a acusar um defeito que ela não sabe onde está.
- **Estado inválido é desenhado, não escondido.** Marcador apontando para fora da
  estrutura, ponteiro sem destino, ciclo — tudo isso pode ser o sintoma que o
  estudante precisa ver. Não sanitize, não corrija no desenho, não unifique visualmente
  dois estados diferentes.

### 3. A lista não mostra progresso

Sem marcação de resolvido, sem pontuação, sem histórico, sem barra de progresso,
sem selo de conclusão. Saber de antemão quais exercícios já caíram muda a forma
como o estudante encara os que faltam.

### 4. Nenhum contador de sessão aparece ao estudante

Nem tempo decorrido, nem número de tentativas, nem quantas dicas já abriu, nem
quantas vezes executou. Tudo isso é registrado, e nada disso é exibido: mostrar
transformaria a tarefa em corrida contra o relógio e alteraria o comportamento
que a pesquisa quer observar.

O contador de passos da execução (`passo 16 / 28`) é exceção e permanece — ele se
refere à animação, não ao desempenho do estudante.

---

## O que pode mudar à vontade

Tipografia, paleta de base, espaçamento, cantos, sombras, hierarquia visual,
tratamento dos cartões, aparência dos botões e controles, densidade, estados de
foco e interação, e o arranjo geral das telas.

A régua é simples: **aparência é livre; significado não é.**

## O que existe hoje, para referência

Interface sóbria e clara, próxima de uma ferramenta de trabalho: fundo levemente
acinzentado, painéis brancos com borda fina e cantos arredondados, títulos de
seção em maiúsculas pequenas e cinza, azul como cor de ação, fonte de sistema.
Funciona, mas é genérica — não tem nada que a identifique.

Um bom resultado seria uma identidade própria que **aumente a legibilidade da
visualização**, já que ela é o instrumento central, sem sacrificar a
distinguibilidade dos seis estados nem introduzir qualquer coisa que aponte o
caminho para o defeito.