---
name: criar-exercicio
description: Use ao criar, revisar ou ajustar um exercício do catálogo — qualquer arquivo em src/exercicios/. Cobre a escolha do defeito a implantar, a redação do enunciado e das dicas, os casos de teste e a conferência de que o defeito é realmente detectável pela visualização.
---

# Criar um exercício

Um exercício é um módulo em `src/exercicios/` que exporta um objeto `Exercicio`
(ver `src/nucleo/tipos.ts`). Use `pilha-desempilhar.ts` como modelo.

## Regra principal

O defeito precisa ser **visível na visualização e invisível na leitura casual do
código**. Se o estudante acha o bug só lendo, a visualização virou enfeite e o
exercício não serve ao propósito do trabalho. Se o bug não produz nenhuma
diferença no desenho da estrutura, também não serve.

Antes de finalizar, responda: *qual quadro da animação denuncia o defeito?*
Se não houver resposta clara, troque o defeito.

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

## Enunciado

Descreve **o comportamento esperado**, nunca o sintoma nem a região do código.
Diga o que o programa deveria fazer e convide à observação.

- Bom: "A pilha deve seguir a política LIFO. Empilhe alguns valores e observe o
  que desempilhar() devolve."
- Ruim: "A função desempilhar() está com o índice errado, corrija."

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
- [ ] Existe um quadro da animação que denuncia o defeito.
- [ ] `codigoCorreto` passa em todos os casos.
- [ ] O exercício foi adicionado ao `catalogo`.
