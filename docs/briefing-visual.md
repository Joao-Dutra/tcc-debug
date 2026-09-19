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

Uma régua de linhas, uma por exercício — não uma grade de cartões iguais. Cada
linha traz o título, a estrutura de dados envolvida, uma indicação de
complexidade e, à direita, duas opções de abertura — com apoio ou sem apoio —,
que são as ações da linha. Um dos exercícios é marcado como tutorial. Há um
botão discreto de exportar dados.

São **duas escalas diferentes** e elas não podem ser confundidas visualmente:
*complexidade* é uma característica do exercício; *apoio* é quanta ajuda a
ferramenta oferece naquela abertura. Hoje são separadas por linha, por rótulo e
por tratamento — complexidade como texto, apoio como botões.

### 2. Tela de exercício — a mais importante

De cima para baixo:

1. **Título, enunciado e a escolha do apoio**, em largura inteira.
2. **Casos de teste**, numa faixa larga. O teste que falha é o que motiva a
   investigação, então vem antes do código.
3. **Código e visualização lado a lado**, com a mesma altura.
   - À esquerda, o **código**: editor escuro, numeração de linhas e botão de
     executar. O estudante clica no *número* da linha para declarar onde
     acredita estar o defeito, e recebe na hora se acertou. Pode tentar quantas
     vezes quiser.
   - À direita, a **visualização**: o desenho animado da estrutura sobre a mesa
     de luz (anatomia de nó rotulada, ponteiro em seta, nulo aterrado), o
     indicador da linha que está sendo executada e os controles de reprodução —
     anterior, tocar, próximo, e uma barra de posição com o contador de passos.
4. **Dicas e retorno da localização**: as dicas, reveladas uma a uma pelo
   estudante, à esquerda; as linhas que ele **apontou** como suspeitas, à
   direita. Sem apoio não há dicas, e o retorno ocupa a faixa inteira.

Em telas estreitas tudo empilha, com o código antes da visualização.

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

### 2. Os estados da visualização precisam continuar distinguíveis

Cada um é sinalizado **por cor e também por forma**. A redundância é proposital —
a informação não pode depender só de cor. Ao redesenhar, a forma é tão parte do
significado quanto a cor:

| Estado | Cor | Forma que acompanha |
|---|---|---|
| Célula ativa | azul `#2A5DA8` | borda contínua, opacidade cheia, sombra seca de peça pousada |
| Célula consumida | cinza `#66716C` | borda tracejada em opacidade cheia; fundo e valor esmaecidos; sem sombra |
| Elemento apontado pelo marcador | âmbar `#B06F0A` | anel em volta da célula |
| Marcador fora da estrutura | sem cor própria | posição além da ponta, mais rótulo |
| Ponteiro nulo | sem cor própria | seta que termina em aterramento; numa variável, estacionada fora da fileira, mais rótulo |
| Ligação cíclica | vermelho `#B5352A` | gancho por baixo da fileira, seta de retorno, rótulo |
| Posição vazia da capacidade | cor da moldura `#838E88` | contorno pontilhado, sem preenchimento e sem nada dentro |

Todas passam de 3:1 sobre a mesa de luz (`#FAFCFA`).

**Dentro da bancada, matiz é significado.** Nada no desenho usa cor que não seja
uma destas. Marcadores, ligações e rótulos são grafite ou cinza de moldura; dois
marcadores no mesmo desenho se distinguem pela forma — seta cheia e seta
vazada. A cor de ação da interface (anilina) nunca entra na bancada: ela fica
perto demais do azul da célula ativa para quem tem deficiência de visão de
cores.

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

### 5. Retorno sobre a ação, sim; sobre o desempenho, não

Responder ao que o estudante acabou de fazer é permitido. Tempo decorrido,
contagem de tentativas, pontuação, progresso e histórico de resolvidos, não —
nem na tela de exercício, nem na lista. Os retornos que existem:

- **Acerto.** Quando todos os casos passam, a faixa de casos vira um campo
  verde, com um selo de ✓ que se traça uma vez e o texto "Todos os casos
  passaram." É **idêntico nos dois níveis de apoio**: se variasse com o apoio, a
  diferença de desempenho entre os níveis deixaria de ser atribuível ao apoio.
  Também não pode mudar de intensidade entre pilotos.
- **Mudança pendente.** Com o código editado e ainda não executado, o botão diz
  "Executar alterações" e ganha um ponto.
- **Convite no número da linha.** Cursor de ponteiro e, sob o mouse, o número
  vira uma pastilha anilina. Todos os números se comportam igual; nenhum recebe
  marca própria.

---

## O que pode mudar à vontade

Tipografia, paleta de base, espaçamento, cantos, sombras, hierarquia visual,
tratamento dos cartões, aparência dos botões e controles, densidade, estados de
foco e interação, e o arranjo geral das telas.

A régua é simples: **aparência é livre; significado não é.**

## A identidade atual (D19)

**Conceito: a sala e a mesa de luz.** A referência é o laboratório escolar — a
mesa de luz onde se examina uma peça, o verde dos equipamentos antigos de
laboratório, o roxo de anilina das folhas mimeografadas de exercício. A página é
uma sala verde-acinzentada onde só dois objetos têm corpo: o editor, escuro, e a
bancada da visualização, que é a superfície mais clara da tela, com uma grade
milimetrada tênue. O resto é texto pousado direto na sala, alinhado à esquerda.
A ousadia está gasta na bancada; o resto é quieto.

| Nome | Hex | Papel |
|---|---|---|
| Verde-bancada | `#D8E0DA` | fundo da sala |
| Mesa de luz | `#FAFCFA` | só a bancada |
| Grafite | `#1F2B27` | texto, e marcadores dentro do desenho |
| Anilina | `#5B3FA6` | a única cor de ação — nunca dentro da bancada |
| Acerto | `#1F7A4D` | só o sinal de todos os casos passando |
| Negativo | `#1E2926` | fundo do editor |

**Tipografia.** Atkinson Hyperlegible Next no texto, Atkinson Hyperlegible Mono
no código e nos valores do desenho, pesos 400 e 700. A família distingue `1`,
`l` e `I`, e `0` e `O` — o que importa numa ferramenta de defeitos de índice.
Títulos de seção em caixa normal e peso 700; nada de etiquetas em maiúsculas
espaçadas.

**Editor.** Fundo escuro, com uma família de cor por categoria do código:
lilás nas palavras-chave, verde-lima nos literais, rosa nas funções,
ciano-esverdeado nas classes, creme nas propriedades, o tom do texto nas
variáveis e cinza em comentários e pontuação. Nenhum vermelho, âmbar ou azul,
que são cores da bancada. A cor depende só da categoria, nunca do trecho.
Selecionar uma palavra contorna as outras ocorrências dela com uma caixa lilás
— forma diferente da faixa sem contorno da linha em execução.

**Ícones.** Heroicons, embutidos como SVG no build. Nenhum recurso externo em
tempo de execução: fontes e ícones vêm no pacote da aplicação.

**Padrões evitados de propósito:** fundo creme com acento terroso, tema escuro
com um acento neon, grade de cartões idênticos com a mesma sombra, etiquetas em
maiúsculas espaçadas sobre cada título, mono em rótulos miúdos.