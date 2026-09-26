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

1. **Identidade e persistência com Supabase** — feito (D21), com o RLS
   verificado contra o projeto (D24)
2. **Painel de acompanhamento lendo do banco** — feito (D22), com a qualidade
   do dado em dia (D23, D25, D26)
3. **Visualizador de vetor com dois índices, e então ordenação e busca** —
   feito: o desenho (D27) e os dois exercícios (D28)
4. **Área de autoria para professores** — feita (D31): escrita, verificação,
   revisão e publicação, com o RLS verificado contra o projeto
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
morrem na própria verificação. **Rodou contra o projeto em 23/09/2026, e as
catorze verificações passaram** — inclusive as duas do papel, que são as que
separam um participante das sessões da turma inteira. Roda de novo a cada
migração que mexa numa política.

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

**Um achado do caminho, já corrigido.** No modo de desenvolvimento (`npm run
dev`, `docker compose up`), o StrictMode do React desmontava e remontava a tela
ao abrir o exercício, e a desmontagem simulada interrompia a execução
automática da abertura (D23): ela ficava gravada como interrompida. No build de
produção não acontecia. Não mexia em métrica nenhuma, mas sujava o log de quem
rodasse sessões pelo servidor de desenvolvimento — e um log sujo só aparece na
análise, quando não há mais remédio. O desmonte deixou de interromper, e um
teste de navegador guarda o caso no próprio modo em que ele aparecia (D23,
correção de 23/09/2026). O experimento continua devendo rodar do build de
produção, mas não depende disso.

### 3. Visualizador de vetor com dois índices, e então ordenação e busca

A ordem interna desta etapa é essa, e não o contrário: **primeiro o desenho,
depois os exercícios.** A ordenação exige dois índices simultâneos — o do laço
externo e o do interno, ou os dois limites da busca binária —, e o visualizador
de vetor hoje desenha um. Escrever os exercícios antes seria escrever defeitos
que o desenho não mostra, que é justamente o que D16 recusa.

**O desenho ficou pronto** (D27): cada marcador declarado pelo exercício ganha
faixa e forma próprias — seta cheia, vazada e losango —, as demais variáveis
observadas viram caixas de valor, e o quadro mostra de onde veio o valor que
acabou de ser escrito, com o valor percorrendo o caminho. A troca deixou de
ser o vetor aparecendo trocado no quadro seguinte.

**Os dois exercícios estão escritos** (D28), sobre a estrutura que o curso mais
usa, e os defeitos foram escolhidos por execução, medindo os candidatos:

- **Bubble sort** — troca sem a temporária: o valor volta da posição que acabou
  de ser sobrescrita, e o original fica parado na caixa. O limite do laço
  interno não quebra caso nenhum em JavaScript, e a comparação invertida se lê
  no código sem olhar o desenho.
- **Busca binária** — condição de parada: o laço desiste quando resta uma
  posição só, e é ali que estão os valores das pontas. O cálculo do meio e a
  atualização dos limites entram em laço infinito em alguma entrada, e o
  estudante receberia o limite de passos do Worker em vez de um quadro.
- **Selection sort e insertion sort** — continuam bons candidatos e continuam
  de fora: o estudo prevê dois desta família, e dois bem feitos valem mais que
  três medianos.

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
**Com uma exceção, que veio com a publicação:** os exercícios publicados
aparecem na vitrine. Por isso nada é publicado até o fim da coleta (D31, e o
item 5).

Área restrita, liberada a pessoas selecionadas. Sem preocupação com código
malicioso nesta etapa, por decisão registrada: o acesso é controlado.

O que **não** pode ser dispensado é a verificação de qualidade. O teste de
quadro-denúncia exige que as duas versões divirjam na trajetória de estados, e
foi ele que pegou o defeito da pilha que ninguém tinha percebido (D16). Um
exercício submetido sem passar por essa verificação entra no catálogo com
defeito que não aparece no desenho — a falha que o projeto já cometeu uma vez.

**Como ficou (D31).** O professor preenche um modelo — a estrutura, com os
nomes que o desenho procura mostrados antes do código; o código correto e o com
defeito; os casos; três dicas — e a verificação roda no navegador dele,
recusando com o motivo. A linha do defeito sai da comparação entre as versões,
pela regra revista em D30. O pesquisador revisa em `#/revisao`, onde a
verificação é refeita e só ela libera a publicação; o relatório gravado pelo
professor fica como referência, com a divergência sinalizada. Os publicados
aparecem numa seção à parte da vitrine, sem o código correto chegar ao
navegador do aluno. O campo de miniatura (D20) não entrou no modelo: o
proposto aparece num cartão sem miniatura.

**Falta, à mão, no painel do Supabase:** o provedor Google e as URLs de retorno
da área (D31, configuração). Sem eles, o professor entra só por e-mail e senha.

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

**Os propostos por professores entram no congelamento.** A seção deles é parte
da vitrine, e nada é publicado até o fim da coleta (D31): o que for escrito
antes disso espera em revisão, que o aluno não vê, e é publicado depois. A
retirada, definitiva, não é usada para segurar exercício. Antes do início,
confere-se que não há nenhum publicado.

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
