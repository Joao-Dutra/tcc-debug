import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { supabaseConfigurado } from '../supabase/cliente';
import { sair } from '../supabase/identidade';
import {
  lerEstadoDaColeta,
  lerMeusExercicios,
  lerTodosOsPublicados,
  mudarInterruptor,
  retirar,
} from '../supabase/exercicios-de-professor';
import { EditorDeExercicio } from './EditorDeExercicio';
import { EntradaDoProfessor } from './EntradaDoProfessor';
import { estadoDaArea } from './estado-da-area';
import { useIdentidade } from './usar-identidade';
import { CAMINHO_INICIAL, caminhoDaPrevia } from './usar-rota';
import type {
  EstadoDaColeta,
  ExercicioDeProfessor,
  SituacaoDoExercicio,
} from '../supabase/exercicios-de-professor';
import type { Identidade } from '../supabase/identidade';
import type { RascunhoDeExercicio } from '../nucleo/verificacao-do-exercicio';

/**
 * A área do professor (D29, D31, D33).
 *
 * Entrar não concede nada: o perfil nasce como participante, e o papel de
 * professor é dado à mão, no banco — é o que garante que só pessoas
 * selecionadas escrevam exercícios. Por isso a tela tem quatro estados, e o de
 * quem entrou sem o papel diz com clareza que aguarda liberação, em vez de
 * mostrar uma área vazia que pareceria defeito.
 *
 * Desde D33 o professor publica e retira os próprios exercícios, sem revisão
 * no meio. O pesquisador entra aqui também: não escreve nem publica, mas mexe
 * no interruptor da coleta e retira qualquer publicado, como freio de
 * emergência.
 *
 * A tela escolhe o que mostrar pelo papel lido de `perfis`, mas não é ela que
 * protege nada: uma interface adulterada fingindo o papel esbarra no RLS e no
 * gatilho da 0003.
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
  // Não aparece mais: a 0003 devolveu os que havia a rascunho (D33).
  em_revisao: 'Em revisão',
  publicado: 'Publicado',
  retirado: 'Retirado',
};

const quando = (iso: string | null) =>
  iso === null
    ? '—'
    : new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * O estado do interruptor da coleta (D33). Na dúvida — leitura em curso, ou
 * falhando —, oculto: a visão dos publicados também esconde quando não sabe,
 * e o aviso precisa dizer o que o aluno de fato vê.
 */
function useEstadoDaColeta() {
  const [estado, setEstado] = useState<EstadoDaColeta | null | 'lendo'>('lendo');
  const [leitura, setLeitura] = useState(0);
  useEffect(() => {
    let valida = true;
    lerEstadoDaColeta()
      .then((lido) => valida && setEstado(lido))
      .catch(() => valida && setEstado(null));
    return () => {
      valida = false;
    };
  }, [leitura]);
  const recarregar = useCallback(() => setLeitura((n) => n + 1), []);
  const ocultos = estado === 'lendo' || estado === null || estado.propostosOcultos;
  return { estado, ocultos, recarregar };
}

/**
 * Com a seção oculta, o professor publica e o exercício não aparece na vitrine.
 * Sem este aviso, ele suporia que a publicação falhou.
 */
function AvisoDaSecaoOculta() {
  return (
    <section className="aviso-da-coleta" role="status" aria-labelledby="aviso-da-coleta">
      <h2 id="aviso-da-coleta">A seção dos propostos está oculta aos alunos</h2>
      <p>
        Durante a coleta de dados da pesquisa, a seção “Propostos por professores” fica fora da
        vitrine dos alunos, para todos verem a mesma vitrine do começo ao fim do estudo. Você
        escreve, verifica e publica normalmente: o que for publicado fica guardado, e aparece
        para os alunos quando a seção voltar. Para ver um exercício como o aluno verá, use{' '}
        <strong>Ver como o aluno veria</strong>.
      </p>
    </section>
  );
}

