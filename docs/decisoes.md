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
exatamente "a memória" desta etapa (ver D6) e some junto com a página. Arquivar
é idempotente por id, o que atualiza o retrato em vez de duplicá-lo e cobre de
quebra o ciclo monta/desmonta/monta do StrictMode.

**O campo `tutorial` é dado do catálogo.** Marcar o exercício de entrada por um
campo em `Exercicio`, e não por um identificador fixo dentro da tela, mantém a
tela genérica e deixa a escolha onde ela pertence.

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
uma propriedade do exercício. O mesmo exercício pode ser apresentado com apoio
`completo`, `parcial` ou `minimo`. O nível vem da URL
(`#/exercicio/<id>?andaime=<nivel>`), é registrado na sessão de métricas e,
quando ausente ou inválido, assume `completo`.

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

| Andaime | `completo` | `parcial` | `minimo` |
|---|---|---|---|
| Dicas disponíveis | três | uma | nenhuma |
| Casos de teste | esperado e obtido | apenas passou ou falhou | apenas que algo falhou |
| Legendas de orientação no desenho | sim | não | não |
| Índices e rótulos dos marcadores | sim | sim | não |

A visualização tem três degraus, e não dois. Retirar de uma vez as legendas e
os rótulos dos marcadores faria o apoio parcial cair quase ao mínimo, e as duas
condições deixariam de se distinguir na análise. No apoio mínimo restam o valor
guardado em cada posição e a forma e a posição dos marcadores: relacionar o
marcador à variável do código volta a ser trabalho do estudante.

**Por que os níveis têm nome e não número.** A numeração media quantidade de
apoio e portanto crescia na direção contrária à da dificuldade — o nível 3 era
o mais fácil. É uma inversão fácil de aplicar errado ao ler os dados, e o erro
seria silencioso. Além disso "nível" já designa a dificuldade intrínseca do
exercício, que é propriedade dele e não da sessão; manter as duas escalas com o
mesmo vocabulário convidava a confundir justamente o que a análise precisa
separar.

**O que não varia com o nível.** O código do exercício, os casos executados, a
instrumentação e o registro de métricas. O andaime é exclusivamente aquilo que a
interface revela; o núcleo não o conhece. Essa fronteira é o que garante que
duas sessões do mesmo exercício sob níveis distintos sejam comparáveis.

**Dificuldade intrínseca continua sendo propriedade do exercício.** O tamanho do
programa, a distância entre o defeito e o seu sintoma e o fato de o defeito se
manifestar apenas em entradas de borda pertencem ao exercício e são declarados
nele. Manter essa separação explícita é o que sustenta a análise.

**O nível passou a ser escolhível pela interface.** Cada exercício da lista
oferece as três aberturas dentro de um único cartão, e a tela do exercício
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

**Questão em aberto.** O indicador de linha em execução (ver D10) é, ele próprio,
um andaime: faz pelo estudante o trabalho de relacionar o código à
representação. Não entra no *fading* nesta etapa, por ser também o principal
recurso de legibilidade da ferramenta, mas é candidato natural a compor o nível
mínimo caso o piloto indique que a tarefa está fácil demais.

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
