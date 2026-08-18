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

**Limitação conhecida.** O botão de exportar métricas vive dentro da tela do
exercício. Depois de voltar para a lista não há como exportar sem entrar em
algum exercício de novo. As sessões continuam guardadas; falta o acesso.
