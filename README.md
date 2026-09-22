# Depurar para aprender

Aplicação web para o ensino de algoritmos e estruturas de dados por meio da
depuração de defeitos lógicos implantados, com visualização gráfica animada da
estrutura manipulada.

Trabalho de Conclusão de Curso — Bacharelado em Sistemas de Informação
IFMG, Campus Ouro Branco.

## Como rodar

Com Docker:

```bash
docker compose up
```

Sem Docker (Node 22 ou superior):

```bash
npm install
npm run dev
```

A aplicação sobe em <http://localhost:5173>.

### Banco (opcional)

Sem configuração, a aplicação funciona inteira e guarda as sessões só no
aparelho. Para gravar também no Supabase, copie `.env.example` para `.env` e
preencha as duas chaves; o esquema e as políticas estão em
`supabase/migracoes/` e rodam uma vez, no editor SQL do projeto. Os detalhes
ficam em D21, no registro de decisões.

As políticas se conferem contra o projeto com `npm run verificar-rls`, antes de
qualquer dado real e depois de toda migração. A verificação usa a chave secreta
do projeto, passada só para o comando e nunca guardada no repositório (D24).

## Estrutura

| Caminho             | Conteúdo                                       |
|---------------------|------------------------------------------------|
| `src/nucleo/`       | Instrumentação e execução do código            |
| `src/exercicios/`   | Catálogo de exercícios                         |
| `src/visualizacao/` | Visualizadores das estruturas de dados         |
| `src/componentes/`  | Interface                                      |
| `src/supabase/`     | Identidade e gravação das sessões no banco     |
| `supabase/`         | Esquema e políticas do banco, e a verificação  |
| `docs/`             | Registro de decisões de projeto                |

`CLAUDE.md` traz o contexto e as convenções seguidas no desenvolvimento.

## Comandos

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # checagem de tipos e build de produção
npm run lint     # análise estática
npx vitest run   # testes do núcleo, dos exercícios e do CSS
npm run e2e      # testes de ponta a ponta, no Edge instalado na máquina
npm run verificar-rls  # RLS contra o projeto Supabase (chave secreta; D24)
```
