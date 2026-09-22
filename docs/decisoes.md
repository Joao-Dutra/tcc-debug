# Registro de decisões de projeto

Anotações de decisões arquiteturais e didáticas, com a justificativa de cada
uma. Serve a dois propósitos: manter coerência no desenvolvimento e alimentar a
seção de metodologia do artigo, que precisará justificar essas escolhas.

## D1 — Instrumentação por AST em vez de interpretador próprio

**Decisão.** O código do exercício é reescrito por transformação de AST
(`acorn` + `astring`), inserindo chamadas `__passo(linha, variaveis)` antes de
cada instrução. A execução é feita pelo próprio motor JavaScript.

**Alternativa descartada.** Escrever um interpretador para um subconjunto da
linguagem, como faz a ferramenta QuatiView com C.

**Justificativa.** Um interpretador consumiria a maior parte do tempo disponível
e traria risco de divergência semântica em relação à linguagem real. A
instrumentação entrega o mesmo resultado observável com uma fração do esforço.

**Limitação aceita.** Não capturamos estado dentro de expressões, apenas entre
instruções. Para os defeitos do catálogo isso é suficiente.

**Quadro final.** Como a sonda vai *antes* de cada instrução, o efeito da
última instrução executada não chegava a instantâneo nenhum. Quando ela era
uma escrita, o último quadro mostrava a estrutura antes dessa escrita e mentia
sobre o resultado do programa. O contorno era cada exercício terminar com
alguma instrução depois da última escrita, o que dependia de o autor lembrar.
Por isso a instrumentação passou a acrescentar uma sonda depois da última
instrução do programa, com `linha` nula: é o quadro final, e o indicador diz
que a execução terminou. Ele traz as variáveis do escopo do programa; as locais
a funções já não existem nesse ponto e ficam de fora, como no próprio
programa. Se o programa lança exceção, não há quadro final, porque a execução
não terminou.

**Corpo de classe não é instrumentado.** Os nós das listas são criados com
`new No(valor, proximo)` (D17). A classe precisa vir no topo do programa, e a
sonda dentro do construtor só enxergaria o que foi declarado antes dela —
nenhuma variável da estrutura. Cada `new No` feito dentro de uma função
produzia dois quadros sem variável nenhuma, e o desenho sumia no meio da
operação. Por isso o construtor passou a ser um passo só, no ponto do `new`,
que é como a construção de um objeto é lida em Java. O nó que ele cria aparece
no quadro seguinte.

## D2 — Código textual, não programação em blocos

**Decisão.** O estudante lê e edita código textual.

**Justificativa.** Os defeitos de interesse — condição de parada, índice
deslocado, referência incorreta — não se manifestam adequadamente em ambientes
de blocos, que restringem por construção boa parte desses erros. Registre-se que
o mapeamento publicado no WEI aponta os ambientes de blocos como os mais
frequentes na literatura brasileira, concentrados no ensino fundamental; o
público deste trabalho é o ensino superior.

## D3 — Sem backend na primeira versão

**Decisão.** Exercícios são módulos TypeScript versionados junto ao código.

**Justificativa.** Elimina infraestrutura antes de a fatia vertical estar
validada. A persistência entra quando o estudo de validação exigir coleta de
métricas, e não antes.

## D4 — Estruturas lineares primeiro

**Decisão.** Vetor, pilha, fila e lista encadeada antes de qualquer árvore.

**Justificativa.** Além de serem o conteúdo introdutório, exigem visualizadores
mais simples, o que permite validar o núcleo com menos risco. Árvores exigem
cálculo de layout e são o principal candidato a corte caso o cronograma aperte.

## D5 — Web Worker para execução

**Decisão.** O código instrumentado roda em Worker, com limite de passos e de
tempo.

**Justificativa.** Laços infinitos são resultado provável de uma edição errada
do estudante. Sem isolamento, isso trava a interface e o trabalho dele se perde.

## D6 — Métricas como log de eventos, com agregados derivados

**Decisão.** O registro da sessão é um log de eventos com carimbo de tempo
(`execucao`, `edicao`, `dica`, `localizacao`). As métricas pedidas — tempo até a
primeira execução, até a localização, até a correção, número de execuções,
dicas reveladas e edições — são **derivadas** desse log em `resumirSessao`, e
não armazenadas em separado. O resumo acompanha o JSON exportado por
conveniência da análise, mas nunca é a única cópia do dado.

**Alternativa descartada.** Guardar apenas os contadores e os tempos agregados.

**Justificativa.** O agregado só responde às perguntas que já sabíamos formular
na hora de escrever o código. O log responde também às que surgirem ao olhar os
dados — se o estudante executou logo depois de abrir uma dica, quantas vezes
quebrou o código antes de acertar. O experimento não tem segunda chance.

**Detalhes que decorrem disso.**

- Durações vêm de relógio monotônico (`performance.now()`), com um único carimbo
  de relógio de parede no início. `Date.now()` salta se o relógio do computador
  se ajustar durante a sessão, e o salto corromperia em silêncio justamente as
  medidas que sustentam o estudo.
- A execução disparada ao abrir o exercício é registrada com
  `origem: 'automatica'` e fica fora das métricas. Sem essa separação, "tempo
  até a primeira execução" seria zero para todo participante.
- Cada evento de execução guarda o **código completo** executado. Como os casos
  de teste são avaliados contra o código do estudante, é possível satisfazê-los
  sem corrigir defeito algum; só o código guardado permite separar, na análise,
  correção de teste satisfeito na marra.
- Ausência de um marco é `null`, nunca `0` — "não corrigiu" não pode colidir com
  "corrigiu instantaneamente".
- O registro carrega `versao`, porque o formato vai mudar quando a persistência
  entrar (ver D3) e os dados da versão 1 precisam continuar legíveis.
- Toda tentativa de localização entra no log, tendo acertado ou errado (ver D7).
- Nenhum contador da sessão é exibido ao estudante. Mostrar quantas vezes ele
  executou ou quantas dicas abriu muda o comportamento que o estudo quer medir.

**Limitação aceita.** Nesta fatia o registro vive só na memória do navegador e
se perde ao recarregar a página. Fixar quais dados são coletados e em que
formato é o que importa agora; onde eles ficam é problema da fatia de
persistência.

*Substituída por D15:* as sessões arquivadas passaram a ter um espelho no
navegador e sobrevivem a recarregar a página. A persistência em servidor
continua sendo outra fatia.

**A registrar no termo de consentimento.** O registro contém o código escrito
pelo participante, e não apenas tempos e contagens.

## D7 — Declaração de localização com veredito imediato

**Decisão.** O estudante clica no número da linha para declarar onde acredita
estar o defeito. O sistema compara com `linhaDoDefeito` e informa na hora se
acertou. As tentativas são ilimitadas, e todas — certas e erradas — viram
eventos `localizacao` na sequência da sessão, com a linha apontada e o
resultado.

**Justificativa.** Localizar e corrigir são duas etapas distintas do trabalho de
depuração, e o estudo precisa medi-las em separado: um estudante pode enxergar
o defeito rápido e demorar para consertar, ou o contrário. Sem a declaração, só
existe o instante da correção, e as duas etapas ficam indistinguíveis.

**Por que o alvo é o número da linha, e não o texto.** A edição não é bloqueada
pela declaração — o estudante pode mexer no código antes de apontar, se essa for
a estratégia dele, e registrar a estratégia é justamente o objetivo. Se apontar
fosse clicar no código, cada vez que ele posicionasse o cursor para digitar
estaria declarando um palpite. O gutter é um alvo separado que não disputa com
a digitação.

**Nada é destacado antes da declaração.** Nem cor, nem ícone, nem console. A
comparação acontece dentro do núcleo, que devolve apenas o veredito; a interface
nunca recebe a linha do defeito. A tela só ecoa as linhas que o próprio
estudante apontou.

**Risco aceito: o veredito é um oráculo.** Com resposta imediata e tentativas
ilimitadas, é possível varrer as linhas até acertar sem investigar nada — o
exercício da pilha tem 24 linhas. A contrapartida é que a varredura fica
registrada: como toda tentativa entra no log com carimbo de tempo, a análise
distingue quem investigou de quem varreu, pelo número de tentativas, pelo
intervalo entre elas e pelo que aconteceu no meio. Se o piloto mostrar
varredura, dá para limitar as tentativas ou atrasar o veredito sem alterar o
formato do dado.

**Limitação conhecida.** Sem backend (D3), o catálogo inteiro é entregue ao
navegador: `linhaDoDefeito` e `codigoCorreto` estão no pacote e podem ser lidos
com as ferramentas de desenvolvedor. A interface não revela nada, mas a resposta
está ao alcance de quem procurar. Fechar isso exigiria mover a verificação para
o servidor.

## D8 — Navegação por hash e uma sessão por abertura

**Decisão.** A aplicação passa a ter duas telas — lista de exercícios e
exercício — com roteamento por hash: `#/` e `#/exercicio/<id>`.

**Alternativa descartada.** React Router.

**Justificativa.** A única exigência é que cada exercício tenha URL própria,
para que um link direto possa ser enviado a um participante do estudo. O hash
entrega isso sem dependência nova e sem exigir configuração de servidor para
reescrever rotas, o que importa para a publicação estática prevista. Se um dia
for preciso rota aninhada ou navegação programática, a troca fica contida em
`usar-rota.ts`.

**A tela do exercício não conhece exercício nenhum.** Ela recebe o exercício por
propriedade e descobre o visualizador em um registro que mapeia
`TipoEstrutura` para componente. O mapa é parcial de propósito: vetor e lista
encadeada ainda não têm visualizador, e a tela trata a ausência em vez de
fingir que existe. Com isso, acrescentar exercício ou visualizador não toca em
`App.tsx`.

**Uma sessão de métricas por abertura.** Abrir um exercício inicia a sessão;
sair encerra. Reabrir o mesmo exercício começa outra, com id próprio — duas
tentativas do mesmo exercício são eventos diferentes do ponto de vista do
estudo e não podem ser somadas.

**Por que existe um arquivo de sessões em memória.** "Encerrar ao sair" só tem
sentido se a sessão sobreviver à navegação. Sem isso, trocar de exercício
apagaria o registro do anterior e a exportação enxergaria apenas o exercício
aberto no momento. As sessões encerradas ficam em uma lista de módulo, que é
exatamente "a memória" desta etapa (ver D6) e some junto com a página — até
D15, que lhe deu um espelho no navegador. Arquivar
é idempotente por id, o que atualiza o retrato em vez de duplicá-lo e cobre de
quebra o ciclo monta/desmonta/monta do StrictMode.

**O campo `tutorial` é dado do catálogo.** Marcar o exercício de entrada por um
campo em `Exercicio`, e não por um identificador fixo dentro da tela, mantém a
tela genérica e deixa a escolha onde ela pertence.

