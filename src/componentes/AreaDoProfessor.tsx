import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { supabaseConfigurado } from '../supabase/cliente';
import { sair } from '../supabase/identidade';
import { lerMeusExercicios } from '../supabase/exercicios-de-professor';
import { EditorDeExercicio } from './EditorDeExercicio';
import { EntradaDoProfessor } from './EntradaDoProfessor';
import { estadoDaArea } from './estado-da-area';
import { useIdentidade } from './usar-identidade';
import { CAMINHO_INICIAL, CAMINHO_REVISAO } from './usar-rota';
import type { ExercicioDeProfessor, SituacaoDoExercicio } from '../supabase/exercicios-de-professor';
import type { Identidade } from '../supabase/identidade';
import type { RascunhoDeExercicio } from '../nucleo/verificacao-do-exercicio';

/**
 * A área do professor (D29, D31).
 *
 * Entrar não concede nada: o perfil nasce como participante, e o papel de
 * professor é dado à mão, no banco — é o que garante que só pessoas
 * selecionadas escrevam exercícios. Por isso a tela tem quatro estados, e o de
 * quem entrou sem o papel diz com clareza que aguarda liberação, em vez de
 * mostrar uma área vazia que pareceria defeito.
 *
 * A tela escolhe o que mostrar pelo papel lido de `perfis`, mas não é ela que
 * protege nada: uma interface adulterada fingindo o papel esbarra no RLS ao
 * tentar criar o primeiro rascunho.
 */

