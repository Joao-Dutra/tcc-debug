---
name: criar-visualizador
description: Use ao criar ou alterar qualquer componente em src/visualizacao/ — os desenhos animados das estruturas de dados. Cobre as restrições de pureza do componente, o uso de SVG e animação, e o princípio de representar ponteiros separados do conteúdo.
---

# Criar um visualizador

Um visualizador desenha **um** instantâneo de **uma** estrutura de dados.

## Contrato

```tsx
interface Props { instantaneo?: Instantaneo }
```

Nada além disso. O componente **não** executa código, **não** recebe o
exercício, **não** decide qual passo mostrar e **não** guarda estado próprio
sobre a execução. Quebrar isso acopla a visualização ao núcleo e inviabiliza
reaproveitar o mesmo visualizador em exercícios diferentes.

## Princípio de desenho

**Ponteiros e índices são desenhados separados do conteúdo.** É o descompasso
entre "onde o ponteiro aponta" e "o que existe ali" que revela a maior parte dos
defeitos. Um desenho que só mostra o conteúdo esconde exatamente aquilo que o
exercício quer expor.

Corolário: **desenhe o estado inválido.** Se `topo` aponta para fora do vetor,
mostre isso — é o sintoma. Não sanitize, não use `Math.max(0, ...)`, não esconda
valores fora de faixa. O estado errado é o conteúdo pedagógico.

## Técnica

- **SVG**, não Canvas. Cada elemento da estrutura tem identidade própria, o que
  torna a animação de transição quase automática e o resultado acessível.
- **`motion/react`** para as transições. Prefira `layout` e `key` estáveis a
  animar coordenadas na mão.
- **Duração curta** — 200 a 300 ms. A animação existe para tornar a mudança
  perceptível, não para ser apreciada.
- **`viewBox` fixo** com `width="100%"`, para escalar sem cálculo de layout.
- Cores vêm das variáveis CSS de `index.css`. Não use cor como único portador de
  informação: acompanhe de rótulo textual.

## Cuidados

- Instantâneos podem chegar com variáveis ausentes (a variável ainda não existia
  naquele ponto da execução). Trate `undefined` sem quebrar.
- Valores podem ser objetos aninhados, já serializados pelo Worker.
- Estruturas podem ficar grandes. Defina um limite de elementos desenhados e
  indique visualmente quando houver truncamento.

## Registro

Cada `TipoEstrutura` em `src/nucleo/tipos.ts` corresponde a um visualizador. Ao
criar um tipo novo, adicione-o ao union e crie o componente correspondente.
