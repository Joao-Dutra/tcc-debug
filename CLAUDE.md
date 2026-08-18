# Contexto do projeto

Este repositório é o software do Trabalho de Conclusão de Curso de João Victor
Dutra Martins Silva, do Bacharelado em Sistemas de Informação do IFMG — Campus
Ouro Branco, orientado pela professora Suelen Mapa de Paula.

## O que o software faz

É uma aplicação web para o ensino de algoritmos e estruturas de dados. O
estudante recebe um código **já escrito e funcionalmente quase correto**, no qual
foi implantado **um defeito lógico deliberado**. A tarefa dele é localizar e
corrigir esse defeito. Enquanto o código executa, uma **representação gráfica
animada da estrutura de dados** mostra passo a passo o que está acontecendo.

## A tese que o software precisa sustentar

A literatura de visualização de algoritmos (Hundhausen et al., 2002; Naps et
al., 2002) mostra que o ganho de aprendizagem depende mais do que o estudante
**faz** do que do que ele **vê**. As ferramentas existentes colocam o estudante
como espectador de uma execução correta. Aqui a visualização é **instrumento de
investigação**: ela existe porque o estudante precisa dela para caçar o bug.

Consequência prática para o código: **toda decisão de interface deve preservar o
esforço investigativo do estudante.** Nunca aponte o defeito automaticamente,
nunca destaque a linha errada, nunca mostre o código correto. Se uma
funcionalidade tornar a caça desnecessária, ela contraria o propósito do
trabalho.

## Arquitetura

O fluxo é sempre o mesmo, em uma direção só:

```
código-fonte
   → instrumentar()   reescreve a AST inserindo chamadas __passo()
   → executar()       roda no Web Worker e coleta os instantâneos
   → useReprodutor()  decide qual instantâneo está sendo exibido
   → Visualizador*    desenha aquele instantâneo
```

Três regras que não devem ser quebradas:

1. **Visualizadores são componentes puros.** Recebem um `Instantaneo` e
   desenham. Não executam código, não conhecem exercícios, não decidem o passo.
2. **A execução acontece só no Worker.** Nada de `eval` na thread principal.
3. **Não escrever um interpretador.** A instrumentação por AST é a escolha
   arquitetural central do projeto — ela é o que mantém o cronograma viável.

### Mapa de diretórios

| Caminho             | Responsabilidade                                        |
|---------------------|---------------------------------------------------------|
| `src/nucleo/`       | Tipos, instrumentação, execução. Sem React aqui.        |
| `src/exercicios/`   | Catálogo de exercícios, um arquivo por exercício.       |
| `src/visualizacao/` | Um visualizador por tipo de estrutura de dados.         |
| `src/componentes/`  | Interface genérica (reprodutor, painéis, controles).    |
| `docs/`             | Decisões de projeto e anotações que alimentam o artigo. |

## Convenções

- **Português** em nomes de variáveis, funções, tipos, comentários e commits.
  O trabalho é avaliado por uma banca brasileira e o código é anexo dele.
- **TypeScript com tipagem explícita** nas fronteiras entre módulos. Sem `any`
  fora do módulo de instrumentação, onde a AST justifica o uso.
- **Comentários explicam o porquê, não o quê.** Em especial nas decisões que
  parecem estranhas à primeira vista.
- Componentes React em `PascalCase`; o resto em `camelCase`; arquivos em
  `kebab-case`.
- Sem biblioteca de UI. O CSS é escrito à mão em `src/index.css`.

## Escopo

**Nesta primeira versão:** estruturas lineares — vetor, pilha, fila e lista
encadeada. Sem backend, sem autenticação. Exercícios são módulos TypeScript.

**Depois, e só depois:** persistência de métricas com Supabase, autenticação de
participantes, modo avaliação com sequência fixa de exercícios, publicação na
Vercel. Árvores e grafos ficam para o fim, condicionados ao cronograma.

Ao propor mudanças, prefira concluir a fatia atual a antecipar as próximas.

## Métricas (importante para o estudo de validação)

A avaliação do TCC depende de dados coletados durante o uso. Ao mexer no fluxo
do exercício, **preserve a capacidade de registrar**: tempo até a primeira
execução, tempo até a localização do defeito, tempo até a correção, número de
execuções, dicas reveladas e edições feitas no código. Dado não coletado não
volta depois do experimento.

## Como rodar

```bash
docker compose up        # sobe em http://localhost:5173
npm run dev              # alternativa sem Docker
npm run build            # checagem de tipos + build de produção
```
