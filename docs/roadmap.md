# Roadmap

Registro dos rumos do projeto. Serve para não perder ideia boa e para separar o
que precisa estar pronto antes da coleta do que pode esperar.

**A régua é de marcos, não de calendário.** O desenvolvimento é contínuo, e o
que ordena tudo é um marco: o **congelamento do que o participante vê**, que
acontece antes do experimento. Depois dele, nada que o participante enxerga
muda até o fim da coleta — porque duas sessões sob interfaces diferentes não se
comparam, e a diferença entre os níveis de apoio deixaria de ser atribuível ao
apoio. O que não estiver dentro do congelamento não entra no experimento, e o
que não entra no experimento não vira resultado na monografia.

O congelamento é parcial hoje: o arranjo da tela de exercício já está fechado
(D20). O marco é quando ele passa a valer para tudo o que o participante vê.

---

## Regras permanentes

Não pertencem a marco nenhum: valem do primeiro piloto ao último dia de coleta,
e é por nome que o resto do repositório as cita.

**Nada aponta o defeito.** Nem cor, nem ícone, nem destaque de linha, nem
ordenação, nem animação que chame atenção para a região certa. A única
confirmação de localização que existe é a resposta a um palpite que o estudante
deu.

**Retorno sobre a ação, sim; sobre o desempenho, não.** Responder ao que o
estudante acabou de fazer é permitido. Tempo decorrido, contagem de tentativas,
pontuação, progresso e histórico de resolvidos, não — nem na tela de exercício,
nem na lista.

**Retorno de acerto idêntico nos dois níveis de apoio.** Se a intensidade do
retorno variasse com o apoio, a diferença de desempenho entre os níveis
deixaria de ser atribuível ao apoio. Pela mesma razão, ele não muda de
intensidade entre pilotos: mudar invalida a comparação.

**O que o nível de apoio muda é só o que a interface revela.** O código
executado, os casos avaliados e os instantâneos gerados são idênticos nos dois
(D9) — sem isso, não há grupo de comparação.

---

## O que os pilotos mostraram

### Primeiro piloto

Vinte e cinco sessões, com colegas de curso.

| Achado | Número |
|---|---|
| Sessões abertas | 25 |
| Sessões com alguma ação do estudante | 11 |
| Sessões resolvidas | 8 de 11 |
| Tentativas de localização do defeito | **0** |
| Dicas reveladas | 1 |
| Tempo até a correção | de 27 s a 313 s |
| Distribuição de apoio | 16 completo, 6 parcial, 3 mínimo |

Três conclusões:

1. **A declaração de localização não foi usada uma única vez.** O mecanismo
   funciona; o problema era de descoberta. O alvo é o número da linha, e as
   pessoas clicavam na linha. Sem esse dado, o estudo perde a separação entre
   localizar e corrigir, que é a justificativa de D7.
2. **Os níveis de apoio reduzidos foram quase sempre abandonados.** Não é
   defeito da implementação: é achado, e foi o que justificou reduzir o apoio a
   dois níveis (D9).
3. **Metade das sessões é gente abrindo e fechando.** Esperado num teste
   informal, mas confirma que o experimento precisa de sessão conduzida, com
   identificação do participante.

### Segundo piloto

Nove sessões, depois do convite visual no número da linha e da redução a dois
níveis de apoio.

| Achado | Primeiro piloto | Segundo piloto |
|---|---|---|
| Sessões abertas | 25 | 9 |
| Tentativas de localização do defeito | 0 | **5** |
| Dicas reveladas | 1 | 3 |

Duas conclusões, e as duas mexem no que vem pela frente:

1. **A descoberta está resolvida.** O convite visual no número da linha —
   cursor de ponteiro e a pastilha sob o mouse, igual em todas as linhas —
   bastou para o mecanismo sair do zero. Era o maior risco do projeto, e saiu
   da frente sem que a ferramenta apontasse nada.
2. **As duas metades que D7 queria separar apareceram nos dados.** Uma sessão
   **corrigiu sem nunca localizar**; outra **localizou sem conseguir corrigir**.
   São exatamente os dois casos que justificam registrar localização e correção
   como eventos distintos: com um número só de "resolveu", as duas sessões
   seriam indistinguíveis de qualquer outra. Com a separação, cada uma conta
   uma história diferente sobre onde o estudante travou.

O segundo piloto é pequeno demais para média ou comparação entre níveis. Ele
responde uma pergunta só, que era a que estava aberta: o instrumento registra o
que precisa registrar.

### Nos dados do banco

