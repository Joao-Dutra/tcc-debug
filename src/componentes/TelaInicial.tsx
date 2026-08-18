import { catalogo } from '../exercicios/catalogo';
import { exportarMetricas } from '../nucleo/metricas';
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
        <ul className="lista-exercicios">
          {exercicios.map((exercicio) => (
            <li key={exercicio.id} className="cartao-exercicio">
              <a href={caminhoDoExercicio(exercicio.id)}>
                <h3>{exercicio.titulo}</h3>
                <p className="meta-exercicio">
                  {exercicio.tutorial && <span className="etiqueta">tutorial</span>}
                  <span>{NOME_DA_ESTRUTURA[exercicio.estrutura]}</span>
                  <span>nível {exercicio.dificuldade} de 3</span>
                </p>
              </a>
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
