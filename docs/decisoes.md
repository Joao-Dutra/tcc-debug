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