**A ordem do catálogo é progressão didática.** Vetor, pilha, fila e lista
encadeada, e dentro de cada estrutura por complexidade crescente — a ordem em
que a disciplina apresenta as estruturas, e não a ordem em que os exercícios
foram escritos.

**O exercício de entrada é de vetor.** É a estrutura mais simples e a única
sem marcadores próprios: o desenho tem as posições e o índice, e nada mais. O
estudante aprende a ler a ferramenta antes de precisar acompanhar topo, início
e fim ao mesmo tempo. Antes o tutorial era o da pilha, que já pedia a leitura
de um marcador. Por ser o primeiro contato com a ferramenta, o enunciado do
tutorial também explica a tela: onde ficam os casos de teste, o que os
controles da visualização fazem, que clicar no número da linha declara a
suspeita e que o editor aceita correções.

**Ordem de apresentação não é sequência obrigatória.** Nenhum exercício é
bloqueado, e todos ficam abertos nos dois níveis de apoio desde o começo. Impor
sequência criaria progresso — quem parou onde —, que é justamente o que esta
tela não mostra, e limitaria o participante à ordem prevista quando o estudo
manda o link direto do exercício (ver D9).

**Nada de progresso na lista.** Sem marcação de resolvido, pontuação ou
histórico. Saber de antemão quais exercícios já caíram muda a forma como o
estudante encara os que faltam, e não há hipótese no trabalho que justifique
esse efeito.

**Exportação alcançável das duas telas.** A tela inicial também exporta, para
que as sessões arquivadas não fiquem inacessíveis depois que o participante
volta do exercício. As duas telas chamam a mesma função do núcleo
(`exportarMetricas`), de modo que existe uma exportação só. O botão da tela
inicial não mostra contagem nem resumo, e aparece mesmo quando não há sessão
guardada: escondê-lo revelaria que o participante ainda não abriu exercício
algum, que é exatamente o progresso que esta tela não exibe.

## D9 — Andaime como parâmetro independente do exercício

**Decisão.** O nível de andaime (*scaffolding*) é um parâmetro da sessão, e não
uma propriedade do exercício. O mesmo exercício pode ser apresentado
`com-apoio` ou `sem-apoio`. O nível vem da URL
(`#/exercicio/<id>?andaime=<nivel>`), é registrado na sessão de métricas e,
quando ausente ou inválido, assume `com-apoio`. Até o primeiro piloto eram três
níveis — ver "Dois níveis, depois do piloto", abaixo.

**Alternativa descartada.** Embutir o nível de apoio em cada exercício, de modo
que os exercícios iniciais fossem naturalmente mais assistidos e os finais menos.

**Justificativa teórica.** A noção de andaime descreve o apoio que um agente
mais capaz oferece ao aprendiz para que este realize uma tarefa além da sua
competência atual, apoio que deve ser progressivamente retirado à medida que a
competência se estabelece (Wood, Bruner e Ross, 1976). A retirada gradual —
*fading* — é parte constitutiva do conceito: andaime que não é removido deixa de
ser andaime e passa a ser muleta.

**Justificativa metodológica, que é a razão principal.** Se o nível de apoio
estivesse embutido no exercício, ele variaria junto com a dificuldade
intrínseca da tarefa, e as duas coisas ficariam confundidas: um desempenho pior
nos exercícios finais não poderia ser atribuído nem à retirada do apoio nem ao
aumento da dificuldade. Como parâmetro independente, o mesmo exercício pode ser
comparado consigo mesmo sob apoios diferentes, o que permite ao estudo tratar a
retirada do andaime como variável, e não apenas descrevê-la.

**O que varia com o nível.**

| Andaime | `com-apoio` | `sem-apoio` |
|---|---|---|
| Dicas disponíveis | três | nenhuma |
| Casos de teste | esperado e obtido | apenas que algo falhou |
| Legendas de orientação no desenho | sim | não |
| Índices e rótulos dos marcadores | sim | não |
| Linha em execução destacada no editor | sim | não |
| Indicador textual da linha em execução | sim | sim |

Sem apoio restam o valor guardado em cada posição e a forma e a posição dos
marcadores: relacionar o marcador à variável do código volta a ser trabalho do
estudante.

**Dois níveis, depois do piloto.** Até o primeiro piloto a escala tinha três
níveis — `completo`, `parcial` e `minimo` —, e a visualização tinha três
degraus, para que o apoio parcial não caísse quase ao mínimo. O piloto de
18/09/2026 (ver `docs/roadmap.md`) mostrou outra coisa: das 25 sessões
abertas, 16 foram com apoio completo, 6 com parcial e 3 com mínimo, e os níveis
reduzidos foram quase sempre abandonados. Um degrau intermediário que quase
ninguém usa não sustenta comparação e custa superfície: mais uma coluna em cada
tabela, mais um caso em cada visualizador, mais um grupo a recrutar. A escala
passou a ter dois níveis, que mantêm o essencial — a variável que permite
comparar o mesmo exercício sob condições diferentes, sem a qual o estudo perde
o grupo de comparação.

O mapeamento entre as escalas, para a análise:

| Escala antiga (registro versão 2) | Escala nova (registro versão 3) |
|---|---|
| `completo` | `com-apoio`, que oferece exatamente o que o completo oferecia |
| `parcial` | sem correspondente — o nível deixou de existir |
| `minimo` | `sem-apoio`, que oferece exatamente o que o mínimo oferecia |

Como o conjunto de valores do campo `andaime` mudou, `VERSAO_DO_REGISTRO` subiu
para 3. As sessões já coletadas continuam legíveis e trazem a versão 2. Quanto
ao apoio, `completo` e `com-apoio` podem ser tratados na análise como a mesma
condição, e `minimo` e `sem-apoio` também, porque o que a interface revela em
cada par é idêntico — o que não dispensa conferir se o próprio exercício mudou
entre as coletas. As sessões `parcial` ficam à parte, sem correspondente na
escala nova.

**Por que os níveis têm nome e não número.** A numeração media quantidade de
apoio e portanto crescia na direção contrária à da dificuldade — o nível 3 era
o mais fácil. É uma inversão fácil de aplicar errado ao ler os dados, e o erro
seria silencioso. Além disso "nível" já designa a dificuldade intrínseca do
exercício, que é propriedade dele e não da sessão; manter as duas escalas com o
mesmo vocabulário convidava a confundir justamente o que a análise precisa
separar.

**O que não varia com o nível.** O código do exercício, os casos avaliados, os
instantâneos gerados, a instrumentação e o registro de métricas. O andaime é exclusivamente aquilo que a
interface revela; o núcleo não o conhece. Essa fronteira é o que garante que
duas sessões do mesmo exercício sob níveis distintos sejam comparáveis.

**Dificuldade intrínseca continua sendo propriedade do exercício.** O tamanho do
programa, a distância entre o defeito e o seu sintoma e o fato de o defeito se
manifestar apenas em entradas de borda pertencem ao exercício e são declarados
nele. Manter essa separação explícita é o que sustenta a análise.

**O nível passou a ser escolhível pela interface.** Cada exercício da lista
oferece as duas aberturas dentro de um único cartão, e a tela do exercício
mostra qual está ativo e permite trocar. Trocar encerra a sessão e começa
outra, conforme D8 — inclusive descartando o código já editado, porque duas
tentativas sob apoios diferentes não podem ser somadas e um código carregado de
uma para a outra contaminaria a comparação.

**Consequência para o estudo, que é o que importa aqui.** A escolha pela
interface serve ao uso livre da ferramenta e ao piloto, não ao experimento. No
experimento o nível é **fixado pelo link enviado ao participante**
(`#/exercicio/<id>?andaime=<nivel>`), e não escolhido por ele: se o participante
pudesse escolher, o nível deixaria de ser variável manipulada e viraria
resultado da decisão dele, confundido com a competência que se quer medir.
Quem escolhe o apoio é quem monta a sequência de exercícios.

**Trocar de nível no meio da tarefa é para detectar, não para impedir.** A
interface não trava a troca, e não vai travar. O participante recebe um link
com o nível fixo; se ainda assim ele subir o apoio no meio da tarefa — o que a
interface permite —, isso é um dado sobre o que aconteceu, e não um acidente a
ser evitado por bloqueio.

A razão é metodológica antes de ser prática. Bloquear esconderia o
comportamento: o participante que precisou de mais apoio continuaria travado na
tarefa, e o registro mostraria apenas uma sessão longa e malsucedida, sem
diferenciar quem não conseguiu de quem teria conseguido com mais apoio. Deixar
acontecer transforma um confundidor invisível em um evento observável.

**Como detectar.** A troca produz duas sessões do mesmo exercício com `andaime`
diferente e horários encostados: a primeira encerrada e arquivada, a segunda
aberta em seguida, ambas com `exercicioId` igual (ver D8). No painel de
métricas isso aparece como duas linhas vizinhas do mesmo exercício com apoios
distintos. O critério de análise fica combinado desde já: sessão cujo apoio foi
elevado durante a tarefa não entra na comparação entre níveis, e é relatada à
parte — porque o que ela mede é a decisão de pedir ajuda, que é outra pergunta,
e não menos interessante.

**Consequência prática.** Nada precisa ser implementado agora para sustentar
isso: o registro já distingue as duas sessões, e a regra de análise existe
antes de os dados existirem, que é a ordem certa.

**Consequência para a leitura da lista.** O campo `dificuldade` continua com
esse nome no modelo, mas é exibido como *complexidade*, em linha e tratamento
visual distintos dos das aberturas. Chamar as duas escalas de "nível" fazia a
dificuldade do exercício ser lida como se fosse o apoio, que é exatamente a
confusão que D9 existe para evitar.

**A linha em execução tem dois portadores, e só um entra no *fading*.** O
indicador de linha (ver D10) é, ele próprio, um andaime: faz pelo estudante o
trabalho de relacionar o código à representação. Por isso ele se divide em
dois. O indicador textual ("Executando a linha N") aparece nos dois níveis. O
destaque de marca-texto da mesma linha no editor aparece `com-apoio` e some
`sem-apoio`.

Sem apoio resta o número, e achar essa linha no código — relacionar o passo ao
programa — volta a ser trabalho do estudante. O texto fica nos dois níveis por
ser também o principal recurso de legibilidade da ferramenta: sem ele, o nível
sem apoio deixaria de ser apoio reduzido e viraria um quadro sem legenda. O
destaque sai junto com os rótulos dos marcadores, pelo mesmo motivo: sem apoio
sai o que faz a correspondência pelo estudante, e fica o que ele precisa para
fazê-la sozinho.