/** Abre a pré-visualização em outra aba: a lista fica onde estava. */
function LinkDaPrevia({ id }: { id: string }) {
  return (
    <a className="discreto" href={caminhoDaPrevia(id)} target="_blank" rel="noopener">
      Ver como o aluno veria
    </a>
  );
}

/** O que a situação quer dizer para quem escreveu o exercício. */
function oQueAcontece(e: ExercicioDeProfessor, ocultos: boolean): string | null {
  if (e.situacao === 'publicado') {
    return ocultos
      ? `Publicado em ${quando(e.publicadoEm)}. Fica oculto aos alunos enquanto a seção ` +
          'estiver oculta. Não muda mais; para corrigir, crie um rascunho a partir dele e ' +
          'retire este.'
      : `Publicado em ${quando(e.publicadoEm)}: os alunos o veem na vitrine. Não muda mais; ` +
          'para corrigir, crie um rascunho a partir dele e retire este.';
  }
  if (e.situacao === 'retirado') {
    const quem = e.retiradoPor === e.autorId ? 'por você' : 'pela equipe da pesquisa';
    return (
      `Retirado ${quem} em ${quando(e.retiradoEm)}. Continua guardado, porque pode haver ` +
      'sessões de alunos nele.'
    );
  }
  return null;
}

type Aberto =
  | { tipo: 'novo'; inicial: RascunhoDeExercicio | null }
  | { tipo: 'rascunho'; exercicio: ExercicioDeProfessor };

