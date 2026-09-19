import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, { lineNumbers } from '@uiw/react-codemirror';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FlagIcon,
  PlayIcon,
} from '@heroicons/react/20/solid';
import { CheckIcon, XMarkIcon } from '@heroicons/react/16/solid';
import { executar } from '../nucleo/executor';
import { visualizadores } from '../visualizacao/visualizadores';
import { ControlesReprodutor, useReprodutor } from './Reprodutor';
import { useMetricas } from './usar-metricas';
import { CAMINHO_EXERCICIOS, caminhoDoExercicio } from './usar-rota';
import { linhaEmExecucao, marcarLinhaEmExecucao } from './linha-em-execucao';
import { temaDoEditor } from './tema-do-editor';
import {
  destacarLinhaNoEditor,
  detalheDosCasos,
  dicasDisponiveis,
  NIVEIS_DE_ANDAIME,
  rotuloDoAndaime,
} from './andaime';
import type { DetalheDosCasos, NivelDeAndaime } from './andaime';
import type { OrigemDaExecucao } from '../nucleo/metricas';
import type { Exercicio, ResultadoExecucao } from '../nucleo/tipos';

/**
 * Tela de um exercício: código, visualização, casos de teste e dicas.
 *
 * Fluxo: código -> executar() -> instantâneos -> reprodutor -> visualizador.
 *
 * Recebe o exercício pronto e descobre o visualizador pelo campo `estrutura`.
 * Não conhece exercício nenhum em particular.
 */

/**
 * Sinal de acerto: todos os casos passaram.
 *
 * Não recebe o nível de andaime, e é isso que o torna idêntico nos dois: se a
 * intensidade do retorno variasse com o apoio, a diferença de desempenho entre
 * os níveis deixaria de ser atribuível ao apoio (roadmap 1.1). Também não
 * recebe nada da sessão — responde ao que o estudante acabou de fazer, sem
 * tempo, contagem ou histórico.
 *
 * O convite para continuar segue a mesma regra (D20): leva ao próximo
 * exercício e não diz qual é a posição dele, quantos faltam nem quantos já
 * foram resolvidos. O endereço carrega o apoio da sessão atual, porque trocar
 * de apoio no meio de uma sequência tiraria a comparação entre os níveis.
 */
