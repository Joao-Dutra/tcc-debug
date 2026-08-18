import { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { executar } from './nucleo/executor';
import { pilhaDesempilhar } from './exercicios/pilha-desempilhar';
import { VisualizadorPilha } from './visualizacao/VisualizadorPilha';
import { ControlesReprodutor, useReprodutor } from './componentes/Reprodutor';
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

  const rodar = async () => {
    setRodando(true);
    setResultado(await executar(exercicio, codigo));
    setRodando(false);
  };

  useEffect(() => {
    void rodar();
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
            <button className="primario" onClick={rodar} disabled={rodando}>
              {rodando ? 'Executando…' : 'Executar'}
            </button>
          </div>
          <CodeMirror
            value={codigo}
            height="420px"
            extensions={[javascript()]}
            onChange={setCodigo}
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
          <button onClick={() => setDicasAbertas((n) => n + 1)}>
            Revelar dica {dicasAbertas + 1}
          </button>
        )}
      </section>
    </div>
  );
}
