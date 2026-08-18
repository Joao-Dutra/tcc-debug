---
name: fluxo-de-trabalho
description: Use ao concluir qualquer fatia de trabalho neste repositório e ao criar commits. Define o fluxo de desenvolvimento (uma fatia por vez, verificação antes de entregar) e o padrão obrigatório das mensagens de commit. Consulte também antes de agrupar alterações, para decidir o que entra em cada commit.
---

# Fluxo de trabalho e commits

## Uma fatia por vez

Uma fatia é uma unidade de trabalho que faz sentido sozinha: um exercício, um
visualizador, um mecanismo. Conclua a fatia atual antes de começar a próxima,
mesmo que a próxima pareça pequena ou óbvia.

Se durante a execução aparecer algo necessário que pertence a outra fatia,
**não implemente**: relate ao final, explicando o que falta e por quê. Entregar
uma fatia completa e apontar a dependência é melhor do que entregar duas pela
metade.

## Antes de considerar uma fatia pronta

- `npx tsc -b` passa sem erro.
- A alteração foi verificada executando o código, não apenas lida. Quando o
  ambiente impedir a verificação usual, encontre outro caminho e **diga qual
  foi** no relato.
- Nada fora do escopo pedido foi alterado. Renomear, reorganizar ou "melhorar
  de passagem" arquivos não mencionados no pedido não faz parte da fatia.

## Relato ao final

Descreva o que foi feito, como foi verificado e o que ficou faltando. Quando
uma decisão de projeto tiver sido tomada no caminho — algo que não estava no
pedido e que outra pessoa poderia ter resolvido de forma diferente — registre-a
em `docs/decisoes.md` com a justificativa.

## Commits

### Formato

```
tipo(escopo): descricao curta em minusculas

Corpo opcional, explicando o porque da alteracao. Uma linha em branco
separa cada paragrafo. Limite as linhas a 72 caracteres.
```

**Nunca** inclua linha `Co-Authored-By`, assinatura, emoji de ferramenta ou
qualquer menção a geração automática — nem na mensagem, nem no corpo, nem em
descrição de pull request. O histórico é registro acadêmico do trabalho e deve
sair limpo.

### Tipos

| Tipo       | Quando usar                                                  |
|------------|--------------------------------------------------------------|
| `feat`     | Funcionalidade nova visível no produto                       |
| `fix`      | Correção de comportamento errado                             |
| `topic`    | Melhoria interna sem mudança de comportamento                |
| `docs`     | Documentação, `CLAUDE.md`, skills, `docs/`                   |
| `test`     | Testes automatizados                                         |
| `build`    | Dependências, Docker, configuração de build                  |

Use somente estes. Tipo novo exige combinar antes.

### Escopos

`nucleo`, `exercicio`, `visualizacao`, `metricas`, `interface`, `infra`.

O escopo é a área afetada, não o nome do arquivo.

### Descrição

Em português, minúsculas, sem ponto final, no infinitivo ou como substantivo —
não no passado. Diga **o que a alteração faz**, não o que você fez.

- Bom: `feat(exercicio): fila com defeito na condicao de parada`
- Bom: `fix(nucleo): capturar variaveis apos a declaracao para evitar TDZ`
- Ruim: `feat(exercicio): criei o exercicio da fila` (passado, primeira pessoa)
- Ruim: `fix: correcoes diversas` (sem escopo, sem conteúdo)

### Corpo

Inclua quando a alteração envolveu uma decisão que não é óbvia pelo diff.
Explique **por que**, não o que — o diff já mostra o que mudou.

### Granularidade

Um commit por fatia. Não junte o exercício e o visualizador dele no mesmo
commit, ainda que tenham sido feitos na mesma sessão: são reversíveis
separadamente e representam etapas distintas do trabalho.

Nunca use `git add .` sem antes conferir `git status`. Arquivos gerados,
`node_modules` e `.env` não entram no histórico em nenhuma hipótese.

### Antes de commitar

Confirme que a mensagem descreve **tudo** que está no commit. Se precisar de
"e também" na descrição, provavelmente são dois commits.