function Moldura({ children, identidade }: { children: ReactNode; identidade?: Identidade }) {
  const comConta = identidade && (identidade.forma === 'google' || identidade.forma === 'email');
  return (
    <div className="pagina autoria">
      <header>
        <a className="voltar" href={CAMINHO_INICIAL}>
          <ArrowLeftIcon className="icone" aria-hidden="true" />
          Início
        </a>
        <h1>Área do professor</h1>
        {comConta && (
          <div className="conta-aberta">
            <p className="rodape-painel">
              Conta: {identidade.email ?? identidade.usuarioId}. Enquanto ela estiver aberta, o
              que for feito como aluno neste navegador é gravado sob ela — saia antes de
              entregar o aparelho a um aluno.
            </p>
            <button onClick={() => void sair()}>Sair</button>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

const ROTULOS_DA_SITUACAO: Record<SituacaoDoExercicio, string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  publicado: 'Publicado',
  retirado: 'Retirado',
};

/** O que a situação quer dizer para quem escreveu o exercício. */
const O_QUE_ACONTECE: Record<Exclude<SituacaoDoExercicio, 'rascunho'>, string> = {
  em_revisao: 'Enviado. Aguarda a revisão, e não muda mais até ser publicado ou devolvido.',
  publicado: 'Publicado: os alunos o veem na vitrine. Não muda mais; para corrigir, crie um rascunho a partir dele.',
  retirado: 'Retirado da vitrine. Continua guardado, porque há sessões de alunos nele.',
};

type Aberto =
  | { tipo: 'novo'; inicial: RascunhoDeExercicio | null }
  | { tipo: 'rascunho'; exercicio: ExercicioDeProfessor };

/** Os exercícios do professor, por situação, e o editor quando um está aberto. */
function ExerciciosDoProfessor({ autorId }: { autorId: string }) {
  const [exercicios, setExercicios] = useState<ExercicioDeProfessor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [leitura, setLeitura] = useState(0);

  useEffect(() => {
    let valida = true;
    lerMeusExercicios(autorId)
      .then((lidos) => valida && setExercicios(lidos))
      .catch((e: unknown) => valida && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      valida = false;
    };
  }, [autorId, leitura]);

  if (aberto) {
    return (
      <EditorDeExercicio
        // Chave nova a cada abertura: o editor começa do que foi aberto, e
        // não do que ficou de outro exercício.
        key={aberto.tipo === 'rascunho' ? aberto.exercicio.id : 'novo'}
        id={aberto.tipo === 'rascunho' ? aberto.exercicio.id : null}
        inicial={aberto.tipo === 'rascunho' ? aberto.exercicio.conteudo : aberto.inicial}
        aoFechar={(mudou) => {
          setAberto(null);
          if (mudou) setLeitura((n) => n + 1);
        }}
      />
    );
  }

  if (erro) return <p className="erro">A leitura dos seus exercícios falhou ({erro}).</p>;
  if (exercicios === null) return <p className="rodape-painel">Lendo os seus exercícios…</p>;

  return (
    <section className="painel">
      <div className="cabecalho-painel">
        <h2>Seus exercícios</h2>
        <button className="primario" onClick={() => setAberto({ tipo: 'novo', inicial: null })}>
          Novo exercício
        </button>
      </div>
      {exercicios.length === 0 ? (
        <p className="rodape-painel">Você ainda não escreveu nenhum exercício.</p>
      ) : (
        <ul className="lista-de-exercicios">
          {exercicios.map((e) => (
            <li key={e.id}>
              <span className={`situacao ${e.situacao}`}>{ROTULOS_DA_SITUACAO[e.situacao]}</span>
              <span className="titulo-do-exercicio">{e.conteudo.titulo || 'Sem título'}</span>
              {e.situacao === 'rascunho' ? (
                <button
                  className="discreto"
                  onClick={() => setAberto({ tipo: 'rascunho', exercicio: e })}
                >
                  Editar
                </button>
              ) : (
                (e.situacao === 'publicado' || e.situacao === 'retirado') && (
                  <button
                    className="discreto"
                    onClick={() => setAberto({ tipo: 'novo', inicial: e.conteudo })}
                  >
                    Criar rascunho a partir deste
                  </button>
                )
              )}
              {e.situacao === 'rascunho' && e.comentarioDaRevisao && (
                <span className="comentario-da-revisao">
                  Devolvido pela revisão: {e.comentarioDaRevisao}
                </span>
              )}
              {e.situacao !== 'rascunho' && (
                <span className="comentario-da-revisao">{O_QUE_ACONTECE[e.situacao]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AreaDoProfessor() {
  const identidade = useIdentidade();
  const estado = estadoDaArea(identidade, supabaseConfigurado());

  if (estado === 'sem-banco') {
    return (
      <Moldura>
        <p className="rodape-painel">
          A área do professor guarda os exercícios no banco, e o banco não está configurado
          nesta instalação.
        </p>
      </Moldura>
    );
  }

  if (estado === 'entrar') {
    // Anônimo, ou sem identidade ainda. A falha da entrada anônima não impede
    // nada aqui: o professor entra na conta dele.
    return (
      <Moldura>
        <section className="painel">
          <h2>Entrar</h2>
          <p className="rodape-painel">
            A área é para professores convidados. Qualquer pessoa pode entrar, mas a conta só
            passa a escrever exercícios depois de liberada pela equipe da pesquisa.
          </p>
          <EntradaDoProfessor />
        </section>
      </Moldura>
    );
  }

  if (estado === 'conferindo') {
    return (
      <Moldura identidade={identidade}>
        <p className="rodape-painel">Conferindo o papel desta conta…</p>
      </Moldura>
    );
  }

  if (estado === 'professor') {
    return (
      <Moldura identidade={identidade}>
        <ExerciciosDoProfessor autorId={identidade.usuarioId as string} />
      </Moldura>
    );
  }

  if (estado === 'pesquisador') {
    return (
      <Moldura identidade={identidade}>
        <section className="painel">
          <h2>Esta conta é de pesquisador</h2>
          <p className="rodape-painel">
            O pesquisador revisa e publica os exercícios dos professores, mas não os escreve
            por aqui: os exercícios da pesquisa ficam no catálogo, no repositório, com a suíte
            de testes inteira.
          </p>
          <p>
            <a className="botao" href={CAMINHO_REVISAO}>
              Ir para a revisão
            </a>
          </p>
        </section>
      </Moldura>
    );
  }

  return (
    <Moldura identidade={identidade}>
      <section className="painel aguardando-liberacao" role="status">
        <h2>Aguardando liberação</h2>
        <p>
          A sua conta foi criada, mas ainda não pode escrever exercícios. A liberação é feita
          pela equipe da pesquisa, uma conta de cada vez, para que só professores convidados
          criem exercícios para os alunos.
        </p>
        <p className="rodape-painel">
          Quando a sua conta for liberada, recarregue esta página.
        </p>
      </section>
    </Moldura>
  );
}