O destaque obedece à mesma regra do indicador: deriva do instantâneo exibido
e nunca conhece a linha do defeito. Marca o número de linha que o indicador
mostra, mesmo que o código tenha sido editado desde a execução, e some quando
não há execução carregada — antes da primeira, ou depois de um erro de
sintaxe. Quando a linha marcada está fora de vista, o editor rola só o
necessário para mostrá-la. Rola só o editor: a página não se mexe, para
quem está olhando a visualização não ser levado de volta ao código a cada
passo.

**Como o destaque se distingue do resto da tela.** Três decisões tomadas junto
com ele:

- *A cor é uma faixa quase neutra da paleta de base*: `--traco-estrutura` a 24%,
  translúcida. (Valores da direção 2a; com o editor escuro de D19, a faixa
  passou a branco translúcido a 13%, e continua neutra.) O bege é da família do âmbar do elemento apontado, e o que
  separa os dois é a saturação — a faixa tem croma 2,8, o âmbar 52 — e a forma:
  faixa atrás do texto contra anel em volta de uma célula. A faixa fica a
  ΔE ≥ 49 de todas as cores com significado de D10 e das cores do veredito de
  localização. É translúcida porque o editor desenha a seleção por baixo do
  texto, e um fundo opaco a esconderia na linha destacada.
- *Só no conteúdo, nunca no gutter.* O gutter é o alvo da declaração de
  localização (D7). O retorno do palpite fica no painel "Onde você apontou" e
  não passa pelo editor, então o destaque não tem como se sobrepor a ele nem
  apagá-lo. E clicar numa linha para declarar não mexe no destaque.
- *Sai o destaque da linha do cursor*, que o editor liga por padrão. Era uma
  segunda faixa, azul-clara, seguindo o cursor, e disputaria com a da
  execução. A versão dela no gutter, justamente onde se declara, poderia ser
  lida como marca de um palpite.

## D10 — Melhorias na visualização e indicador de linha

**Decisão.** A representação gráfica ganha três recursos: distinção cromática
entre células ativas e consumidas, destaque animado do elemento apontado pelos
marcadores, e um indicador da linha em execução exibido junto à animação.

**Justificativa.** A visualização é o instrumento de investigação do estudante e
precisa ser legível o suficiente para que uma anomalia salte aos olhos. Sem
distinção visual entre o que está na estrutura e o que já saiu dela, o sintoma
de um defeito de índice se confunde com o funcionamento normal.

**O indicador de linha resolve o custo de alternância.** Sem ele, o estudante
precisa manter mentalmente a correspondência entre a instrução que está sendo
executada e o quadro que vê. Esse esforço não é o objeto de estudo do trabalho —
o objeto é a formulação de hipóteses sobre a causa do defeito — e consumir
memória de trabalho com a sincronização atrapalha justamente a atividade que se
quer observar.

**Regra que os recursos novos não podem violar.** Todo destaque deriva do estado
real da execução, nunca do comportamento correto. Se um marcador aponta para
fora da estrutura ou para um elemento já consumido, é isso que a animação
mostra. A ferramenta não sabe qual seria o elemento certo, e não deve dar a
entender que sabe: o estado inválido é o conteúdo pedagógico (ver a skill
`criar-visualizador`).

**Limite deliberado.** O destaque indica *qual elemento o programa vai tratar em
seguida*, segundo os marcadores atuais — não *qual elemento deveria ser tratado*.
A diferença entre as duas coisas é exatamente o que o estudante precisa
descobrir sozinho.

**Os seis estados.** Cada um é sinalizado por cor e também por forma, e a forma
é tão parte do significado quanto a cor. A descrição de cada estado diz o que
ele é, nunca se está certo ou errado — a ferramenta desenha o estado e não
opina sobre ele.

| Estado | Cor | Forma que acompanha |
|---|---|---|
| Célula ativa | azul | borda contínua, opacidade cheia |
| Célula consumida | cinza | borda tracejada em opacidade cheia; fundo e valor esmaecidos |
| Elemento apontado pelo marcador | âmbar | anel em volta da célula |
| Marcador fora da estrutura | sem cor própria | posição além da ponta, mais rótulo |
| Ponteiro nulo | sem cor própria | seta que termina em aterramento; numa variável, estacionada fora da fileira, mais rótulo |
| Ligação cíclica | vermelho | gancho por baixo da fileira, seta de retorno, rótulo |
| Posição vazia da capacidade | cor da moldura | contorno pontilhado, sem preenchimento e sem nada escrito dentro |

**O sétimo estado: posição vazia da capacidade.** É a posição que existe no
vetor de capacidade fixa e nunca recebeu valor. Não se confunde com a célula
consumida, e a diferença é conceitual antes de ser visual: uma é espaço que
nunca foi usado, a outra é elemento que saiu da estrutura.

A distinção é carregada pela forma, e não pela cor: a vazia é pontilhada e não
tem nada dentro; a consumida é tracejada e mostra o valor esmaecido. É a
ausência de conteúdo que separa as duas, o que sobrevive à escala de cinza e ao
nível sem apoio. A cor acompanha: a vazia usa `--posicao-vazia`, um traço de
estrutura escurecido até 3,2:1 sobre a bancada — da família da moldura, como a
base da pilha e o contorno da fileira, e não da tinta do conteúdo. Contra a
consumida ela fica a ΔE 12, que é a contrapartida de escurecer o bastante para
alcançar contraste; por isso a forma é que decide.

**Capacidade fixa ou dinâmica é propriedade do exercício.** O exercício de
capacidade fixa declara `capacidade` no próprio código, e a variável é
observada como `topo`. O visualizador desenha o contorno da capacidade quando
ela existe, e só os blocos que existem quando ela não existe — em pilha
dinâmica os blocos simplesmente aparecem conforme entram.

Não é escolha do estudante, e não podia ser: dois participantes no mesmo
exercício precisam ler o mesmo código e ver o mesmo desenho, senão a
comparação entre eles deixa de valer. Também não é um campo novo em
`Exercicio`: o visualizador é puro e não recebe o exercício (ver a skill
`criar-visualizador`), então a informação chega por onde tudo chega, que é o
instantâneo.

**A opacidade reduzida não alcança a borda da célula consumida.** Opacidade
sinaliza "apagado"; o tracejado carrega a forma, e forma não pode perder
contraste. Com a célula inteira a 0,45, o tracejado caía a 1,8:1 sobre a
bancada, abaixo dos 3:1 pedidos para elementos gráficos. E a célula consumida é
justamente o estado que denuncia defeito de índice: a 1,8:1 ela não é
distinguível por quem tem baixa visão ou está numa tela mal calibrada. Os 0,45
passam a valer só para o fundo e para o que está dentro da célula — valor,
índice, rótulos —, e o tracejado fica em opacidade cheia, a 4,6:1.

O mesmo vale para a ligação que um nó fora da cadeia ainda mantém, na lista
encadeada: tracejada, em opacidade cheia. Ela é só traço e ponta, sem conteúdo
a esmaecer, e é ela que mostra para onde o nó destacado ainda aponta. Esmaecida
a 0,45, caía ao mesmo 1,8:1 da célula consumida. As demais referências de fundo
com contraste baixo — o contorno da fileira, a base da pilha, as divisórias
internas do nó — ficam como estão: não são fronteira de estado.

**Arranjo da tela do exercício.** De cima para baixo: enunciado e casos de
teste em faixas de largura inteira; código e visualização lado a lado, com a
mesma altura; dicas e o retorno da declaração de localização embaixo. Em telas
estreitas, código e visualização empilham nessa ordem — primeiro o código, que
é onde o estudante age.

Os casos de teste passaram a ser o primeiro painel depois do enunciado. O teste
que falha é o que motiva a investigação: é o ponto de partida, e não o
resultado dela. Antes ficavam no rodapé, junto do retorno da declaração, o que
os lia como consequência. O que cada nível de andaime revela deles não muda
(D9).

*Ponteiro nulo* se chamava *ligação perdida* até D14. O nome antigo julgava:
descrevia como perda o fim de uma lista correta, onde nada se perdeu e o último
nó simplesmente não aponta para lugar nenhum.

## D11 — Painel de métricas em rota própria, fora da navegação

**Decisão.** As sessões arquivadas são inspecionadas em `#/metricas`, rota não
referenciada por nenhum elemento de navegação das demais telas.

**Justificativa.** O painel é instrumento de análise do pesquisador, não parte da
experiência do participante. Exibir contagens, tempos ou histórico a quem está
resolvendo os exercícios introduziria efeito de placar sobre o comportamento
medido, o que contraria D6 e D8.

**Por que não uma exportação apenas.** A exportação em JSON continua sendo a via
de saída dos dados, mas conferir se a coleta está correta durante o piloto exige
olhar os dados enquanto se usa a ferramenta. Sem o painel, um defeito de
instrumentação só apareceria depois do experimento, quando não há remédio.

**Acesso.** Não há autenticação. A rota é obscura, não protegida — o que basta
para o cenário de uso, em que a sessão do participante é acompanhada
presencialmente. Se a ferramenta vier a ser distribuída sem acompanhamento, a
proteção passa a depender da fatia de persistência (ver D3).
## D12 — Identidade dos nós no instantâneo

**Decisão.** A serialização do instantâneo passa a preservar a identidade dos
objetos: cada objeto visitado recebe `__id`, e uma segunda visita ao mesmo
objeto vira `{ __ref: id }`. O limite de profundidade sobe de 5 para 200 e
deixa de ser o que termina a recursão — disso passa a cuidar a detecção de
ciclo. O resultado dos casos de teste é serializado **sem** identidade, em
função própria.

**O que motivou.** Uma estrutura encadeada é um grafo, não uma árvore, e a
cópia profunda anterior perdia as duas propriedades que importam. Medido antes
de mexer:

- **Listas legítimas eram corrompidas.** Com o limite em 5, uma lista de seis
  nós produzia cinco nós reais mais um sexto com `valor: "…"` e
  `proximo: "…"`. Não era truncamento silencioso: a reticência ocupava o campo
  de valor, e o desenho a exibiria como se fosse o conteúdo guardado ali.
- **Ciclo virava lista reta.** Um ciclo entre dois nós não travava — o limite
  de profundidade barrava a recursão em 0 ms —, mas serializava como
  `1 → 2 → 1 → 2 → 1 → (fantasma)`, indistinguível de uma lista de cinco nós
  com valores repetidos. Um `proximo` mal atribuído pelo estudante ficaria
  escondido pela própria ferramenta, que é o oposto do que o trabalho defende.
- **A identidade sumia.** No programa, `cabeca.proximo.proximo === atual`; no
  instantâneo, os dois viravam cópias independentes. Resolver para onde um
  ponteiro aponta virava inferência por comparação de subárvore — que funciona
  para referência perdida e para nó removido, mas não para ciclo.

