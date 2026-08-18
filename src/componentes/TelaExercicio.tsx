import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, { lineNumbers } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { executar } from '../nucleo/executor';
import { visualizadores } from '../visualizacao/visualizadores';
import { ControlesReprodutor, useReprodutor } from './Reprodutor';
import { baixarMetricas, useMetricas } from './usar-metricas';
import { CAMINHO_INICIAL } from './usar-rota';
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

interface Props {
  exercicio: Exercicio;
}

export function TelaExercicio({ exercicio }: Props) {
  const [codigo, setCodigo] = useState(exercicio.codigoComDefeito);
  const [resultado, setResultado] = useState<ResultadoExecucao | null>(null);
  const [rodando, setRodando] = useState(false);
  const [dicasAbertas, setDicasAbertas] = useState(0);

  const reprodutor = useReprodutor(resultado?.instantaneos ?? []);
  const metricas = useMetricas(exercicio.id, exercicio.linhaDoDefeito);
  const jaAbriu = useRef(false);

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
    ],
    []
  );

  const rodar = async (origem: OrigemDaExecucao) => {
    setRodando(true);
    const saida = await executar(exercicio, codigo);
    metricas.registrarExecucao(origem, codigo, saida);
    setResultado(saida);
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

  const linhaAtual = reprodutor.atual?.linha;
  const todosPassaram =
    resultado?.casos.length ? resultado.casos.every((c) => c.passou) : false;

  return (
    <div className="pagina">
      <header>
        <a className="voltar" href={CAMINHO_INICIAL}>
          ◀ todos os exercícios
        </a>
        <h1>{exercicio.titulo}</h1>
        <p>{exercicio.enunciado}</p>
      </header>

      <main>
        <section className="painel">
          <div className="cabecalho-painel">
            <h2>Código</h2>
            <button
              className="primario"
              onClick={() => void rodar('estudante')}
              disabled={rodando}
            >
              {rodando ? 'Executando…' : 'Executar'}
            </button>
          </div>
          <CodeMirror
            value={codigo}
            height="420px"
            basicSetup={{ lineNumbers: false, foldGutter: false }}
            extensions={extensoes}
            onChange={aoEditar}
          />
          <p className="rodape-painel">
            Clique no número de uma linha para apontar onde você acredita que está o
            defeito. Pode tentar quantas vezes quiser, antes ou depois de editar.
          </p>
          {linhaAtual !== undefined && (
            <p className="rodape-painel">Executando a linha {linhaAtual}</p>
          )}
        </section>

        <section className="painel">
          <h2>Visualização</h2>
          {Visualizador ? (
            <Visualizador instantaneo={reprodutor.atual} />
          ) : (
            <p className="rodape-painel">
              Ainda não há visualizador para esta estrutura de dados.
            </p>
          )}
          <ControlesReprodutor reprodutor={reprodutor} />
        </section>
      </main>

      {metricas.localizacoes.length > 0 && (
        <section className="painel">
          <h2>Onde você apontou</h2>
          <ul className="casos">
            {metricas.localizacoes.map((l, i) => (
              <li key={i} className={l.correta ? 'passou' : 'falhou'}>
                <strong>{l.correta ? '✓' : '✗'}</strong> Linha {l.linha} —{' '}
                {l.correta ? 'o defeito está aqui' : 'o defeito não está aqui'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="painel">
        <h2>Casos de teste</h2>
        {resultado?.erro && <p className="erro">{resultado.erro}</p>}
        <ul className="casos">
          {resultado?.casos.map((c) => (
            <li key={c.descricao} className={c.passou ? 'passou' : 'falhou'}>
              <strong>{c.passou ? '✓' : '✗'}</strong> {c.descricao}
              {!c.passou && (
                <span className="detalhe">
                  esperado {JSON.stringify(c.esperado)}, obtido {JSON.stringify(c.obtido)}
                </span>
              )}
            </li>
          ))}
        </ul>
        {todosPassaram && <p className="sucesso">Todos os casos passaram.</p>}
      </section>

      <section className="painel">
        <h2>Dicas</h2>
        {exercicio.dicas.slice(0, dicasAbertas).map((d) => (
          <p key={d} className="dica">{d}</p>
        ))}
        {dicasAbertas < exercicio.dicas.length && (
          <button onClick={revelarDica}>Revelar dica {dicasAbertas + 1}</button>
        )}
      </section>

      {/* Nenhum contador da sessão aparece aqui de propósito: mostrar ao
          estudante quantas vezes ele executou ou quantas dicas abriu muda o
          comportamento que o estudo quer medir. */}
      <section className="painel">
        <h2>Sessão</h2>
        <p className="rodape-painel">
          As métricas ficam apenas na memória do navegador e se perdem ao recarregar a
          página. A exportação inclui todas as sessões abertas desde que a página
          carregou.
        </p>
        <button
          onClick={() => baixarMetricas(metricas.exportar(), `metricas-${exercicio.id}.json`)}
        >
          Exportar métricas (JSON)
        </button>
      </section>
    </div>
  );
}
