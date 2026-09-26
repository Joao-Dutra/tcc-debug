import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { proximoEm } from '../exercicios/catalogo';
import { TelaExercicio } from './TelaExercicio';
import { useExerciciosPublicados } from './usar-exercicios-publicados';
import { CAMINHO_EXERCICIOS } from './usar-rota';
import type { NivelDeAndaime } from './andaime';

/**
 * A abertura de um exercício que não está no catálogo: um proposto por
 * professor e publicado (D31), procurado pelo identificador do banco.
 *
 * Sem banco, ou com um identificador que não é de nenhum publicado, é a mesma
 * página de "não encontrado" de sempre. Se a leitura falhou, a página diz que
 * falhou, e não que o exercício não existe: o aluno que recebeu o link tentaria
 * de novo, e não desistiria achando o link errado.
 */

function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="pagina">
      <header>
        <h1>{titulo}</h1>
        <p>{children}</p>
      </header>
      <a className="voltar" href={CAMINHO_EXERCICIOS}>
        <ArrowLeftIcon className="icone" aria-hidden="true" />
        Todos os exercícios
      </a>
    </div>
  );
}

export function AberturaDoProposto({ id, andaime }: { id: string; andaime: NivelDeAndaime }) {
  const publicados = useExerciciosPublicados();

  if (publicados.estado === 'lendo') {
    return (
      <div className="pagina">
        <p className="rodape-painel" role="status">
          Abrindo o exercício…
        </p>
      </div>
    );
  }

  if (publicados.estado === 'falhou') {
    return (
      <Aviso titulo="O exercício não abriu">
        A leitura do exercício falhou, provavelmente por uma falha de conexão. Tente abrir o link
        de novo em alguns instantes.
      </Aviso>
    );
  }

  const exercicio = publicados.exercicios.find((e) => e.id === id);
  if (!exercicio) {
    return (
      <Aviso titulo="Exercício não encontrado">
        Nenhum exercício tem o identificador <code>{id}</code>.
      </Aviso>
    );
  }

  // A mesma chave do catálogo: cada abertura, e cada nível de apoio, é uma
  // sessão nova.
  return (
    <TelaExercicio
      key={`${exercicio.id}:${andaime}`}
      exercicio={exercicio}
      andaime={andaime}
      proximo={proximoEm(publicados.exercicios, exercicio.id)}
    />
  );
}
