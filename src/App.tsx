import { catalogo } from './exercicios/catalogo';
import { TelaExercicio } from './componentes/TelaExercicio';
import { TelaInicial } from './componentes/TelaInicial';
import { CAMINHO_INICIAL, useRota } from './componentes/usar-rota';

/**
 * Só roteamento.
 *
 * Os exercícios vêm do catálogo e os visualizadores do registro em
 * src/visualizacao: acrescentar um exercício ou um visualizador não passa
 * mais por este arquivo.
 */
export default function App() {
  const rota = useRota();

  if (rota.tela === 'inicial') return <TelaInicial />;

  const exercicio = catalogo.find((e) => e.id === rota.id);

  if (!exercicio) {
    return (
      <div className="pagina">
        <header>
          <h1>Exercício não encontrado</h1>
          <p>
            Nenhum exercício do catálogo tem o identificador <code>{rota.id}</code>.
          </p>
        </header>
        <a className="voltar" href={CAMINHO_INICIAL}>
          ◀ todos os exercícios
        </a>
      </div>
    );
  }

  // A `key` faz cada abertura montar uma tela nova, e com ela uma sessão de
  // métricas nova — inclusive ao reabrir o mesmo exercício.
  return <TelaExercicio key={exercicio.id} exercicio={exercicio} />;
}
