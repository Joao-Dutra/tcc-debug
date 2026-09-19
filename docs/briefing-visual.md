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

## As quatro telas

### 1. Tela inicial

Apresenta a ferramenta e leva aos exercícios. Texto à esquerda — o que é, como
funciona, um botão para os exercícios — e, à direita, uma folha de exercício
mimeografada desenhada em SVG: vetor, pilha e lista em tinta de anilina clara,
uma lupa e um inseto. Abaixo, os três passos do trabalho, numerados porque são
uma sequência, cada um com a própria ilustração em SVG — a janela de código com
o botão, a lupa sobre a fileira, o número da linha e o lápis. No rodapé, uma
linha discreta de autoria: curso, instituição e autor. Três microanimações com nome (`folha-pousa`, `marcador-avanca`,
`lupa-investiga`), desligadas com movimento reduzido. A folha não usa nenhuma
cor de significado da bancada.

### 2. Lista de exercícios (vitrine)

Uma fileira por estrutura de dados — vetor, pilha, fila, lista encadeada —, com
filtro por estrutura. Cada exercício é um cartão com uma **miniatura**, o
título, a complexidade e, no pé, as duas aberturas — com apoio ou sem apoio. Um
dos exercícios é marcado como tutorial. Nenhum botão de exportar: a exportação
fica só no painel de métricas.

A complexidade é uma **etiqueta com palavra e cor** — introdutório em verde,
intermediário em mostarda escuro, desafiador em vinho —, no mesmo formato do
balão de tutorial. A palavra vem sempre junto: a cor nunca carrega o nível
sozinha. Os três tons foram medidos contra as cores de significado que aparecem
nas miniaturas da mesma tela, e a menor distância é ΔE 27 (ver D20).

A miniatura é o próprio visualizador da estrutura, pequeno e parado, sobre a
mesa de luz, desenhando um estado **anterior** ao defeito — nunca o quadro que
o denuncia. Exercício sem miniatura recebe no lugar o glifo da estrutura,
grande e quieto: diz do que o exercício trata sem descrever execução nenhuma.

São **duas escalas diferentes** e elas não podem ser confundidas visualmente:
*complexidade* é uma característica do exercício; *apoio* é quanta ajuda a
ferramenta oferece naquela abertura. Hoje são separadas por linha, por rótulo e
por tratamento — a complexidade é etiqueta cheia e colorida na linha de
metadados; o apoio são pílulas contornadas, numa linha própria rotulada
"abrir". O filtro escolhido é grafite, e não anilina, para não se parecer com o
apoio escolhido.

### 3. Tela de exercício — a mais importante

Cabe na janela sem rolar a página, a partir de 901 × 600 px. O estudante vê ao
mesmo tempo o código, a visualização e os casos de teste.

1. **No topo**: voltar e a escolha do apoio numa linha; título e enunciado
   logo abaixo.
2. **À esquerda, o código**, de alto a baixo: editor escuro, numeração de linhas
   e botão de executar. O estudante clica no *número* da linha para declarar
   onde acredita estar o defeito, e recebe na hora se acertou. Pode tentar
   quantas vezes quiser. Logo abaixo do editor, as linhas que ele **apontou**.
3. **À direita, a visualização**: o desenho animado da estrutura sobre a mesa de
   luz (anatomia de nó rotulada, ponteiro em seta, nulo aterrado), e numa linha
   só o indicador da linha em execução e os controles de reprodução — anterior,
   tocar, próximo, e uma barra de posição com o contador de passos.
4. **Embaixo da visualização, os casos de teste e as dicas**, que rolam por
   dentro quando falta altura; o desenho fica parado. Sem apoio não há dicas.
   Quando todos os casos passam, a faixa vira o campo verde de acerto e traz,
   ao lado do selo, o convite para ir ao próximo exercício.

As linhas apontadas aparecem da mais recente para a mais antiga: é a última
tentativa que o estudante quer conferir.

Em telas estreitas ou baixas tudo empilha e a página volta a rolar, com o
código antes da visualização.

### 4. Painel de métricas

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
| Célula ativa | azul `#2159A5` | borda contínua, opacidade cheia, sombra seca de peça pousada |
| Célula consumida | cinza de areia `#62594F` | borda tracejada em opacidade cheia; fundo e valor esmaecidos; sem sombra |
| Elemento apontado pelo marcador | âmbar `#B26500` | anel em volta da célula |
| Marcador fora da estrutura | sem cor própria | posição além da ponta, mais rótulo |
| Ponteiro nulo | sem cor própria | seta que termina em aterramento; numa variável, estacionada fora da fileira, mais rótulo |
| Ligação cíclica | vermelho `#CB473D` | gancho por baixo da fileira, seta de retorno, rótulo |
| Posição vazia da capacidade | cor da moldura `#83796B` | contorno pontilhado, sem preenchimento e sem nada dentro |