**Por que os casos de teste ficam de fora.** O valor esperado é escrito à mão
no exercício. Um `__id` no valor obtido impediria a comparação com um literal
simples, e exigiria que todo exercício com expectativa de objeto conhecesse o
formato interno da serialização. Essa função mantém a cópia profunda de antes,
acrescentando apenas o corte de ciclo.

**O que não muda, e foi verificado.** Vetores continuam vetores, sem campo
acrescentado, porque os visualizadores de vetor, pilha e fila dependem desse
formato. A conferência foi feita executando os quatro exercícios do catálogo
antes e depois da alteração e comparando instantâneos e resultados: idênticos
byte a byte.

**Versão do registro.** `VERSAO_DO_REGISTRO` vai a 2 (ver D6). Vale registrar
que os campos do registro exportado não mudaram — instantâneos não entram nele,
só eventos e resumo. A versão marca o ambiente de coleta, para que uma sessão
gravada antes da mudança continue distinguível na análise.

## D13 — Nenhum recurso externo em tempo de execução

**Decisão.** A aplicação não carrega nada de fora da própria origem enquanto
roda: nenhuma fonte, ícone, imagem, folha de estilo ou biblioteca vinda de CDN
ou de serviço de terceiros. Tudo o que a tela usa entra no pacote do build. As
fontes da tela de exercício — Space Grotesk e JetBrains Mono — vêm dos pacotes
`@fontsource`, e o Vite copia os arquivos para dentro do próprio build.

**Justificativa.** A aplicação precisa funcionar com a máquina desconectada. Não
controlamos a rede do laboratório no dia do experimento, e um recurso que não
carrega não falha de forma visível: uma fonte que não chega é trocada pela do
sistema, com outra largura e outra altura de linha, e isso desloca o layout —
rótulos que cabiam passam a vazar, o código quebra em outro ponto. Seria uma
diferença de condição entre participantes que nenhum registro mostraria.

**O que a regra cobre, daqui em diante.** Fonte, ícone, imagem, folha de estilo e
script. Ícone é SVG escrito no próprio componente; biblioteca entra como
dependência do `package.json`, nunca por `<script src>` ou `<link>` apontando
para fora.

**Só o subconjunto latino.** São importados apenas os arquivos `latin` dos pesos
usados — Space Grotesk 400, 500 e 600; JetBrains Mono 400, 500 e 700 —, que
cobrem o português inteiro, com acento, cedilha e til. Os subconjuntos
vietnamita, cirílico e grego ficariam no pacote sem uso.

**Licença.** As duas famílias são OFL-1.1, que permite empacotá-las e
redistribuí-las junto com a aplicação.

*Atualizada por D19:* as famílias passaram a ser Zen Maru Gothic na interface
e Atkinson Hyperlegible Mono no código, também OFL-1.1 e empacotadas do mesmo
jeito, e os ícones vêm do pacote Heroicons, embutidos como SVG.

## D14 — Anatomia rotulada na lista encadeada (direção 2a)

**Decisão.** O nó da lista encadeada passa a ser desenhado com a anatomia
aberta: dois compartimentos, o do valor e o da ligação, com o nome de cada campo
na faixa do topo. A ligação é uma seta que sai de dentro do compartimento; um
ponteiro sem destino termina em aterramento — dois traços paralelos, o de cima
mais longo. Os ponteiros continuam desenhados fora dos nós.

**Os rótulos vêm do instantâneo, não do componente.** O recurso se justifica
pela correspondência entre o desenho e o código que o estudante lê. Um
exercício que chame os campos de `info` e `seguinte` precisa ver `info` e
`seguinte` no nó; um rótulo fixo em `valor` e `proximo` divergiria do código e
anularia justamente o que o recurso oferece.

**Como a ligação é reconhecida.** O instantâneo traz os nomes dos campos, mas
não o papel de cada um. É tratado como ligação o campo que, em algum nó daquele
instantâneo, aponta para outro nó ou referência; os demais são valor. Um nó com
exatamente um campo de cada é desenhado nos dois compartimentos.

**Limitação conhecida.** Quando a regra não fecha, o nó é desenhado sem
compartimentos, como bloco único com uma linha `campo: valor` por campo, em vez
de adivinhar. Isso acontece em três casos:

- **Nó sozinho.** Um `null` não prova que o campo é ligação, então um nó isolado
  cuja ligação é nula não tem campo de ligação reconhecível — seja qual for o
  seu valor.
- **Mais de um campo de valor**, como `{ valor, prioridade, proximo }`: não cabe
  nos dois compartimentos. A ligação ainda é seguida.
- **Mais de uma ligação**, como `anterior` e `proximo`: não há como saber qual
  caminho a fileira segue. A caminhada para ali, e os nós não alcançados são
  desenhados sem o traço de consumido, porque não dá para afirmar que saíram da
  cadeia.

Nenhum dos três ocorre no catálogo atual: o exercício da lista nunca fica com
menos de dois nós, e todo nó tem um valor e uma ligação.

**Solução definitiva.** O papel de cada campo precisa ser declarado pelo
exercício e repassado pelo núcleo até o instantâneo. O visualizador não pode
conhecer o exercício (é componente puro, ver a skill `criar-visualizador`), então
a informação só pode chegar a ele pelo dado que ele já recebe.

**O aterramento marca ausência de destino, onde quer que apareça.** Inclusive no
fim normal da cadeia. Por isso o estado passou a se chamar *ponteiro nulo* (ver
os seis estados em D10): o desenho registra que não há destino e não julga se
aquilo é certo ou defeituoso. O ponteiro nulo numa variável, como `atual = null`,
continua distinguível do fim da cadeia pela posição — estacionado fora da
fileira, com a seta descendo ao aterramento — e pelo rótulo `= null`, que segue
o fading de D9.

**Espaço: três nós por fileira.** Com o nó de 118 px da 2a, três é o que cabe no
painel de visualização sem os nomes de campo, em 9 px, ficarem ilegíveis. A
partir do quarto nó alcançável, a seta do terceiro vai até uma reticência (`…`)
logo depois dele, e um ponteiro que aponte para um nó além da janela estaciona
junto dela, com o rótulo "fora da fileira". A reticência não segue o fading; o
rótulo, sim. Não está resolvido, e precisa estar antes dos próximos exercícios
de lista, que devem ter quatro ou cinco nós: hoje o estudante veria os dois
últimos apenas como reticência. Caminhos possíveis — fileira que quebra em duas
linhas, nó mais estreito, janela que acompanha o ponteiro de trabalho — ficam
para quando esses exercícios forem escritos.

## D15 — Espelho das sessões arquivadas no navegador

**Decisão.** O arquivo de sessões encerradas continua em memória, como em D8, e
ganha um espelho no `localStorage` do navegador. Ao iniciar, o que houver no
espelho volta ao arquivo; a cada arquivamento, o arquivo inteiro é gravado nele.
A memória segue sendo a fonte, e o espelho existe só para sobreviver a recarregar
ou fechar a aba.

**O que isto substitui.** A limitação anotada em D6: o registro se perdia ao
recarregar a página.

**O que isto não substitui.** A persistência em servidor (D3), que continua
condicionada ao formato do estudo. O `localStorage` é da máquina, não do estudo:
não reúne sessões de máquinas diferentes, não sobrevive a limpar os dados do
navegador e não é cópia de segurança. A via de saída dos dados continua sendo a
exportação em JSON.

**O formato não muda.** O espelho guarda a mesma lista de registros que a
exportação envelopa, e a exportação sai igual. Cada registro volta com a
`versao` de quando foi coletado — é ela que, como antes, distingue coletas de
formatos diferentes. `VERSAO_DO_REGISTRO` continua em 2: nenhum campo do
registro mudou.

**A sessão em curso também.** Recarregar ou fechar a aba não desmonta a tela, e
o React não roda o encerramento nesse caso. Por isso a sessão aberta é arquivada
também no evento `pagehide`; sem isso, justamente a sessão em andamento seria a
única perdida. O limite que resta: se o navegador travar ou a máquina desligar
sem descarregar a página, a sessão em curso se perde; as já arquivadas, não.

**Limpar entre participantes.** A mesma máquina serve a vários participantes, e o
espelho faria as sessões de um se misturarem às do seguinte. O painel de
métricas (D11) ganha um botão que apaga memória e espelho juntos — só o espelho
não bastaria, porque o próximo arquivamento gravaria a memória de volta. O botão
pede confirmação, porque apagar é irreversível e é dado de pesquisa. O
procedimento entre participantes fica: exportar, conferir o arquivo, limpar.

**Falhas não derrubam a coleta.** Se o navegador recusar a gravação — cota
cheia, armazenamento bloqueado —, o arquivo em memória segue inteiro e o painel
avisa para exportar antes de recarregar. Se o que estiver guardado não puder ser
lido ao iniciar, os registros válidos voltam e o conteúdo original é preservado
numa chave à parte, em vez de ser sobrescrito no próximo arquivamento: dado não
coletado não volta, e dado ilegível ainda pode ser recuperado à mão. Se nem a
cópia à parte puder ser feita, o espelho é desligado naquela carga da página, e
o original fica intacto.

**A registrar no termo de consentimento.** Até ser limpo, o registro — com o
código escrito pelo participante (D6) — fica gravado no disco da máquina do
laboratório, e não apenas na memória da página.

## D16 — Quadro-denúncia verificado por execução

**Decisão.** Todo exercício precisa divergir da sua versão correta em estado
observável, e isso é verificado executando as duas versões, não lendo o código.
As sequências de instantâneos das duas versões, restritas às
`variaveisObservadas` — que é tudo o que a visualização recebe —, são
comparadas, e o exercício é recusado se:

1. as sequências forem idênticas, ou divergirem em um único quadro; ou
2. as *trajetórias de estados* forem idênticas. A trajetória é a sequência de
   estados sem as repetições consecutivas: ignora em que linha e em que
   momento o estado muda, e fica só com quais estados ocorrem, em ordem.

O teste `src/exercicios/quadro-denuncia.test.ts` aplica os dois critérios ao
catálogo inteiro, pela mesma lógica do Worker. A skill `criar-exercicio` torna
a verificação obrigatória.

**O que motivou.** Num teste com usuário, o defeito do exercício
`pilha-desempilhar` — o tutorial, justamente o que precisa do quadro-denúncia
mais claro — não aparecia na visualização. O defeito original decrementava o
topo antes de ler o elemento, e `desempilhar()` devolvia o elemento errado; mas
a pilha atravessava os mesmos estados, na mesma ordem, com e sem o defeito.
Mudava só *quando* o topo descia em relação à linha, e o valor devolvido, onde
o defeito se manifestava, não é observado.