/** Os exercícios do professor, por situação, e o editor quando um está aberto. */
function ExerciciosDoProfessor({ autorId }: { autorId: string }) {
  const coleta = useEstadoDaColeta();
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
        propostosOcultos={coleta.ocultos}
        aoFechar={(mudou) => {
          setAberto(null);
          if (mudou) setLeitura((n) => n + 1);
        }}
      />
    );
  }

  const retirarProprio = async (e: ExercicioDeProfessor) => {
    const confirmado = window.confirm(
      `Retirar "${e.conteudo.titulo}"? Ele sai da vitrine dos alunos e não volta: para ` +
        'publicar de novo, crie um rascunho a partir dele.'
    );
    if (!confirmado) return;
    try {
      await retirar(e.id);
      setLeitura((n) => n + 1);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    }
  };

  if (erro) return <p className="erro">A leitura dos seus exercícios falhou ({erro}).</p>;
  if (exercicios === null) return <p className="rodape-painel">Lendo os seus exercícios…</p>;

  return (
    <>
      {coleta.ocultos && <AvisoDaSecaoOculta />}
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
                {e.situacao === 'rascunho' && (
                  <button
                    className="discreto"
                    onClick={() => setAberto({ tipo: 'rascunho', exercicio: e })}
                  >
                    Editar
                  </button>
                )}
                {e.situacao === 'publicado' && (
                  <>
                    <LinkDaPrevia id={e.id} />
                    <button className="discreto perigo" onClick={() => void retirarProprio(e)}>
                      Retirar
                    </button>
                  </>
                )}
                {(e.situacao === 'publicado' || e.situacao === 'retirado') && (
                  <button
                    className="discreto"
                    onClick={() => setAberto({ tipo: 'novo', inicial: e.conteudo })}
                  >
                    Criar rascunho a partir deste
                  </button>
                )}
                {e.situacao === 'rascunho' && e.comentarioDaRevisao && (
                  <span className="comentario-da-revisao">
                    Devolvido pela antiga revisão: {e.comentarioDaRevisao}
                  </span>
                )}
                {oQueAcontece(e, coleta.ocultos) && (
                  <span className="comentario-da-revisao">{oQueAcontece(e, coleta.ocultos)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * O que o pesquisador faz aqui (D33): o interruptor da coleta e o freio de
 * emergência. Não escreve, não publica e não edita exercício de ninguém — o
 * RLS e o gatilho da 0003 recusariam de qualquer jeito.
 */
function PainelDoPesquisador() {
  const coleta = useEstadoDaColeta();
  const [publicados, setPublicados] = useState<ExercicioDeProfessor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [leitura, setLeitura] = useState(0);
  const [mudando, setMudando] = useState(false);

  useEffect(() => {
    let valida = true;
    lerTodosOsPublicados()
      .then((lidos) => valida && setPublicados(lidos))
      .catch((e: unknown) => valida && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      valida = false;
    };
  }, [leitura]);

  const alternar = async (ocultar: boolean) => {
    const confirmado = window.confirm(
      ocultar
        ? 'Ocultar a seção dos propostos? Nenhum exercício de professor chega mais aos alunos, ' +
            'nem pelo link direto, até ela voltar.'
        : 'Mostrar a seção dos propostos aos alunos? Durante uma coleta, isto muda a vitrine ' +
            'dos participantes no meio do estudo.'
    );
    if (!confirmado) return;
    setMudando(true);
    try {
      await mudarInterruptor(ocultar);
      coleta.recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setMudando(false);
    }
  };

  const retirarPublicado = async (e: ExercicioDeProfessor) => {
    const confirmado = window.confirm(
      `Retirar "${e.conteudo.titulo}" da vitrine? É o freio de emergência: o exercício não ` +
        'volta, e o autor vê que foi retirado pela equipe da pesquisa.'
    );
    if (!confirmado) return;
    try {
      await retirar(e.id);
      setLeitura((n) => n + 1);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    }
  };

  const { estado } = coleta;
  return (
    <>
      <section className="painel interruptor-da-coleta" aria-labelledby="titulo-do-interruptor">
        <h2 id="titulo-do-interruptor">Interruptor da coleta</h2>
        {estado === 'lendo' ? (
          <p className="rodape-painel">Lendo o estado…</p>
        ) : estado === null ? (
          <p className="erro">
            O estado do interruptor não pôde ser lido — a migração 0003 rodou? Enquanto isso, a
            seção dos propostos fica oculta aos alunos.
          </p>
        ) : (
          <>
            <p className="estado-do-interruptor">
              {estado.propostosOcultos
                ? 'A seção “Propostos por professores” está oculta aos alunos.'
                : 'A seção “Propostos por professores” está visível aos alunos.'}{' '}
              <span className="rodape-painel">Desde {quando(estado.alteradoEm)}.</span>
            </p>
            <p className="rodape-painel">
              Oculta, ela não chega a aluno nenhum — o banco não a entrega. Os professores
              continuam publicando, e veem um aviso de que a seção está oculta.
            </p>
            <button
              className={estado.propostosOcultos ? undefined : 'primario'}
              disabled={mudando}
              onClick={() => void alternar(!estado.propostosOcultos)}
            >
              {estado.propostosOcultos ? 'Mostrar a seção aos alunos' : 'Ocultar a seção dos alunos'}
            </button>
          </>
        )}
      </section>

      <section className="painel" aria-labelledby="titulo-dos-publicados">
        <h2 id="titulo-dos-publicados">Publicados pelos professores</h2>
        <p className="rodape-painel">
          A publicação é do próprio autor, depois da verificação automática. Aqui você só retira:
          é o freio de emergência, para um exercício com erro ou conteúdo inadequado.
        </p>
        {erro && <p className="erro">{erro}</p>}
        {publicados === null ? (
          !erro && <p className="rodape-painel">Lendo os publicados…</p>
        ) : publicados.length === 0 ? (
          <p className="rodape-painel">Nenhum exercício publicado.</p>
        ) : (
          <ul className="lista-de-exercicios">
            {publicados.map((e) => (
              <li key={e.id}>
                <span className="titulo-do-exercicio">{e.conteudo.titulo || 'Sem título'}</span>
                <LinkDaPrevia id={e.id} />
                <button className="discreto perigo" onClick={() => void retirarPublicado(e)}>
                  Retirar
                </button>
                <span className="comentario-da-revisao">
                  Publicado em {quando(e.publicadoEm)} pela conta {e.autorId.slice(0, 8)}.
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
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
        <PainelDoPesquisador />
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
