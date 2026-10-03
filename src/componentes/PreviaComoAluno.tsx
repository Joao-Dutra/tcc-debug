import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { executar } from '../nucleo/executor';
import { exercicioDoRascunho, verificarExercicio } from '../nucleo/verificacao-do-exercicio';
import { supabaseConfigurado } from '../supabase/cliente';
import { lerExercicioPelaTabela, rascunhoDoConteudo } from '../supabase/exercicios-de-professor';
import { Cabecalho } from './Cabecalho';
import { estadoDaArea } from './estado-da-area';
import { TelaExercicio } from './TelaExercicio';
import { useIdentidade } from './usar-identidade';
import { CAMINHO_AUTORIA, CAMINHO_ENTRAR, caminhoDaPrevia } from './usar-rota';
import type { NivelDeAndaime } from './andaime';
import type { Exercicio } from '../nucleo/tipos';

/**
 * O exercício de um professor exatamente como o aluno o verá, nos dois níveis
 * de apoio, sem gravar sessão (D33).
 *
 * Era a tela de revisão do pesquisador (D31). A revisão deixou de ser etapa, e
 * a tela virou consulta: o autor a abre antes de publicar, e o pesquisador,
 * diante de um publicado, antes de decidir se o retira.
 *
 * A tela é a do aluno, e não uma imitação dela: o mesmo componente, em modo de
 * pré-visualização. Lê a linha pela tabela, e não pela visão dos publicados —
 * assim o autor vê o rascunho, e vê o publicado mesmo com a seção oculta aos
 * alunos pelo interruptor da coleta.
 *
 * Um rascunho ainda não tem a linha do defeito gravada: ela sai da verificação,
 * feita aqui de novo. Sem ela não haveria veredito para a linha apontada, e a
 * tela deixaria de ser a do aluno.
 */

type Leitura =
  | { estado: 'lendo' }
  | { estado: 'falhou'; motivo: string }
  | { estado: 'nao-encontrado' }
  | { estado: 'nao-verificado' }
  | { estado: 'pronto'; exercicio: Exercicio };

function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="pagina com-cabecalho">
      <Cabecalho
        navegacao={
          <a className="voltar" href={CAMINHO_AUTORIA}>
            Área do professor
          </a>
        }
        titulo={titulo}
      >
        <p>{children}</p>
      </Cabecalho>
    </div>
  );
}

export function PreviaComoAluno({ id, andaime }: { id: string; andaime: NivelDeAndaime }) {
  const identidade = useIdentidade();
  const estado = estadoDaArea(identidade, supabaseConfigurado());
  const podeLer = estado === 'professor' || estado === 'pesquisador' || estado === 'aguardando';
  const [leitura, setLeitura] = useState<Leitura>({ estado: 'lendo' });

  useEffect(() => {
    if (!podeLer) return;
    let valida = true;
    setLeitura({ estado: 'lendo' });
    void (async () => {
      try {
        const lido = await lerExercicioPelaTabela(id);
        if (!lido) {
          if (valida) setLeitura({ estado: 'nao-encontrado' });
          return;
        }
        const { conteudo } = lido;
        // Publicado e retirado já trazem a linha que a publicação gravou.
        let derivado =
          conteudo.linhaDoDefeito === undefined
            ? undefined
            : {
                linhaDoDefeito: conteudo.linhaDoDefeito,
                linhasAceitas: conteudo.linhasAceitas ?? [conteudo.linhaDoDefeito],
              };
        if (!derivado) {
          const relatorio = await verificarExercicio(rascunhoDoConteudo(conteudo), executar);
          derivado = relatorio.aprovado ? relatorio.derivado : undefined;
        }
        if (!valida) return;
        setLeitura(
          derivado
            ? { estado: 'pronto', exercicio: exercicioDoRascunho(lido.id, conteudo, derivado) }
            : { estado: 'nao-verificado' }
        );
      } catch (e) {
        if (valida) setLeitura({ estado: 'falhou', motivo: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      valida = false;
    };
  }, [id, podeLer]);

  if (estado === 'sem-banco') {
    return (
      <Aviso titulo="Pré-visualização">
        Os exercícios de professor ficam no banco, e o banco não está configurado nesta instalação.
      </Aviso>
    );
  }
  if (estado === 'entrar') {
    return (
      <Aviso titulo="Pré-visualização">
        A pré-visualização é de quem escreveu o exercício. <a href={CAMINHO_ENTRAR}>Entre</a> com a
        sua conta de professor.
      </Aviso>
    );
  }
  if (estado === 'conferindo' || leitura.estado === 'lendo') {
    return (
      <div className="pagina com-cabecalho">
        <Cabecalho />
        <p className="rodape-painel" role="status">
          Preparando a pré-visualização…
        </p>
      </div>
    );
  }
  if (leitura.estado === 'falhou') {
    return (
      <Aviso titulo="A pré-visualização não abriu">
        A leitura do exercício falhou ({leitura.motivo}). Tente de novo em alguns instantes.
      </Aviso>
    );
  }
  if (leitura.estado === 'nao-encontrado') {
    return (
      <Aviso titulo="Exercício não encontrado">
        Nenhum exercício seu tem este identificador.
      </Aviso>
    );
  }
  if (leitura.estado === 'nao-verificado') {
    return (
      <Aviso titulo="O exercício não passa na verificação">
        Sem passar na verificação, o exercício não tem a linha do defeito, e a tela do aluno não
        teria como responder a quem aponta uma linha. Volte ao editor e verifique.
      </Aviso>
    );
  }

  return (
    <TelaExercicio
      key={`${id}:${andaime}`}
      exercicio={leitura.exercicio}
      andaime={andaime}
      previa={{
        voltar: { href: CAMINHO_AUTORIA, rotulo: 'Área do professor' },
        enderecoDoNivel: (nivel) => caminhoDaPrevia(id, nivel),
      }}
    />
  );
}