**Por que o segundo critério.** O primeiro, sozinho, aprovaria a pilha: ela
diverge em dois quadros, um por chamada de `desempilhar()`. A trajetória é o
que a separa dos demais — idêntica na pilha, diferente em todos os outros. O
desenho mostra estado, e o que não chega ao estado não chega ao estudante.

A trajetória é também o critério mais fiel ao que o estudante vê. O desenho da
estrutura não mostra em que linha a execução está — isso fica no indicador ao
lado e no editor —, e dois quadros com o mesmo estado em linhas diferentes são,
para quem olha o desenho, o mesmo quadro. A contagem de quadros conta
diferenças que o desenho não tem como mostrar.

**Auditoria do catálogo (setembro de 2026).**

| Exercício | Quadros divergentes | Trajetória | Resultado |
|---|---|---|---|
| `pilha-desempilhar` | 2 | idêntica; estado final igual | **reprovado** — corrigido, ver abaixo |
| `vetor-zerar-negativos` | 12 | diverge; estado final diferente | aprovado |
| `vetor-dobrar` | 8 | diverge; estado final diferente | aprovado |
| `fila-atender-todos` | 7 | diverge; estado final diferente | aprovado |
| `lista-inserir-depois` | 2 | diverge; estado final diferente | aprovado |

A fila diverge por ausência: a versão com defeito é um prefixo da correta e
para sete quadros antes, sem passar por nenhum estado que a correta não
tenha. É aprovada porque o último quadro — `carla` ainda na fila depois de
"atender todos" — contradiz o enunciado, e o último quadro é o que fica na tela.

**Correção de `pilha-desempilhar`.** Duas saídas foram avaliadas.

- *Exibir na visualização o valor devolvido pela operação*, o que cobriria toda
  a classe "devolve o elemento errado" em pilha e fila. Fica para depois: o
  valor devolvido não está no instantâneo, e trazê-lo exige mudar o núcleo e o
  contrato dos visualizadores; hoje serviria a um exercício só; e mostrar
  "devolveu 20" no desenho devolveria, sem apoio, o "obtido" que o painel
  de casos esconde de propósito (D9).
- *Trocar o defeito por um que diverja no estado* — a escolhida. O defeito
  passou a ser `itens.length = topo` no lugar de `topo + 1`, na mesma linha e na
  mesma categoria, índice deslocado: desempilhar retira o elemento do topo e
  descarta junto o de baixo. Verificado por execução antes da troca: quebra dois
  dos três casos, diverge em sete quadros, e a trajetória diverge já no
  primeiro `desempilhar()`. O quadro-denúncia mostra o topo apontando além do
  último elemento que restou — o estado *marcador fora da estrutura* de D10 —,
  e se lê sem precisar relacionar o quadro à linha. Título, enunciado e dicas
  foram reescritos, porque falavam do valor devolvido.

Com a troca, `pilha-desempilhar` saiu da lista de pendentes, e o catálogo
inteiro passa na verificação.

*Superada por D18:* o modelo da pilha mudou, e esse defeito, que dependia de
atribuir a `length`, deu lugar a outro.

## D17 — Código dos exercícios legível para quem estudou Java ou C

**Decisão.** O código que o estudante lê — `codigoComDefeito` e `codigoCorreto`
— usa só o subconjunto de JavaScript que um estudante de algoritmos em Java ou
em C lê sem ajuda: `var`, laços explícitos com índice, atribuição direta em
posição de vetor, `==` e `!=`, funções declaradas com `function`. Ficam de fora
os métodos de vetor (`push`, `map`, `filter` e afins), arrow function,
desestruturação, template literal, `===`, `let`, `const` e espalhamento. A
lista completa, e o critério para o que não está nela, ficam na skill
`criar-exercicio`.

**Justificativa.** O público são estudantes do ensino superior numa disciplina
introdutória, que em geral aprenderam algoritmos em Java ou em C (ver D2). Se o
estudante tropeça na sintaxe, a ferramenta passa a medir desconhecimento de
linguagem em vez de habilidade de depuração: o tempo até a localização e até a
correção incorporariam o tempo gasto decifrando JavaScript, e as duas coisas
não se separam depois nos dados.

**Alternativa descartada.** Oferecer os exercícios em Java ou em C. Exigiria
executar essas linguagens no navegador, e a instrumentação por AST de D1
existe justamente para evitar um interpretador próprio.

## D18 — Pilha como vetor de capacidade fixa e índice de topo

**Decisão.** A pilha do exercício de referência é um vetor de capacidade fixa
(`var itens = [0, 0, 0, 0]`) e um índice `topo`. A pilha vai da posição 0 até o
topo; o que está acima dele continua no vetor, mas fora da pilha. Desempilhar
só recua o topo — nada é apagado nem encolhido.

**Justificativa.** É como a estrutura é ensinada em Java, com um vetor de
tamanho fixo e um índice, e é como o visualizador já desenha: as posições acima
do topo são células consumidas (D10). O modelo anterior encolhia o vetor
atribuindo a `length`, semântica que só existe em JavaScript — e o defeito
dependia dela. Sem saber que atribuir a `length` trunca o vetor, o público-alvo
não tinha como raciocinar sobre o defeito, e o exercício passava a medir
conhecimento de JavaScript, justamente o que D17 quer evitar. Mudou o modelo,
e não só o defeito, para que o próximo defeito não caísse na mesma armadilha.

**O defeito novo.** `empilhar` avança o topo e escreve o valor em `topo + 1`,
uma posição acima. Foi verificado por execução antes da troca. O valor do
primeiro `empilhar()` já vai parar numa célula consumida, acima do topo, e o
topo fica sobre uma posição que ninguém escreveu: o quadro-denúncia é o
primeiro em que a pilha tem conteúdo. O defeito quebra três dos quatro casos, e
a trajetória diverge já no primeiro empilhar. A categoria continua a mesma,
índice deslocado.

**Capacidade fixa, e não vetor que cresce.** Com `var itens = []`, escrever em
`topo + 1` antes de escrever em `topo` abriria um buraco no vetor — outra
semântica própria de JavaScript. Com capacidade fixa, toda posição existe desde
o começo e guarda zero, como num `new int[4]` de Java.

## D19 — Identidade visual: a sala e a mesa de luz

**Decisão.** A aplicação inteira passa a ter uma identidade só, desenhada com a
skill oficial `frontend-design` (instalada em `.claude/skills/frontend-design`).
A página é uma sala cor de areia onde só dois objetos têm corpo: o editor,
escuro, e a bancada da visualização, que é a superfície mais clara da tela — uma
mesa de luz com grade milimetrada tênue. O resto é texto pousado direto na sala.
Substitui a direção 2a, que valia só para a tela de exercício.

**Referência.** O laboratório escolar: a mesa de luz onde se examina uma peça, o
papel e a areia da bancada de trabalho, e o roxo de anilina das folhas
mimeografadas de exercício. É dessa origem que saem as cores, e não de uma
paleta de uso geral.

**Temperatura: de verde-acinzentado para areia.** A primeira versão tinha a sala
em verde-acinzentado (`#D8E0DA`), tirado dos equipamentos antigos de
laboratório, e o resultado ficou frio demais. A estrutura conceitual ficou
inteira — sala, mesa de luz como superfície mais clara, editor escuro, grafite
dentro da bancada — e só a temperatura mudou: a sala passou a ser areia. Não é o
creme com terracota que a skill aponta como padrão de design gerado. A areia é
mais escura e mais saturada que aquele creme, e a cor de ação continua sendo a
anilina, um violeta, e não um tom de barro.

| Papel | Degrau | Hex |
|---|---|---|
| Sala | `areia-300` | `#EADECD` |
| Faixas (casos, dicas) | `areia-200` | `#F7EFE5` |
| Mesa de luz — só a bancada | `areia-100` | `#FDF9F4` |
| Grafite: texto, e marcadores dentro do desenho | `areia-900` | `#24201A` |
| Texto suave | `areia-700` | `#62594F` |
| Ação — a única | `anilina-700` | `#603FB0` |
| Acerto — só o sinal de todos os casos passando | `musgo-700` | `#006D3C` |
| Fundo do editor | `areia-900` | `#24201A` |

**Escalas de 100 a 900.** As variáveis soltas deram lugar a escalas nomeadas,
como num design system: `areia`, `anilina`, `azul`, `ambar`, `rubi`, `musgo`,
`rosa`, `ciano`, `lima` e `palha`, cada uma de 100 (mais clara) a 900 (mais
escura). São geradas em OKLCH, com o matiz fixo por família e a mesma
luminosidade em cada degrau para todas elas (0,985 a 0,245). Por isso o 600 de
uma família pesa o mesmo que o 600 de outra, e hover, fundo sutil e borda saem de
um degrau vizinho, em vez de um valor inventado a cada uso.

Nenhuma regra usa uma escala diretamente. As regras usam papéis — `--sala`,
`--acao`, `--celula-ativa-traco`, `--sintaxe-funcao` —, e cada papel aponta para
um degrau. Trocar a aparência é trocar o degrau de um papel, e a validação de
contraste é feita papel por papel. Fora das escalas ficou um único valor, de
propósito: o branco puro do fundo da célula ativa, um degrau acima da mesa de
luz, para a peça se destacar da superfície em que pousa. O tema do editor lê os
mesmos papéis por `var()` e não repete valor nenhum.

**Tipografia.** Zen Maru Gothic na interface, pesos 500 e 700: sans
arredondada, de desenho humanista, que tira a frieza sem ficar infantil para
um público universitário. Foi comparada renderizada com M PLUS Rounded 1c, mais
larga e mecânica, e com Rubik, que quase não arredonda. Nunito e Quicksand
ficaram de fora por serem o reflexo padrão para "arredondada e amigável", e
Fredoka, Baloo e Sniglet, por serem infantis. O corpo usa o peso 500, porque o
400 fica fino demais sobre a areia.

Atkinson Hyperlegible Mono continua no código e nos valores do desenho, pesos
400 e 700. Ela foi desenhada para distinguir `1`, `l` e `I`, e `0` e `O`, e numa
ferramenta cujos defeitos são, na maioria, índice deslocado é aí que isso
importa. A Atkinson Hyperlegible Next saiu do texto corrido: na interface, a
legibilidade já é boa em qualquer sans, e a Zen Maru dá o calor que faltava.
Todas vêm do `@fontsource`, subconjunto latino, licença OFL-1.1 (D13). O
contador de passos e os rótulos de interface usam o texto com algarismos
tabulares, e continuam sem etiquetas em maiúsculas espaçadas.

**Dentro da bancada, matiz é significado.** As cores com significado de D10
continuam nas mesmas famílias — azul, cinza, âmbar, vermelho — recalibradas
para a mesa de luz. Revalidadas sobre a mesa de luz em areia (`#FDF9F4`):

