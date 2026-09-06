import { catalogo } from '../exercicios/catalogo';
import { exportarMetricas } from '../nucleo/metricas';
import { NIVEIS_DE_ANDAIME, rotuloDoAndaime } from './andaime';
import { baixarMetricas } from './usar-metricas';
import { caminhoDoExercicio } from './usar-rota';
import type { TipoEstrutura } from '../nucleo/tipos';

/**
 * Lista os exercícios disponíveis. Nada de progresso, pontuação ou histórico:
 * saber de antemão quais já foram resolvidos muda a forma como o estudante
 * encara os que faltam.
 */

const NOME_DA_ESTRUTURA: Record<TipoEstrutura, string> = {
  vetor: 'vetor',
  pilha: 'pilha',
  fila: 'fila',
  'lista-encadeada': 'lista encadeada',
};

export function TelaInicial() {
  // O tutorial vem primeiro. A ordenação é estável, então o resto mantém a
  // ordem do catálogo, que é crescente em dificuldade.
  const exercicios = [...catalogo].sort(
    (a, b) => Number(b.tutorial ?? false) - Number(a.tutorial ?? false)
  );

  return (
    <div className="pagina">
      <header>
        <h1>Depurar</h1>
        <p>
          Cada exercício traz um código quase correto, com um defeito implantado. Sua
          tarefa é encontrar o defeito e corrigi-lo, usando a visualização da estrutura
          de dados para investigar o que acontece durante a execução.
        </p>
      </header>

      <section className="painel">
        <h2>Exercícios</h2>
        {/* As duas escalas são fáceis de confundir, então a tela diz qual é
            qual antes de mostrá-las. A complexidade descreve o exercício e não
            muda; o apoio é escolhido a cada abertura. */}
        <p className="rodape-painel">
          A complexidade é do exercício e não muda. O apoio é escolhido a cada
          abertura: quanto menor, menos a ferramenta adianta.
        </p>
        <ul className="lista-exercicios">
          {exercicios.map((exercicio) => (
            <li key={exercicio.id} className="cartao-exercicio">
              <h3>{exercicio.titulo}</h3>
              <p className="meta-exercicio">
                {exercicio.tutorial && <span className="etiqueta">tutorial</span>}
                <span>{NOME_DA_ESTRUTURA[exercicio.estrutura]}</span>
                <span className="complexidade">
                  complexidade {exercicio.dificuldade} de 3
                </span>
              </p>
              {/* Um cartão por exercício, com as três aberturas dentro dele.
                  Três cartões separados sugeririam três exercícios. */}
              <p className="abertura">
                <span className="rotulo-abertura">abrir com apoio</span>
                {NIVEIS_DE_ANDAIME.map((nivel) => (
                  <a
                    key={nivel}
                    className="nivel"
                    href={caminhoDoExercicio(exercicio.id, nivel)}
                  >
                    {rotuloDoAndaime(nivel)}
                  </a>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* O botão aparece mesmo sem sessão nenhuma guardada. Escondê-lo quando
          não há nada contaria ao estudante que ele ainda não abriu exercício
          algum, que é o tipo de progresso que esta tela não mostra. */}
      <footer className="rodape-inicial">
        <button
          className="discreto"
          onClick={() => baixarMetricas(exportarMetricas(), 'metricas.json')}
        >
          Exportar métricas (JSON)
        </button>
      </footer>
    </div>
  );
}
