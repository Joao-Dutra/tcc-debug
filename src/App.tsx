import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { catalogo, proximoDoCatalogo } from './exercicios/catalogo';
import { AreaDoProfessor } from './componentes/AreaDoProfessor';
import { PainelDeMetricas } from './componentes/PainelDeMetricas';
import { RevisaoDeExercicios } from './componentes/RevisaoDeExercicios';
import { TelaExercicio } from './componentes/TelaExercicio';
import { TelaInicial } from './componentes/TelaInicial';
import { VitrineDeExercicios } from './componentes/VitrineDeExercicios';
import { CAMINHO_EXERCICIOS, useRota } from './componentes/usar-rota';

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
  if (rota.tela === 'exercicios') return <VitrineDeExercicios />;

  // Rota do pesquisador (D11). Nenhuma tela do participante aponta para ela.
  if (rota.tela === 'metricas') return <PainelDeMetricas />;

  // Área do professor (D29, D31), com entrada própria na tela inicial.
  if (rota.tela === 'autoria') return <AreaDoProfessor />;

  // Revisão dos exercícios de professor, pelo pesquisador (D31).
  if (rota.tela === 'revisao') return <RevisaoDeExercicios />;

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
        <a className="voltar" href={CAMINHO_EXERCICIOS}>
          <ArrowLeftIcon className="icone" aria-hidden="true" />
          Todos os exercícios
        </a>
      </div>
    );
  }

  // A `key` faz cada abertura montar uma tela nova, e com ela uma sessão de
  // métricas nova — inclusive ao reabrir o mesmo exercício. O nível de andaime
  // entra na chave porque é parâmetro da sessão: trocá-lo na URL começa outra
  // sessão, em vez de continuar a anterior sob outro apoio.
  return (
    <TelaExercicio
      key={`${exercicio.id}:${rota.andaime}`}
      exercicio={exercicio}
      andaime={rota.andaime}
      proximo={proximoDoCatalogo(exercicio.id)}
    />
  );
}