| Estado | Degrau | Hex | Contraste |
|---|---|---|---|
| Célula ativa | `azul-700` | `#2159A5` | 6,6:1 |
| Célula consumida | `areia-700` | `#62594F` | 6,5:1 |
| Elemento apontado (anel) | `ambar-600` | `#B26500` | 4,2:1 |
| Ligação cíclica | `rubi-600` | `#CB473D` | 4,4:1 |
| Posição vazia da capacidade | `areia-600` | `#83796B` | 4,1:1 |
| Marcadores (sem cor própria) | `areia-900` | `#24201A` | 15,5:1 |

Todas passam dos 3:1 de elemento gráfico. Os cinzas da consumida e da posição
vazia passaram a vir da areia, porque o cinza frio destoava da sala quente. Os
dois ficam a ΔE 13 um do outro, como já ficavam, e continua sendo a forma —
tracejado com valor esmaecido contra pontilhado vazio — que os separa. Os demais
pares de estados ficam a ΔE ≥ 26. Todo o resto do desenho é grafite ou areia de
moldura. Isso corrigiu duas confusões que já existiam:

- o marcador de índice era pintado com a cor de ação, e a anilina fica a ΔE 33
  do azul da célula ativa — perto demais para quem tem deficiência de visão de
  cores. A separação só é garantida se for de lugar: a anilina nunca entra na
  bancada;
- o topo da pilha era vermelho, o mesmo vermelho da ligação cíclica.

Os marcadores passaram a grafite. Quando dois dividem o desenho — início e fim,
cabeça e atual —, a diferença é de forma: seta cheia para o primeiro, vazada
para o segundo (`MARCADOR` em `src/visualizacao/estilos.ts`). A forma sobrevive
à escala de cinza e ao nível sem apoio, onde os rótulos somem.

**Profundidade como presença.** A célula ativa projeta uma sombra seca de 3 px,
como peça pousada na mesa; consumida e posição vazia ficam chapadas. É mais uma
forma reforçando uma distinção que já existia, e não um significado novo. Onde o
navegador não aplica filtro CSS a elemento SVG, a sombra falta e a borda
contínua continua carregando o estado.

**Editor.** Tema escuro próprio (`src/componentes/tema-do-editor.ts`), sem
vermelho, âmbar ou azul, para o código não carregar as cores da bancada. O
realce é por tipo de token e uniforme no programa, então não diferencia trecho
nenhum. A faixa da linha em execução de D9 continua quase neutra: `areia-100`
translúcida a 9% sobre o editor escuro, no lugar do bege sobre fundo claro. Era
13%, e com a sala em areia desceu, porque a 12% o comentário caía a 4,2:1 sobre a
faixa; a 9% fica a 4,6:1, e a faixa continua a ΔE 9 do fundo do editor.

A primeira versão tinha três tons de sintaxe, e eram poucos: classe, função,
variável e propriedade saíam na mesma cor, e é justamente isso que o estudante
precisa separar para ler `no.proximo = novo`. O realce passou a ter uma família
por categoria:

| Categoria | Degrau | Exemplo |
|---|---|---|
| Palavra-chave, `this`, `true`, `false`, `null` | lilás, `anilina-300` | `var`, `new`, `return` |
| Literal | verde, `musgo-400` | `10`, `"ana"` |
| Função, na declaração e na chamada | rosa, `rosa-400` | `inserirDepois` |
| Classe, na declaração e no `new` | ciano-esverdeado, `ciano-400` | `No` |
| Propriedade | palha, `palha-400` | `this.valor`, `no.proximo` |
| Variável | tom do texto, `areia-200` | `cabeca`, `novo` |
| Comentário e pontuação | `areia-500` e `areia-400` | `//`, `;` |

Sobre o editor em `areia-900`, todos ficam entre 6,0:1 e 14,2:1 e a ΔE ≥ 47 das
cores com significado da bancada. Entre dois tons com cor própria, a distância
mínima é ΔE 28. Na primeira versão, com o editor esverdeado, literal e classe
chegaram a ficar a ΔE 13; na passagem para a areia, literal (lima) e
propriedade (palha) ficaram a ΔE 21, e o literal foi para o verde `musgo`. O
construtor de classe sai como propriedade, porque é assim que o analisador de
JavaScript marca o nome de um método.

**Ocorrências da seleção.** Selecionar uma variável e ver onde mais ela aparece
é ferramenta legítima de investigação, e a 8% de opacidade o realce das outras
ocorrências era quase invisível. Subiu para lilás a 20%. Nessa intensidade o
fundo fica a só ΔE 10 da faixa da linha em execução, então a cor sozinha não
separa os dois: a ocorrência ganhou contorno, e fica uma caixa do tamanho da
palavra, enquanto a faixa é um fundo sem contorno na linha inteira. Onde as duas
se sobrepõem, a caixa continua legível sobre a faixa. O realce é do que o
próprio estudante selecionou, e não aponta trecho algum por conta própria.

**Retorno sobre a ação, nunca sobre o desempenho.** Três retornos entraram, e a
régua que os separa do que continua proibido é a do roadmap (1.1): responder ao
que o estudante acabou de fazer é permitido; tempo, contagem, pontuação,
progresso e histórico, não.

- *Sinal de acerto.* Quando todos os casos passam, a faixa de casos vira um
  campo verde e um selo de ✓ se traça uma vez, com "Todos os casos passaram."
  O componente `SinalDeAcerto` não recebe o nível de andaime e é desenhado fora
  do trecho que varia com ele, então é idêntico nos dois níveis: se a
  intensidade do retorno variasse com o apoio, a diferença de desempenho entre
  os níveis deixaria de ser atribuível ao apoio. Não mostra nada da sessão. É o
  único movimento orquestrado da aplicação, e não anima para quem pediu ao
  sistema movimento reduzido.
- *Mudança pendente.* Enquanto o código do editor for diferente do último
  executado, o botão diz "Executar alterações" e ganha um ponto. Compara dois
  textos, não conta nada: desfazer a edição até o código executado apaga o
  sinal.
- *Convite no número da linha.* Ver abaixo.

Este retorno precisa estar fechado antes do próximo piloto: mudar a intensidade
dele entre pilotos invalida a comparação entre eles.

**Descoberta da declaração de localização.** O primeiro piloto registrou zero
declarações em 25 sessões (roadmap, primeiro piloto). Antes de introduzir um modo de
declaração separado, testa-se o convite visual: o número da linha tem cursor de
ponteiro e, sob o mouse, vira uma pastilha anilina com o número em branco. O
mecanismo de D7 não muda — o alvo continua sendo o número. Todos os números se
comportam igual, e o realce não tem transição: um realce que esmaecesse devagar
deixaria, por um instante, a linha anterior marcada. O estado vazio de "Onde
você apontou" passou a dizer como apontar. Se o próximo piloto continuar sem
declarações, o modo separado do roadmap volta à mesa.

**Anel de foco e barras de rolagem.** O foco pelo teclado tem um anel global:
contorno de 2 px em `anilina-600`, afastado 2 px do elemento, com um halo de
5 px em `anilina-300`. O contorno fica a 3,5:1 sobre a sala. O editor não é
controle nativo e recebe o mesmo anel em volta da placa inteira quando está em
foco. Os controles de reprodução, as aberturas da lista e os botões usam o
anel global. As barras de rolagem acompanham a superfície: na página, polegar
`areia-500` sobre trilho `areia-300`; no editor, `areia-700` sobre o fundo
escuro. Usam `scrollbar-color`, e os pseudo-elementos do WebKit ficam só para
navegador que ainda não entende a propriedade.

**Ícones.** Heroicons (`@heroicons/react`, MIT), instalado como pacote e
renderizado como SVG embutido, sem recurso externo em tempo de execução (D13).
Substituem os glifos `◀`, `✓` e `✗` da interface, que dependiam da fonte da
máquina. Onde o ícone era a única indicação, uma palavra acompanha para leitor
de tela.

**O que foi revisado contra os padrões da skill.** A direção 2a era ela mesma o
padrão que a skill aponta como marca de design gerado: fundo creme, tons
quentes, rótulos em mono maiúsculo espaçado. Foram descartados também o tema
escuro de IDE com acento neon (outro padrão, e derrubaria o contraste dos
estados), o blueprint azul (colide com o azul da célula ativa e obrigaria a
reescrever D10) e a grade de cartões idênticos — a lista de exercícios virou
uma régua de linhas.

**Movimento reduzido.** A aplicação inteira respeita a preferência do sistema
(`MotionConfig reducedMotion="user"`): as transições do desenho acontecem sem
animação, e o estado muda na hora.

**O que não mudou.** Os estados de D10 e suas formas, o que cada nível de
andaime revela (D9), o registro de métricas e o arranjo da tela de D10.


## D20 — Tela inicial, vitrine de exercícios e tela de exercício compacta

**Decisão.** A entrada da aplicação deixa de ser a lista de exercícios. Passa a
haver uma tela inicial (`#/`), que apresenta a ferramenta e leva aos exercícios,
e a lista vira uma vitrine em rota própria (`#/exercicios`). A tela de exercício
é rearranjada para caber na janela sem rolagem. A exportação de métricas sai das
telas do participante.

**Tela inicial.** Texto à esquerda e, à direita, uma folha de exercício
mimeografada — vetor, pilha e lista desenhados em tinta de anilina, uma lupa e
um inseto —, toda montada em SVG no próprio componente, com retângulos, elipses
e traços. Nenhum arquivo de imagem, nenhum recurso externo (D13). A tinta é
anilina clara, e não a anilina da ação, para o botão continuar sendo o roxo mais
forte da tela; e nenhuma cor de significado da bancada entra na folha, porque a
decoração não pode ensinar outro sentido para azul, âmbar ou vermelho (D19).

Três microanimações, em CSS e com nome: `folha-pousa`, que roda uma vez quando
a tela abre; `marcador-avanca`, a seta andando de posição em posição como no
reprodutor; e `lupa-investiga`, a lente passeando devagar pela folha. Com
`prefers-reduced-motion`, nenhuma roda e a folha aparece na posição final.

Os três passos da tela — executar, observar, apontar e corrigir — são numerados
porque são de fato uma sequência. O terceiro nomeia o gesto de apontar a linha
de propósito: o primeiro piloto registrou zero declarações de localização, e o
problema era de descoberta (roadmap, primeiro piloto).

**Vitrine.** Uma fileira por estrutura, na ordem de D8, com filtro por
estrutura. Cada exercício é um cartão com miniatura, título, complexidade e as
duas aberturas, com apoio e sem apoio. O filtro escolhido é grafite, e não
anilina: a pílula anilina cheia é a do apoio escolhido na tela do exercício, e
as duas escalas não podem se parecer (D9). Continua sem progresso, pontuação ou
marca de resolvido.