Todas passam de 3:1 sobre a mesa de luz (`#FDF9F4`): de 4,1:1 a 6,6:1. Consumida
e posição vazia ficam próximas na cor (ΔE 13) de propósito — as duas são da
família da moldura —, e é a forma que as separa.

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
  verde, com um selo de ✓ que se traça uma vez, o texto "Todos os casos
  passaram." e um convite para ir ao próximo exercício — que leva adiante o
  mesmo nível de apoio e não diz posição, quantidade nem quantos já foram
  resolvidos. É **idêntico nos dois níveis de apoio**: se variasse com o apoio, a
  diferença de desempenho entre os níveis deixaria de ser atribuível ao apoio.
  Também não pode mudar de intensidade entre pilotos.
- **Mudança pendente.** Com o código editado e ainda não executado, o botão diz
  "Executar alterações", ganha um ponto e passa a pulsar: um halo fixo e um anel
  que se abre por cima dele, sem parar, enquanto o editor estiver diferente do
  que rodou. Com movimento reduzido o anel fica parado no lugar, com a mesma
  espessura e a mesma cor — a alternativa estática precisa ser tão visível
  quanto o pulso.
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
mesa de luz onde se examina uma peça, o papel e a areia da bancada de trabalho,
o roxo de anilina das folhas mimeografadas de exercício. A página é uma sala cor
de areia, quente, onde só dois objetos têm corpo: o editor, escuro, e a
bancada da visualização, que é a superfície mais clara da tela, com uma grade
milimetrada tênue. O resto é texto pousado direto na sala, alinhado à esquerda.
A ousadia está gasta na bancada; o resto é quieto.

**Cores em escalas.** Cada família de cor é uma escala de 100 (mais clara) a
900 (mais escura) — `areia`, `anilina`, `azul`, `ambar`, `rubi`, `musgo`,
`rosa`, `ciano`, `lima`, `palha` —, com a mesma luminosidade em cada degrau
para todas as famílias. Hover, fundo sutil e borda saem de um degrau vizinho.
As regras usam papéis, e cada papel aponta para um degrau:

| Papel | Degrau | Hex |
|---|---|---|
| Sala | `areia-300` | `#EADECD` |
| Faixas (casos, dicas) | `areia-200` | `#F7EFE5` |
| Mesa de luz — só a bancada | `areia-100` | `#FDF9F4` |
| Grafite: texto, e marcadores dentro do desenho | `areia-900` | `#24201A` |
| Texto suave | `areia-700` | `#62594F` |
| Ação — a única, nunca dentro da bancada | `anilina-700` | `#603FB0` |
| Acerto — só o sinal de todos os casos passando | `musgo-700` | `#006D3C` |
| Fundo do editor | `areia-900` | `#24201A` |

Contraste sobre a sala: texto 12,2:1, texto suave 5,2:1, borda de controle
3,2:1, ação 5,6:1.

**Tipografia.** Zen Maru Gothic na interface, pesos 500 e 700 — sans
arredondada e calorosa, sem ser infantil. Atkinson Hyperlegible Mono no código e
nos valores do desenho, pesos 400 e 700, porque distingue `1`, `l` e `I`, e `0` e
`O` — o que importa numa ferramenta de defeitos de índice. Títulos de seção em
caixa normal e peso 700; nada de etiquetas em maiúsculas espaçadas.

**Foco e rolagem.** Anel de foco global para navegação por teclado — contorno
anilina de 2 px com halo claro —, inclusive em volta do editor. Barras de
rolagem no tom da superfície: areia na página, escura no editor.

**Editor.** Fundo escuro, com uma família de cor por categoria do código:
lilás nas palavras-chave, verde nos literais, rosa nas funções,
ciano-esverdeado nas classes, palha nas propriedades, o tom do texto nas
variáveis e areia em comentários e pontuação. Nenhum vermelho, âmbar ou azul,
que são cores da bancada. A cor depende só da categoria, nunca do trecho.
Selecionar uma palavra contorna as outras ocorrências dela com uma caixa lilás
— forma diferente da faixa sem contorno da linha em execução.

**Ícones.** Heroicons, embutidos como SVG no build. Nenhum recurso externo em
tempo de execução: fontes e ícones vêm no pacote da aplicação.

**Padrões evitados de propósito:** fundo creme com acento terroso, tema escuro
com um acento neon, grade de cartões idênticos com a mesma sombra, etiquetas em
maiúsculas espaçadas sobre cada título, mono em rótulos miúdos.