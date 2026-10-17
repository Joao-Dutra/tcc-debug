import { catalogo, proximoDoCatalogo } from './exercicios/catalogo';
import { AberturaDoProposto } from './componentes/AberturaDoProposto';
import { AreaDoEstudo } from './componentes/AreaDoEstudo';
import { AreaDoProfessor } from './componentes/AreaDoProfessor';
import { ConferenciaDoEstudo } from './componentes/ConferenciaDoEstudo';
import { PainelDeMetricas } from './componentes/PainelDeMetricas';
import { PreviaComoAluno } from './componentes/PreviaComoAluno';
import { TelaExercicio } from './componentes/TelaExercicio';
import { TelaDeEntrada } from './componentes/TelaDeEntrada';
import { TelaInicial } from './componentes/TelaInicial';
import { VitrineDeExercicios } from './componentes/VitrineDeExercicios';
import { useRota } from './componentes/usar-rota';

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
  if (rota.tela === 'entrar') return <TelaDeEntrada />;
  if (rota.tela === 'exercicios') return <VitrineDeExercicios />;

  // Rota do pesquisador (D11). Nenhuma tela do participante aponta para ela.
  if (rota.tela === 'metricas') return <PainelDeMetricas />;

  // Área do professor (D29, D31), com entrada própria na tela inicial.
  if (rota.tela === 'autoria') return <AreaDoProfessor />;

  // A área do estudo (D37), fora da navegação. A chave faz outro código
  // começar outro percurso, em vez de herdar o estado do anterior.
  if (rota.tela === 'estudo') return <AreaDoEstudo key={rota.aplicacao} aplicacao={rota.aplicacao} />;
  if (rota.tela === 'conferir') return <ConferenciaDoEstudo aplicacao={rota.aplicacao} />;

  // O exercício de um professor como o aluno o verá, sem gravar sessão (D33).
  if (rota.tela === 'previa') {
    return <PreviaComoAluno key={`${rota.id}:${rota.andaime}`} id={rota.id} andaime={rota.andaime} />;
  }

  const exercicio = catalogo.find((e) => e.id === rota.id);

  // Fora do catálogo, pode ser um proposto por professor (D31).
  if (!exercicio) return <AberturaDoProposto id={rota.id} andaime={rota.andaime} />;

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