**A miniatura é o visualizador, não uma imagem.** O cartão desenha o próprio
visualizador da estrutura, pequeno e parado. Assim mostra exatamente o desenho
que o estudante vai encontrar, e um exercício novo não depende de ninguém gerar
figura nenhuma. O componente que monta a miniatura mora em `src/componentes`: é
ele que conhece o exercício, e o visualizador continua puro.

- **O estado é escolhido no exercício**, no campo opcional `miniatura`, com as
  variáveis de um instantâneo. Ordem e linha ficam de fora porque não fazem
  sentido fora de uma execução.
- **Nunca o quadro que denuncia o defeito.** O estado precisa ser um que as duas
  versões — com e sem defeito — atravessam antes de divergirem. Até ali o
  desenho é o mesmo com ou sem o defeito, e o cartão não entrega nada. Isso é
  **verificado por execução**, no mesmo teste do quadro-denúncia (D16): um
  estado posterior à divergência, ou inventado à mão, reprova o exercício.
  Os estados escolhidos foram copiados da execução, e não escritos de cabeça.
- **Exercício sem o campo cai num cartão sem miniatura.** Cobre os exercícios
  que professores venham a cadastrar (roadmap, área de autoria) sem exigir deles o estado.
- **Parada**: `MotionConfig skipAnimations` leva cada transição direto ao valor
  final. As transições existem para mostrar a mudança entre dois passos, e na
  miniatura não há passo seguinte.
- **Sem apoio**: os rótulos de 9 px ficariam ilegíveis nesse tamanho. O que
  sobra é a forma, que é o que o cartão precisa mostrar.
- **Enquadrada no desenho.** O viewBox de cada visualizador é dimensionado para
  a maior estrutura que ele comporta, e numa miniatura isso vira uma peça miúda
  num canto. Depois de desenhada, a miniatura mede o conteúdo (`getBBox`) e
  recorta o viewBox por ele. É decisão de moldura: o visualizador não sabe que
  está numa miniatura.
- **Decorativa para leitor de tela** (`aria-hidden`): o título do cartão já
  nomeia o exercício.

**Tela de exercício compacta.** Em janela de pelo menos 901 × 600 px, a página
ocupa exatamente a janela: código à esquerda, de alto a baixo, com o retorno da
declaração logo abaixo, que é onde se aponta; à direita, a visualização e, embaixo
dela, os casos de teste e as dicas. O editor e a coluna de casos e dicas rolam
por dentro, e o desenho nunca sai de vista. Abaixo desse tamanho, a página volta
a rolar em coluna única — é melhor do que o editor virar uma fresta.

A justificativa é a mesma do indicador de linha junto à animação (D10):
investigar é ir e voltar entre o teste que falha, o desenho e a linha, e cada
rolagem no meio disso é memória de trabalho gasta em achar de novo o que saiu da
tela. Verificado em 1366 × 657 e 1920 × 960.

Isso **muda o arranjo de D10**, que punha os casos numa faixa larga acima do
código. Os casos continuam sendo de onde o estudante parte, agora sem empurrar
o código e a visualização para baixo. O sinal de acerto **não mudou** de
tamanho nem de intensidade: a regra de retorno de acerto do roadmap é que ele fique idêntico
entre pilotos, e encolhê-lo para caber seria mudá-lo.

**Congelamento (19/09/2026).** A partir desta data o arranjo da tela de
exercício está fechado até depois do próximo piloto. O que o estudante vê
simultaneamente — código, visualização e casos de teste, e onde cada um fica —
não muda nesse intervalo. É a mesma razão do sinal de acerto: pilotos com
arranjos diferentes não se comparam, e a diferença de desempenho entre eles
deixaria de ser atribuível ao que se quer medir.

Continua permitido corrigir defeito que quebre o arranjo — um painel que saia
da tela numa resolução não prevista, por exemplo —, desde que a correção
restaure o arranjo descrito acima, e não o altere. Mudar a disposição, o tamanho
relativo das áreas ou o que fica visível ao mesmo tempo espera o piloto.

**Como isto é verificado.** As regras desta decisão que podem ser executadas
viraram teste, no mesmo espírito do quadro-denúncia (D16):

| Regra | Onde | O que alcança |
|---|---|---|
| A miniatura não mostra o quadro que denuncia o defeito | `src/exercicios/quadro-denuncia.test.ts` | Executa as duas versões e exige que o estado esteja entre os anteriores à divergência |
| Toda animação tem exceção de movimento reduzido | `src/componentes/movimento-reduzido.test.ts` | Lê o `index.css` e cobra o `animation: none` de cada seletor que anima |
| O filtro da vitrine mostra só a fileira escolhida | `e2e/vitrine.spec.ts` | Clique de verdade, no navegador |
| Com movimento reduzido nada anima | `e2e/movimento-reduzido.spec.ts` | Preferência emulada; um teste com movimento normal guarda contra passar por vazio |
| As telas cabem na largura de um celular | `e2e/celular.spec.ts` | 360 e 390 px por emulação, sem o piso de 492 px da janela do Edge |

Os de ponta a ponta usam o Edge já instalado (`channel: 'msedge'`), sem baixar
navegador, pela razão de D13. O piscar do cursor do editor fica fora da contagem
de animações: é cursor de texto, vem do CodeMirror, e não é movimento que a
aplicação acrescenta.

**O que continua dependendo de olho e de aparelho**, e precisa de uma passada
manual antes do piloto: que a preferência de movimento do sistema chegue ao
navegador da máquina do piloto, e se o texto fica legível e a fileira rola bem
com o dedo num celular de verdade. O teste responde se a página cabe, não se
ela está boa.

**Exportação só no painel do pesquisador.** O botão saiu da lista e da tela de
exercício; fica só no painel de métricas, fora da navegação (D11). Nenhum dado
se perde: a sessão já era arquivada ao sair do exercício e no `pagehide`, sem
depender do botão (D15). A função de exportar do hook de métricas, que só o
botão usava, saiu junto.

### Ajustes de interface (19/09/2026)

Cinco ajustes pedidos depois do congelamento, e nenhum deles mexe no arranjo
congelado: quatro estão fora da tela de exercício, e o quinto é o botão de
executar, que é retorno sobre a ação em curso e não muda o que o estudante vê
ao mesmo tempo, nem onde cada coisa fica.

**1. O botão de executar pulsa enquanto houver mudança pendente.** O ponto
sozinho era discreto demais. Agora o botão ganha um halo fixo e um anel que
pulsa por cima dele, em `animation` no `::after` — não no próprio botão, para o
alvo do clique não mudar de tamanho debaixo do ponteiro de quem vai clicar. O
halo é fixo de propósito: só o pulso deixaria o botão igual a qualquer outro
no instante em que o anel está apagado.

Com `prefers-reduced-motion`, o anel simplesmente fica parado, com a mesma
espessura e a mesma cor: a alternativa estática precisa ser tão visível quanto o
pulso, senão a preferência por menos movimento custaria informação a quem a
usa. Continua sendo retorno sobre a ação e não sobre o desempenho: nasce de o
código estar diferente do que rodou, e morre quando a execução alcança o editor
— não conta nada.

**2. Autoria na tela inicial.** Uma linha discreta no rodapé, com o curso, a
instituição e o autor.

**3. Complexidade como etiqueta, não como fração.** "complexidade 2 de 3" virou
uma palavra: **introdutório**, **intermediário** e **desafiador**, no mesmo
formato do balão de tutorial. O campo `dificuldade` continua numérico no modelo
— número ordena, compara e entra na análise; a palavra é só como isso se lê. A
tabela mora em `src/componentes/complexidade.ts`, no espírito de `andaime.ts`:
quem desenha consulta, não decide.

A etiqueta descreve **o exercício**, nunca quem o abre, e por isso não esbarra na
proibição de progresso e pontuação (D8): é a informação que já estava na lista,
com outra forma.

*Verde, amarelo e vermelho encostam em cores que têm significado na bancada*, e
a vitrine mostra miniaturas — ou seja, as duas coisas dividem a tela. Os tons
foram escolhidos medindo essa distância, e não pelo nome da cor:

| Etiqueta | Degrau | Hex | ΔE da célula ativa | ΔE do apontado | ΔE do ciclo | Texto |
|---|---|---|---|---|---|---|
| introdutório | `lima-700` | `#446800` | 55 | 36 | 54 | 6,2:1 |
| intermediário | `palha-800` | `#473900` | 47 | 27 | 37 | 10,8:1 |
| desafiador | `rubi-900` | `#430403` | 40 | 38 | 31 | 15,9:1 |

A menor distância é 27, da etiqueta intermediária ao anel do elemento apontado.
É o preço de o nível 2 ser amarelo: um amarelo saturado **é** a cor do anel, e
por isso o tom virou um mostarda escuro. Entre as próprias etiquetas a distância
vai de 20 a 49.

Nada disso importaria se a cor fosse o único portador, e ela não é: cada etiqueta
traz a palavra escrita, que é o que um teste de ponta a ponta cobra de todos os
cartões. As duas escalas da tela continuam separadas por tratamento — a
complexidade é etiqueta cheia na linha de metadados, o apoio são pílulas
contornadas numa linha própria, rotulada "abrir".

**4. "adianta menos" virou "auxilia menos durante a investigação".**

**5. Ilustração nos três passos da tela inicial.** Uma por passo — a janela de
código com o botão, a lupa sobre a fileira, o número da linha e o lápis —,
montadas com primitivas no próprio código, como a folha (D13). Grafite no traço
e anilina no que é ação; nenhuma cor de significado da bancada entra nelas. Com
a ilustração no lugar, o círculo numerado saiu da linha própria e foi para junto
do título: o passo não precisa de dois pesos visuais.

O cartão sem miniatura também deixou de ser um vazio: recebe o glifo da
estrutura, grande e quieto. O glifo diz do que o exercício trata sem descrever
execução nenhuma — inventar um desenho ali seria afirmar um estado que o
exercício não escolheu.

**O que virou teste.** A palavra da complexidade em cada cartão e o pulso do
botão, nos dois sentidos: que ele existe enquanto a mudança está pendente, que
para quando a execução alcança o editor, e que sem movimento o anel continua
visível no lugar do pulso.

### Fluxo: continuar e ordem dos apontamentos (19/09/2026)

Duas mudanças vindas de observação de uso. Nenhuma altera o que o estudante vê
ao mesmo tempo nem onde cada coisa fica, então o congelamento segue de pé.

**Continuar sem voltar ao catálogo.** Quando todos os casos passam, o sinal de
acerto passa a trazer um convite para o próximo exercício. Antes, seguir adiante
exigia voltar à vitrine e escolher de novo — um desvio que só existia por falta
do caminho direto.

