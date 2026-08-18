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
- O evento `localizacao` já está no formato, mas nada o produz ainda: o
  mecanismo de apontar a linha suspeita é fatia seguinte.
- Nenhum contador da sessão é exibido ao estudante. Mostrar quantas vezes ele
  executou ou quantas dicas abriu muda o comportamento que o estudo quer medir.

**Limitação aceita.** Nesta fatia o registro vive só na memória do navegador e
se perde ao recarregar a página. Fixar quais dados são coletados e em que
formato é o que importa agora; onde eles ficam é problema da fatia de
persistência.

**A registrar no termo de consentimento.** O registro contém o código escrito
pelo participante, e não apenas tempos e contagens.