Com as sessões lidas do banco no painel (D22), dois padrões apareceram que
nenhuma das contagens mostrava:

1. **Varredura de linhas.** Uma sessão com 47 tentativas de localização em 34
   segundos, a cada 300 ms, subindo linha a linha. É o risco que D7 aceitou:
   com veredito imediato e tentativas ilimitadas, apontar cada linha até
   acertar dispensa a investigação. Deu no intervalo de dez segundos entre
   tentativas e no sinal de varredura do painel (D25).
2. **Aba esquecida.** Uma sessão de 28 minutos com uma execução no começo e
   mais nada. A duração total é verdadeira e mente como tempo de trabalho.
   Deu na duração ativa e no sinal de ociosidade (D26).

---

## Como o estudo será aplicado

**Presencialmente, em sala, com cada participante no próprio aparelho.** Não é
detalhe logístico: decide requisito.

- **Persistência em servidor é pré-requisito, e não melhoria.** O `localStorage`
  vive no navegador de cada um. Com a turma inteira em aparelhos próprios, os
  dados ficariam espalhados por dezenas de navegadores, e recolher um a um por
  exportação manual não é viável — basta alguém fechar a aba, limpar o
  navegador ou pular o passo da exportação para a sessão sumir. Por isso
  identidade e banco abrem a sequência abaixo.
- **Sessão conduzida, com identificação do participante.** É o que separa
  participante de curioso, e resolve as sessões de abrir e fechar do primeiro
  piloto.
- **Aparelhos variados.** A interface precisa aguentar tela pequena e janela
  baixa sem esconder nada do que o estudante precisa ver ao mesmo tempo. Já
  verificado em 1366 × 657, 1920 × 960 e em largura de celular.

---

## A sequência até o experimento

Nesta ordem, e a ordem importa: cada item depende do anterior estar de pé.

1. **Identidade e persistência com Supabase** — feito (D21); a verificação do
   RLS está pronta (D24) e falta rodá-la contra o projeto
2. **Painel de acompanhamento lendo do banco** — feito (D22), com a qualidade
   do dado em dia (D23, D25, D26)
3. **Visualizador de vetor com dois índices, e então ordenação e busca**
4. **Área de autoria para professores**
5. **Congelamento do que o participante vê**
6. **Experimento**

### 1. Identidade e persistência com Supabase

Autenticação e banco pelo Supabase, que resolve cadastro e sessão sem backend
próprio. Abre a fila porque o estudo presencial em aparelhos próprios não se
sustenta sem isso, e porque tudo o que vem depois grava no mesmo lugar.

O que precisa estar decidido antes da primeira linha: o registro contém **o
código escrito pelo participante**, não apenas tempos e contagens, e isso
precisa constar do termo de consentimento. Também é preciso definir retenção e
quem tem acesso.

Enquanto o Supabase não entra, `localStorage` espelhando o arquivo em memória,
para que recarregar a página não apague a sessão (D15).

**A conferência do RLS virou script** (D24): `npm run verificar-rls` entra
como participante comum no projeto real e exige que ele não leia nem grave o
que não é dele, e que não mude o próprio papel. As contas de teste nascem e
morrem na própria verificação. **Pendente, e antes de qualquer dado real:**
rodá-la com a chave secreta do projeto, que só ela usa e que não fica no
repositório.

### 2. Painel de acompanhamento lendo do banco

Evolução do painel de métricas atual, lendo do banco em vez da memória.
Continua fora da navegação do participante (D11).

Vem logo depois da persistência porque é ele que mostra se o que está sendo
gravado serve: é melhor descobrir que falta um campo com o painel na mão do que
no dia da coleta.

**Foi o que aconteceu, e a qualidade do dado veio antes do que é novo.** Tudo o
que for construído depois gera dado que depende destas correções:

- a execução disparada e não concluída fica gravada como interrompida (D23);
- entre duas tentativas de localização há um intervalo de dez segundos, e o
  painel sinaliza a sessão com padrão de varredura (D25) — o intervalo muda o
  que o participante vê, e por isso precisava entrar antes do congelamento;
- o painel mostra a duração ativa ao lado da total e sinaliza a sessão com
  silêncio longo (D26).

Os dois sinais são leituras do log, e não dado: valem também para as sessões
já coletadas, e nenhuma é apagada ou excluída por eles.