Três restrições moldaram o convite:

- **O apoio é herdado.** O endereço leva o mesmo nível da sessão atual. Trocar
  de apoio no meio de uma sequência misturaria as condições que o estudo compara
  (D9), e a troca continua sendo uma escolha explícita, na própria tela.
- **A navegação encerra a sessão e começa outra** (D8). Não há nada de novo aqui:
  é uma troca de rota, a tela remonta com chave nova, a sessão anterior é
  arquivada no desmonte (D15) e o exercício seguinte abre com o código com
  defeito dele.
- **O convite não informa posição nem quantidade.** Nada de "2 de 9", "faltam
  sete" ou contagem de resolvidos: seguir adiante é uma porta, não um placar.

Daí uma decisão que não é óbvia pelo código: **a sequência dá a volta**. O
exercício seguinte ao último é o primeiro do catálogo. Se o último ficasse sem
convite, a ausência diria ao estudante que ele chegou ao fim da lista — posição
na sequência é progresso, e progresso não aparece (D8). Com a volta, o convite é
o mesmo em qualquer exercício.

Quem sabe quem é o próximo é o catálogo, em `proximoDoCatalogo`, e a rota passa
o resultado para a tela. A tela de exercício continua sem conhecer o catálogo:
ela desenha um exercício, não uma sequência.

**Apontamentos do mais recente para o mais antigo.** O painel "Onde você
apontou" inverte a ordem de exibição. Com várias tentativas, a que o estudante
acabou de fazer ficava no fim da lista, fora de vista, e era justamente a que
ele queria conferir. **A ordem do registro de métricas não muda** — o log
continua cronológico, como toda a análise depende que seja (D6); o que inverte é
a leitura.

**Um efeito colateral corrigido no caminho.** A regra de tamanho do selo de
acerto valia para qualquer `svg` dentro do sinal, e o ícone do convite nasceu
com os 72 px e o traço vazado do selo. A regra passou a mirar o selo, que é
filho direto. Tamanho, cor e intensidade do selo seguem exatamente iguais — a
regra de retorno de acerto do roadmap continua valendo.

**O que virou teste.** Que o convite leva ao próximo exercício preservando o
apoio, que a sessão recomeça do código com defeito, que o texto do convite não
tem número nenhum, que o último exercício dá a volta para o primeiro, e que a
linha apontada mais recente aparece no topo.

## D21 — Identidade e persistência das sessões no Supabase

**Decisão.** As sessões arquivadas passam a ser gravadas no Supabase, sob uma
identidade criada no primeiro acesso. O espelho em `localStorage` (D15) não sai
de cena: vira a camada de resiliência.

### O que isto muda em D3

D3 registrou "sem backend na primeira versão", com a persistência condicionada
ao estudo de validação. **A condição se cumpriu.** O estudo será presencial, em
sala, com cada participante no próprio aparelho: a exportação manual de um
`localStorage` por aparelho não recolhe os dados de uma turma — basta alguém
fechar a aba, limpar o navegador ou pular o passo da exportação para a sessão
sumir.

O que D3 dizia continua valendo em duas partes, e é por isso que ela não foi
substituída por inteiro:

- **Exercícios continuam sendo módulos TypeScript versionados junto ao código.**
  O banco guarda sessões, não catálogo. Isso só muda com a área de autoria.
- **Backend próprio continua não existindo.** O Supabase entrega autenticação e
  banco sem servidor nosso: não há código de servidor para escrever, hospedar
  ou manter, e a aplicação segue sendo um pacote estático.

O que deixa de valer é a limitação: a coleta não é mais local ao aparelho.

### Identidade em três formas, e a ordem entre elas

1. **Anônima, automática, no primeiro acesso.** Sem pedir nada — sem tela, sem
   campo, sem clique.
2. **Google.**
3. **E-mail e senha.**

As duas últimas se **vinculam** à anônima em vez de substituí-la
(`linkIdentity` para o Google, `updateUser` para e-mail e senha). O `uid`
continua o mesmo depois do vínculo, e como é o `uid` que é dono das linhas em
`sessoes`, **as sessões já gravadas naquele aparelho continuam sendo da
pessoa** — sem migração de dado e sem sessão órfã.

Entrar numa conta que **já existe** é outra coisa: troca de identidade, e as
sessões do anônimo ficam com o anônimo. Não há como ser diferente, e é por isso
que o vínculo acontece antes de haver outra conta.

**Nada disso pode aparecer antes do primeiro exercício.** Mais da metade das
sessões dos dois pilotos foi abandonada sem ação nenhuma; um cadastro na porta
agravaria exatamente esse número. A entrada anônima é uma ida à rede, e a tela
não espera por ela: o exercício abre, a sessão começa sem identidade, e o
identificador chega a tempo porque o registro só é lido no arquivamento.

**Sem conta de teste compartilhada.** Duas pessoas sob o mesmo `uid` produzem
sessões indistinguíveis, e a análise não as separa depois. Cada aparelho tem a
própria identidade anônima, o que é justamente o que a conta compartilhada
destruiria.

### Papéis desde já

`perfis.papel` é um enum de `participante`, `professor` e `pesquisador`, criado
por gatilho junto com o usuário. `professor` ainda não concede nada: existe
porque a área de autoria vem em seguida, e acrescentar papel depois de haver
dado real custa migração de linha viva em vez de uma linha de DDL agora.

Papel se concede à mão, no painel do Supabase. Não há política de `update` em
`perfis` — com uma, um participante se promoveria a pesquisador e passaria a
ler as sessões da turma inteira.

### Acesso: o RLS é a única proteção

A chave anônima vai no pacote entregue ao navegador **por desenho**, e qualquer
pessoa a extrai do JavaScript. Ela identifica o projeto; não autoriza nada.
Tabela sem política é tabela aberta a qualquer visitante do site, então o RLS
entra antes de existir dado real — e não depois, quando já houver o que vazar.

As políticas estão em `supabase/migracoes/0001_sessoes_e_papeis.sql`, e são
estas:

| Tabela    | Operação | Quem                                           |
|-----------|----------|------------------------------------------------|
| `perfis`  | select   | o dono do perfil; e quem é pesquisador         |
| `perfis`  | outras   | ninguém pelo navegador                         |
| `sessoes` | select   | o dono da sessão; e quem é pesquisador         |
| `sessoes` | insert   | o próprio, e só como dono (`with check`)       |
| `sessoes` | update   | o próprio, sem poder passar a sessão a outro   |
| `sessoes` | delete   | ninguém — dado de pesquisa não se apaga assim  |

Dois detalhes que não são óbvios no SQL:

- **`e_pesquisador()` é `security definer`.** Consultada de dentro de uma
  política sobre `perfis`, uma função comum reentraria na própria política e a
  consulta entraria em recursão.
- **O anônimo automático não é o papel `anon` do Postgres.** Ele autentica de
  verdade e chega como `authenticated`, com `uid` próprio; `anon` é o visitante
  sem sessão nenhuma, e dele as duas tabelas foram revogadas.

### Falha de rede não custa dado

O envio é uma tentativa, não uma garantia, e a rede de sala de aula vai cair no
meio da coleta. Por isso:

- O arquivo em memória e o espelho local (D15) continuam sendo gravados
  **antes** de qualquer ida à rede.
- Sessão que não subiu fica pendente e é reenviada: quando a rede volta, quando
  a identidade muda, e a cada carga da página.
- **O controle de "já enviado" vive só na carga da página.** Na seguinte, tudo
  o que está no aparelho é reenviado. O id da sessão é a chave primária da
  tabela, então reenviar atualiza a linha em vez de duplicá-la, e algumas
  dezenas de registros custam menos que um controle durável que pode ficar
  mentindo.
- Sem chaves configuradas, a aplicação funciona inteira e grava só no aparelho,
  como antes desta decisão. Nenhuma tela do estudante depende de haver banco —
  o que também preserva D13 do lado do participante: o exercício roda com a
  máquina desconectada.

**Limpar o aparelho deixou de ser irreversível**, e essa é a diferença prática
de D21 no procedimento entre participantes: o que já subiu está no banco. O
botão do painel (D15) avisa quantas sessões ainda não chegaram lá.

### A versão do registro subiu para 4

Nenhum campo foi criado nem removido, mas `participanteId` deixou de ser sempre
nulo. Registros da versão 3 e anteriores foram coletados sem identidade e não
se agrupam por pessoa; sem a versão, a análise leria "sem identidade" como se
fosse mais um participante. Mesma razão das versões 2 e 3.

Um registro sem identidade que suba depois — coletado antes desta decisão, ou
numa carga em que a entrada anônima falhou — é gravado sob a identidade de
agora, que é a do aparelho onde ele foi coletado, porque a coluna é
obrigatória. A `versao` dele continua marcando que ele não nasceu
identificado.

### Ambiente

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, em `.env` fora do Git, com
`.env.example` documentando as duas. Na Vercel, as mesmas duas em *Environment
Variables*, para *Production* e *Preview*.

Tudo que começa com `VITE_` é embutido no pacote: a chave de serviço do
Supabase **não** entra em variável `VITE_*` nem em `.env` deste repositório.

No painel do Supabase ainda é preciso, à mão: habilitar *Anonymous sign-ins*,
habilitar *Manual linking* (sem ele, `linkIdentity` é recusado), configurar o
provedor Google, e registrar em *URL Configuration* as URLs de retorno — a de
desenvolvimento e a da Vercel, de produção e de pré-visualização.

Não há `vercel.json`: a navegação é por hash (D8), então o pacote estático não
precisa de reescrita de rota.

### O que virou teste

Que a sessão que falhou ao subir continua no aparelho e sobe no reenvio; que o
acumulado do aparelho sobe assim que o banco é ligado; que o já confirmado não
é reenviado, mas o que foi rearquivado é; que sem banco tudo continua como
antes; que limpar o aparelho não desfaz o que subiu; que a identidade que chega
depois da tela abrir ainda carimba a sessão; que o primeiro acesso entra
anônimo sozinho; que falhar em identificar não derruba a coleta; e — a que mais
importa — que Google e e-mail **vinculam** ao anônimo em vez de entrar em outra
identidade.

O que os testes não alcançam é o RLS, que vive no banco. As políticas se
conferem no projeto Supabase, com um participante tentando ler a sessão de
outro, **antes de haver dado real**.

### O que ficou de fora desta fatia

Tela de entrada e de cadastro. As funções de vínculo existem e estão
verificadas, mas nenhuma tela as chama ainda: enquanto não houver tela, todo
participante é anônimo. A tela é a próxima fatia, e é onde entra a decisão de
onde colocá-la sem que ela apareça antes do primeiro exercício.
