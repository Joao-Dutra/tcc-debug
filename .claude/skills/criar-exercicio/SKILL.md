---
name: criar-exercicio
description: Use ao criar, revisar ou ajustar um exercício do catálogo — qualquer arquivo em src/exercicios/. Cobre a escolha do defeito a implantar, a redação do enunciado e das dicas, os casos de teste e a conferência de que o defeito é realmente detectável pela visualização.
---

# Criar um exercício

Um exercício é um módulo em `src/exercicios/` que exporta um objeto `Exercicio`
(ver `src/nucleo/tipos.ts`). Use `pilha-desempilhar.ts` como modelo. O defeito
dele foi trocado depois da auditoria de D16 e serve também de exemplo do que a
verificação de divergência abaixo exige.

## Regra principal

O defeito precisa ser **visível na visualização e invisível na leitura casual do
código**. Se o estudante acha o bug só lendo, a visualização virou enfeite e o
exercício não serve ao propósito do trabalho. Se o bug não produz nenhuma
diferença no desenho da estrutura, também não serve.

Antes de finalizar, responda: *qual quadro da animação denuncia o defeito?*
Se não houver resposta clara, troque o defeito. A resposta vem da execução, e
não da leitura do código — ver a verificação obrigatória abaixo.

## Passos

1. **Escolha a categoria** entre as de `CategoriaDefeito`. Elas vêm do catálogo
   de equívocos recorrentes descrito na literatura — não invente categorias
   novas sem registrar a justificativa em `docs/`.
2. **Escreva primeiro o código correto**, com nomes em português e sem
   sofisticação: o estudante precisa entender o programa em menos de um minuto.
3. **Implante o defeito** com a menor alteração possível — trocar um operador,
   deslocar uma linha, mudar um índice. Defeito grande vira exercício de leitura.
4. **Verifique que o defeito quebra pelo menos um caso de teste.** Um defeito
   que não quebra nenhum teste é o análogo do mutante equivalente: descarte-o.
5. **Confira que os demais casos passam**, para o estudante ter sinal de que o
   resto do programa está correto.
6. **Preencha `linhaDoDefeito`** contando as linhas de `codigoComDefeito` a
   partir de 1. Confira depois de qualquer edição no código — esse campo
   silenciosamente sai do lugar.
7. **Liste em `variaveisObservadas`** apenas o que a visualização precisa. Toda
   variável observada entra em cada instantâneo e infla a execução.

## Verificação obrigatória: divergência de estado (D16)

O quadro-denúncia é verificado **por execução, não por inspeção**. Rode:

```bash
npx vitest run src/exercicios
```

O teste `quadro-denuncia.test.ts` executa as duas versões de cada exercício do
catálogo pela mesma lógica do Worker e compara as sequências de instantâneos
restritas às `variaveisObservadas` — que é tudo o que a visualização recebe. O
exercício é **recusado** se:

1. as sequências forem idênticas, ou divergirem em um único quadro; ou
2. as **trajetórias de estados** forem idênticas. A trajetória é a sequência de
   estados sem as repetições consecutivas: ignora em que linha e em que momento
   o estado muda, e fica só com quais estados ocorrem, em ordem.

O segundo critério pega o caso que o primeiro deixa passar: um defeito que só
muda *quando* o estado muda em relação ao código, e não *qual* estado a
estrutura atravessa. Foi o caso da pilha: dois quadros divergentes, um por
chamada, e nenhum estado diferente para desenhar. O desenho mostra estado; o
que não chega ao estado não chega ao estudante.

Um defeito que só aparece no valor devolvido, numa variável não observada ou na
ordem entre linha e estado **não serve**, por mais claro que pareça ao ler o
código. Troque o defeito, ou observe a variável em que ele se manifesta, se a
visualização souber desenhá-la.

Exercício novo entra no teste sozinho, por estar no `catalogo`. Não o acrescente
a `PENDENTES`: essa lista existe só para exercícios já publicados que a
auditoria reprovou e que aguardam correção.

## Enunciado

Descreve **o comportamento esperado**, nunca o sintoma nem a região do código.
Diga o que o programa deveria fazer e convide à observação.

- Bom: "A pilha deve seguir a política LIFO: o último elemento empilhado é o
  primeiro a sair, e cada chamada de desempilhar() retira apenas esse elemento.
  Execute e acompanhe, na visualização, os elementos da pilha e a posição do
  topo."
- Ruim: "A função desempilhar() está com o índice errado, corrija."

O convite à observação precisa levar ao quadro-denúncia. Convide a olhar o que
o desenho mostra — o estado da estrutura —, e não o que ele não mostra, como o
valor devolvido por uma função.

## Dicas

Exatamente três, em ordem crescente de revelação, e **nenhuma delas nomeia a
linha do defeito**. A progressão pretendida é:

1. Direciona a atenção para a variável ou estrutura relevante.
2. Aponta a relação temporal ou lógica onde está o problema.
3. Descreve a propriedade que deveria valer e não vale.

A terceira dica deixa o estudante a um passo da correção — não faz a correção
por ele.

## Antes de considerar pronto

- [ ] O código com defeito compila e executa sem lançar exceção.
- [ ] Ao menos um caso de teste falha, e falha pelo motivo pretendido.
- [ ] `linhaDoDefeito` confere com o código atual.
- [ ] `npx vitest run src/exercicios` passa: o defeito diverge da versão correta
      em estado observável, verificado por execução (D16).
- [ ] `codigoCorreto` passa em todos os casos.
- [ ] O exercício foi adicionado ao `catalogo`.