**Achado pendente.** No modo de desenvolvimento (`npm run dev`, `docker compose
up`), o StrictMode do React desmonta e remonta a tela ao abrir o exercício, e a
desmontagem simulada interrompe a execução automática da abertura (D23): ela
fica gravada como interrompida. No build de produção ela sai certa — conferido
nos dois. Não mexe em métrica nenhuma, porque a automática fica fora de todas,
mas suja o log de quem rodar sessões pelo servidor de desenvolvimento. Ou o
experimento roda do build de produção, ou isto se corrige antes.

### 3. Visualizador de vetor com dois índices, e então ordenação e busca

A ordem interna desta etapa é essa, e não o contrário: **primeiro o desenho,
depois os exercícios.** A ordenação exige dois índices simultâneos — o do laço
externo e o do interno, ou os dois limites da busca binária —, e o visualizador
de vetor hoje desenha um. Escrever os exercícios antes seria escrever defeitos
que o desenho não mostra, que é justamente o que D16 recusa.

Com o desenho pronto, os exercícios são ampliação barata, sobre a estrutura que
o curso mais usa:

- **Bubble sort** — troca sem variável temporária, limite do laço interno,
  comparação invertida.
- **Busca binária** — cálculo do meio, atualização dos limites, condição de
  parada.
- **Selection sort e insertion sort** — bons candidatos, mesma família.

**Merge sort fica de fora.** É recursivo e opera sobre sublistas simultâneas: a
visualização exigiria representar vários vetores e a pilha de chamadas, o que
contraria a diretriz de manter o desenho simples. Se entrar, entra depois e
como fatia própria.

### 4. Área de autoria para professores

**Subiu do horizonte pós-experimento para cá.** A razão não é o experimento: é
o que o trabalho deixa depois dele. Sem a área de autoria, o catálogo só cresce
por quem mexe no repositório, e a ferramenta termina como protótipo de uma
pesquisa. Com ela, vira plataforma que continua útil quando a coleta acabar —
um professor cadastra o exercício da própria disciplina sem depender de
ninguém. Isso é parte do valor do trabalho, e não um apêndice dele.

**Por que cabe antes do congelamento sem ameaçá-lo:** a área vive em rota
separada e restrita, e não toca em nenhuma tela do participante. Pode continuar
evoluindo durante a coleta sem mudar uma linha do que o participante vê.

Área restrita, liberada a pessoas selecionadas. Sem preocupação com código
malicioso nesta etapa, por decisão registrada: o acesso é controlado.

O que **não** pode ser dispensado é a verificação de qualidade. O teste de
quadro-denúncia exige que as duas versões divirjam na trajetória de estados, e
foi ele que pegou o defeito da pilha que ninguém tinha percebido (D16). Um
exercício submetido sem passar por essa verificação entra no catálogo com
defeito que não aparece no desenho — a falha que o projeto já cometeu uma vez.

Forma provável: um modelo a preencher (código correto, código com defeito,
casos de teste, dicas), com a verificação rodando na submissão e recusando o
que não passar. O campo de miniatura (D20) é opcional de propósito: exercício
sem ele cai num cartão sem miniatura, e ninguém fica preso por causa disso.

### 5. Congelamento do que o participante vê

O marco. A partir dele, e até o fim da coleta: nada muda na tela inicial, na
vitrine, na tela de exercício, no que cada nível de apoio revela, no retorno de
acerto ou no desenho das estruturas. Correção de defeito que quebre o
comportamento descrito continua permitida — desde que restaure o que está
descrito, e não altere.

Continuam livres, porque o participante não os vê: a área de autoria, o painel
de acompanhamento, os testes e a documentação.

O congelamento do arranjo da tela de exercício já está em vigor (D20); este
marco estende a mesma regra ao resto.

### 6. Experimento

Sessões conduzidas, presenciais, com o catálogo e a interface congelados.

---

## Depois do experimento, ainda no TCC

- Fila circular desenhada corretamente quando `inicio > fim`; fila cheia
  distinguível de fila vazia.
- Rótulos sobrepostos na lista quando dois marcadores apontam o mesmo nó.
- Retrospectiva ao final do exercício, mostrando ao estudante a própria
  trajetória. Proibida durante o experimento.

---

## Depois do TCC

- Árvore binária de busca e lista duplamente encadeada. Descartadas por ora: o
  layout é mais caro e o desenho deixa de ser simples, o que contraria a
  diretriz do projeto.
- Linguagem adicional, com o custo já mapeado: analisador próprio e execução
  fora do motor do navegador.
- Modo sala de aula, com acompanhamento de várias sessões simultâneas.
- Gamificação plena — progressão, conquistas, trilha. Contraria restrições que
  hoje protegem a validade do estudo, então só como versão posterior, com a
  decisão registrada.
