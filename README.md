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

## Estrutura

| Caminho             | Conteúdo                                       |
|---------------------|------------------------------------------------|
| `src/nucleo/`       | Instrumentação e execução do código            |
| `src/exercicios/`   | Catálogo de exercícios                         |
| `src/visualizacao/` | Visualizadores das estruturas de dados         |
| `src/componentes/`  | Interface                                      |
| `docs/`             | Registro de decisões de projeto                |

`CLAUDE.md` traz o contexto e as convenções seguidas no desenvolvimento.

## Comandos

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # checagem de tipos e build de produção
npm run lint     # análise estática
```
