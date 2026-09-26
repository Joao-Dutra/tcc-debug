import { useEffect, useState } from 'react';
import { executar } from '../nucleo/executor';
import { visualizadores } from '../visualizacao/visualizadores';
import { ControlesReprodutor, useReprodutor } from './Reprodutor';
import type { Exercicio, ResultadoExecucao, TipoEstrutura } from '../nucleo/tipos';

/**
 * A prévia do desenho, com e sem o defeito, lado a lado (D31).
 *
 * É para quem escreve o exercício ver o próprio quadro-denúncia: o momento em
 * que as duas versões se separam no desenho. Não é a tela do aluno, de
 * propósito — a tela do aluno grava sessão, e a prévia de um professor não é
 * dado do estudo.
 *
 * Mostra o código correto em ação, o que na tela do aluno seria proibido; aqui
 * quem olha é quem o escreveu.
 */

function Versao({
  titulo,
  resultado,
  estrutura,
}: {
  titulo: string;
  resultado: ResultadoExecucao;
  estrutura: TipoEstrutura;
}) {
  const reprodutor = useReprodutor(resultado.instantaneos);
  const Visualizador = visualizadores[estrutura];
  const linha = reprodutor.atual?.linha;
  return (
    <section className="versao-da-previa">
      <h3>{titulo}</h3>
      {resultado.erro && <p className="erro">{resultado.erro}</p>}
      <div className="bancada">
        {Visualizador && <Visualizador instantaneo={reprodutor.atual} nivelAndaime="com-apoio" />}
      </div>
      <div className="rodape-bancada">
        {linha !== undefined && (
          <p className="indicador-linha">
            {linha === null ? 'Execução terminada' : `Executando a linha ${linha}`}
          </p>
        )}
        <ControlesReprodutor reprodutor={reprodutor} />
      </div>
    </section>
  );
}

export function PreviaDoExercicio({ exercicio }: { exercicio: Exercicio }) {
  const [resultados, setResultados] = useState<{
    comDefeito: ResultadoExecucao;
    correto: ResultadoExecucao;
  } | null>(null);

  useEffect(() => {
    // Uma resposta que chega depois de outra prévia ter sido pedida é de um
    // código que já não é o do formulário.
    let valida = true;
    setResultados(null);
    void Promise.all([
      executar(exercicio, exercicio.codigoComDefeito),
      executar(exercicio, exercicio.codigoCorreto),
    ]).then(([comDefeito, correto]) => {
      if (valida) setResultados({ comDefeito, correto });
    });
    return () => {
      valida = false;
    };
  }, [exercicio]);

  if (!resultados) return <p className="rodape-painel">Executando as duas versões…</p>;

  return (
    <div className="previa">
      <Versao titulo="Com defeito" resultado={resultados.comDefeito} estrutura={exercicio.estrutura} />
      <Versao titulo="Correto" resultado={resultados.correto} estrutura={exercicio.estrutura} />
    </div>
  );
}
