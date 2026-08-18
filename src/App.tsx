import { useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { executar } from './nucleo/executor';
import { pilhaDesempilhar } from './exercicios/pilha-desempilhar';
import { VisualizadorPilha } from './visualizacao/VisualizadorPilha';
import { ControlesReprodutor, useReprodutor } from './componentes/Reprodutor';
import { baixarMetricas, useMetricas } from './componentes/usar-metricas';
import type { OrigemDaExecucao } from './nucleo/metricas';
import type { ResultadoExecucao } from './nucleo/tipos';

/**
 * Tela do exercício — fatia vertical que valida a arquitetura inteira.
 *
 * Fluxo: código -> executar() -> instantâneos -> reprodutor -> visualizador.
 */
export default function App() {
  const exercicio = pilhaDesempilhar;
  const [codigo, setCodigo] = useState(exercicio.codigoComDefeito);
  const [resultado, setResultado] = useState<ResultadoExecucao | null>(null);
  const [rodando, setRodando] = useState(false);
  const [dicasAbertas, setDicasAbertas] = useState(0);

  const reprodutor = useReprodutor(resultado?.instantaneos ?? []);
  const metricas = useMetricas(exercicio.id);
  const jaAbriu = useRef(false);

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
            extensions={[javascript()]}
            onChange={aoEditar}
          />
          {linhaAtual !== undefined && (
            <p className="rodape-painel">Executando a linha {linhaAtual}</p>
          )}
        </section>

        <section className="painel">
          <h2>Visualização</h2>
          <VisualizadorPilha instantaneo={reprodutor.atual} />
          <ControlesReprodutor reprodutor={reprodutor} />
        </section>
      </main>

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
          As métricas desta sessão ficam apenas na memória do navegador e se perdem ao
          recarregar a página.
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