export function SinalDeAcerto({ hrefDoProximo }: { hrefDoProximo?: string }) {
  return (
    <div className="sinal-de-acerto" role="status">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="32" />
        <path d="M22 37 L32 47 L51 27" />
      </svg>
      <div className="dizer-acerto">
        <p>Todos os casos passaram.</p>
        {hrefDoProximo && (
          <a className="botao continuar" href={hrefDoProximo}>
            Ir para o próximo exercício
            <ArrowRightIcon className="icone" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Painel dos casos de teste, nos graus de revelação de D9.
 *
 * Componente próprio para poder ser verificado com um resultado fabricado:
 * a tela inteira só produz resultado depois de executar no Worker.
 *
 * O que é avaliado não muda com o nível — muda só o quanto disso aparece.
 */
export function PainelDeCasos({
  resultado,
  detalhe,
  rodada = 0,
  hrefDoProximo,
}: {
  resultado: ResultadoExecucao | null;
  detalhe: DetalheDosCasos;
  /** Muda a cada execução, para o selo se traçar de novo a cada acerto. */
  rodada?: number;
  /** Endereço do próximo exercício, quando houver (D20). */
  hrefDoProximo?: string;
}) {
  const todosPassaram = resultado?.casos.length
    ? resultado.casos.every((c) => c.passou)
    : false;
  const algumFalhou = (resultado?.casos.length ?? 0) > 0 && !todosPassaram;

  return (
    <section className={todosPassaram ? 'painel acertou' : 'painel'}>
      {/* O sinal fica fora do trecho que varia com o andaime (D9). */}
      {todosPassaram ? (
        <SinalDeAcerto key={rodada} hrefDoProximo={hrefDoProximo} />
      ) : (
        <h2>Casos de teste</h2>
      )}
      {/* O erro de execução aparece em qualquer nível: sem ele o estudante
          não saberia que o próprio código deixou de rodar, e isso não é
          apoio para encontrar o defeito implantado. */}
      {resultado?.erro && <p className="erro">{resultado.erro}</p>}
      {detalhe === 'apenas-que-falhou' ? (
        algumFalhou && <p className="aviso-falha">Algum caso de teste falhou.</p>
      ) : (
        <ul className="casos">
          {resultado?.casos.map((c) => (
            <li key={c.descricao} className={c.passou ? 'passou' : 'falhou'}>
              {c.passou ? (
                <CheckIcon className="icone" aria-hidden="true" />
              ) : (
                <XMarkIcon className="icone" aria-hidden="true" />
              )}
              <span>
                <span className="so-leitor">{c.passou ? 'passou: ' : 'falhou: '}</span>
                {c.descricao}
              </span>
              {!c.passou && detalhe === 'esperado-e-obtido' && (
                <span className="detalhe">
                  esperado {JSON.stringify(c.esperado)}, obtido {JSON.stringify(c.obtido)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Props {
  exercicio: Exercicio;
  andaime: NivelDeAndaime;
  /**
   * Para onde o convite de continuar leva. Vem de fora porque a tela não
   * conhece o catálogo — ela desenha um exercício, não uma sequência.
   */
  proximo?: Exercicio;
}

export function TelaExercicio({ exercicio, andaime, proximo }: Props) {
  const [codigo, setCodigo] = useState(exercicio.codigoComDefeito);
  const [resultado, setResultado] = useState<ResultadoExecucao | null>(null);
  const [rodando, setRodando] = useState(false);
  const [dicasAbertas, setDicasAbertas] = useState(0);
  // O código da última execução, para o botão dizer se o do editor é outro.
  // Não conta nada: compara dois textos.
  const [codigoExecutado, setCodigoExecutado] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);

  const reprodutor = useReprodutor(resultado?.instantaneos ?? []);
  const metricas = useMetricas(exercicio.id, exercicio.linhaDoDefeito, andaime);
  const jaAbriu = useRef(false);
  const editor = useRef<ReactCodeMirrorRef>(null);

  const Visualizador = visualizadores[exercicio.estrutura];

  // O manipulador do gutter é criado uma vez só, junto da extensão; o ref
  // mantém a versão atual da função sem forçar o CodeMirror a reconfigurar.
  const declarar = useRef<(linha: number) => void>(() => {});
  useEffect(() => {
    declarar.current = metricas.declararLocalizacao;
  }, [metricas.declararLocalizacao]);

  const extensoes = useMemo(
    () => [
      javascript(),
      // Clicar no número da linha declara a suspeita. É um alvo separado do
      // texto de propósito: apontar não pode atrapalhar quem quer digitar.
      lineNumbers({
        domEventHandlers: {
          mousedown: (view, bloco) => {
            declarar.current(view.state.doc.lineAt(bloco.from).number);
            return true;
          },
        },
      }),
      linhaEmExecucao,
    ],
    []
  );

  const rodar = async (origem: OrigemDaExecucao) => {
    setRodando(true);
    const saida = await executar(exercicio, codigo);
    metricas.registrarExecucao(origem, codigo, saida);
    setResultado(saida);
    setCodigoExecutado(codigo);
    setRodada((r) => r + 1);
    setRodando(false);
  };

  const aoEditar = (valor: string) => {
    if (valor === codigo) return;
    setCodigo(valor);
    metricas.registrarEdicao(valor);
  };

  const revelarDica = () => {
    metricas.registrarDica(dicasAbertas);
    setDicasAbertas((n) => n + 1);
  };

  useEffect(() => {
    // O StrictMode remonta o efeito em desenvolvimento; sem a trava, a abertura
    // do exercício entraria duas vezes no registro da sessão.
    if (jaAbriu.current) return;
    jaAbriu.current = true;
    void rodar('automatica');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voltar a edição ao código executado apaga o sinal: o que importa é se o
  // que está no editor já rodou, e não se houve digitação no meio.
  const pendente = codigoExecutado !== null && codigo !== codigoExecutado;

  const linhaAtual = reprodutor.atual?.linha;
  // O andaime é consultado só aqui e na visualização. O que é executado e o
  // que é registrado não muda com ele (D9).
  const detalhe = detalheDosCasos(andaime);
  const dicasPermitidas = Math.min(dicasDisponiveis(andaime), exercicio.dicas.length);

  // A mesma linha do indicador textual, marcada no editor. Sem execução
  // carregada, ou no nível sem apoio, não há marca.
  const linhaNoEditor = destacarLinhaNoEditor(andaime) ? (linhaAtual ?? null) : null;
  useEffect(() => {
    const view = editor.current?.view;
    if (view) marcarLinhaEmExecucao(view, linhaNoEditor);
  }, [linhaNoEditor]);

  return (
    <div className="pagina tela-exercicio">
      <header>
        <div className="linha-topo">
          <a className="voltar" href={CAMINHO_EXERCICIOS}>
            <ArrowLeftIcon className="icone" aria-hidden="true" />
            Todos os exercícios
          </a>
          {/* Trocar de nível troca de sessão (D8), e por isso o exercício
              recomeça: duas tentativas sob apoios diferentes não podem ser
              somadas, então nem o código editado atravessa a troca. */}
          <p className="abertura">
            <span className="rotulo-abertura">apoio</span>
            {NIVEIS_DE_ANDAIME.map((nivel) =>
              nivel === andaime ? (
                <span key={nivel} className="nivel ativo" aria-current="true">
                  {rotuloDoAndaime(nivel)}
                </span>
              ) : (
                <a
                  key={nivel}
                  className="nivel"
                  href={caminhoDoExercicio(exercicio.id, nivel)}
                >
                  {rotuloDoAndaime(nivel)}
                </a>
              )
            )}
            <span className="aviso-troca">trocar o apoio recomeça o exercício</span>
          </p>
        </div>
        <h1>{exercicio.titulo}</h1>
        <p>{exercicio.enunciado}</p>
      </header>

      {/* Arranjo compacto (D20): código, visualização e casos de teste cabem
          juntos numa tela comum, sem rolar a página. Investigar é ir e voltar
          entre os três — o teste que falha, o desenho que mostra o estado e a
          linha que o produz —, e cada rolagem no meio disso é memória de
          trabalho gasta em achar de novo o que saiu da tela. */}
      <main className="grade-exercicio">
        <section className="painel painel-codigo">
          <div className="cabecalho-painel">
            <h2>Código</h2>
            <button
              className={pendente && !rodando ? 'primario executar pendente' : 'primario executar'}
              onClick={() => void rodar('estudante')}
              disabled={rodando}
            >
              <PlayIcon className="icone" aria-hidden="true" />
              {rodando ? 'Executando…' : pendente ? 'Executar alterações' : 'Executar'}
              {pendente && !rodando && <span className="ponto" aria-hidden="true" />}
            </button>
          </div>
          {/* Sem o destaque da linha do cursor, que viria ligado por padrão: uma
              segunda faixa que segue o cursor disputaria com a da execução, e
              a versão dele no gutter, onde se declara a localização, poderia
              ser lida como marca de um palpite.

              A altura vem da moldura, que ocupa o que sobra da coluna: o
              editor rola por dentro, e a página não. */}
          <CodeMirror
            ref={editor}
            className="moldura-editor"
            value={codigo}
            height="100%"
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            theme={temaDoEditor}
            extensions={extensoes}
            onChange={aoEditar}
          />
          {/* Logo abaixo do código, que é onde se aponta. O painel fica sempre
              no lugar, mesmo vazio, para o alvo da declaração não aparecer do
              nada. */}
          <div className="retorno-apontadas">
            <h2>Onde você apontou</h2>
            {metricas.localizacoes.length === 0 ? (
              // Estado vazio como convite: o primeiro piloto registrou zero
              // declarações em 25 sessões, e o problema era de descoberta.
              <p className="rodape-painel">
                Nenhuma linha apontada. Clique no número de uma linha do código para
                dizer onde você acha que está o defeito. Pode tentar quantas vezes
                quiser, antes ou depois de editar.
              </p>
            ) : (
              <ul className="casos apontadas">
                {metricas.localizacoes.map((l, i) => (
                  <li key={i} className={l.correta ? 'passou' : 'falhou'}>
                    <FlagIcon className="icone bandeira" aria-hidden="true" />
                    <span className="linha">Linha {l.linha}</span>
                    <span className="veredito">
                      {l.correta ? (
                        <CheckIcon className="icone" aria-hidden="true" />
                      ) : (
                        <XMarkIcon className="icone" aria-hidden="true" />
                      )}
                      {l.correta ? 'o defeito está aqui' : 'o defeito não está aqui'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="coluna-investigacao">
          <section className="painel painel-visualizacao">
            <h2>Visualização</h2>
            <div className="bancada">
              {Visualizador ? (
                <Visualizador instantaneo={reprodutor.atual} nivelAndaime={andaime} />
              ) : (
                <p className="rodape-painel">
                  Ainda não há visualizador para esta estrutura de dados.
                </p>
              )}
            </div>
            {/* Junto à animação de propósito (D10): manter de cabeça a
                correspondência entre a instrução e o quadro consome memória de
                trabalho, e não é esse o esforço que o estudo quer observar.

                Fica fora do fading de D9 — aparece em todos os níveis, por ser
                também o principal recurso de legibilidade da ferramenta. Por
                isso mora na tela, e não no visualizador. */}
            <div className="rodape-bancada">
              {/* Linha nula é o quadro final, depois do fim do programa (D1). */}
              {linhaAtual !== undefined && (
                <p className="indicador-linha">
                  {linhaAtual === null ? 'Execução terminada' : `Executando a linha ${linhaAtual}`}
                </p>
              )}
              <ControlesReprodutor reprodutor={reprodutor} />
            </div>
          </section>

          {/* Os casos logo abaixo do desenho, e não mais acima de tudo: o teste
              que falha continua sendo de onde o estudante parte (D10), mas
              agora sem empurrar o código e a visualização para fora da tela.
              As dicas vêm depois, e é esta parte que rola quando falta
              altura — o desenho fica parado. */}
          <div className="coluna-retorno">
            <div className="faixa-casos">
              <PainelDeCasos
                resultado={resultado}
                detalhe={detalhe}
                rodada={rodada}
                // O mesmo apoio da sessão atual segue no endereço. Abrir o
                // próximo encerra esta sessão e começa outra (D8): é troca de
                // rota, e a tela remonta com chave nova.
                hrefDoProximo={proximo && caminhoDoExercicio(proximo.id, andaime)}
              />
            </div>
            {dicasPermitidas > 0 && (
              <section className="painel painel-dicas">
                <h2>Dicas</h2>
                {dicasAbertas > 0 && (
                  <ol className="dicas">
                    {exercicio.dicas.slice(0, dicasAbertas).map((d, i) => (
                      <li key={d} className="dica">
                        <strong>Dica {i + 1}</strong>
                        {d}
                      </li>
                    ))}
                  </ol>
                )}
                {dicasAbertas < dicasPermitidas && (
                  <button onClick={revelarDica}>Revelar dica {dicasAbertas + 1}</button>
                )}
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Nenhum contador da sessão aparece aqui de propósito: mostrar ao
          estudante quantas vezes ele executou ou quantas dicas abriu muda o
          comportamento que o estudo quer medir. Pela mesma razão a exportação
          das métricas não fica aqui, e sim só no painel do pesquisador (D11). */}
    </div>
  );
}
