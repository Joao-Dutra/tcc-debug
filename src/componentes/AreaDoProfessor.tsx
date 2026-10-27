import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftIcon, QuestionMarkCircleIcon } from '@heroicons/react/20/solid';
import { supabaseConfigurado } from '../supabase/cliente';
import { sair } from '../supabase/identidade';
import { lerMeusExercicios, retirar } from '../supabase/exercicios-de-professor';
import {
  FreioDosPublicados,
  InterruptorDaColeta,
  LinkDaPrevia,
  quando,
  useEstadoDaColeta,
} from './ControlesDaColeta';
import { EditorDeExercicio } from './EditorDeExercicio';
import { EntradaDoProfessor } from './EntradaDoProfessor';
import { estadoDaArea } from './estado-da-area';
import { armazenamentoDaAba, esquecerAberto, lerAberto } from './rascunho-na-aba';
import { TutorialDoProfessor } from './TutorialDoProfessor';
import { marcarTutorialDoProfessorVisto, tutorialDoProfessorJaVisto } from './tutorial-visto';
import { useIdentidade } from './usar-identidade';
import { CAMINHO_CONTROLE, CAMINHO_INICIAL } from './usar-rota';
import type {
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
  const [tutorialAberto, setTutorialAberto] = useState(false);

  // O tutorial abre sozinho para quem ainda não tem exercício nenhum, uma vez
  // por aparelho; depois, pelo botão de ajuda (D33).
  useEffect(() => {
    if (exercicios?.length === 0 && !tutorialDoProfessorJaVisto()) {
      marcarTutorialDoProfessorVisto();
      setTutorialAberto(true);
    }
  }, [exercicios]);

  useEffect(() => {
    let valida = true;
    lerMeusExercicios(autorId)
      .then((lidos) => valida && setExercicios(lidos))
      .catch((e: unknown) => valida && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      valida = false;
    };
  }, [autorId, leitura]);

  // Um recarregamento com o editor aberto volta a ele, e o editor recupera o
  // texto da aba (rascunho-na-aba). Só uma vez, na primeira leitura: depois,
  // quem decide o que está aberto é o professor. O rascunho que já não está na
  // lista como rascunho — publicado, apagado em outra aba — não reabre.
  const reabriu = useRef(false);
  useEffect(() => {
    if (reabriu.current || exercicios === null) return;
    reabriu.current = true;
    const aba = armazenamentoDaAba();
    const estava = lerAberto(aba, autorId);
    if (estava === undefined) return;
    if (estava === null) {
      setAberto({ tipo: 'novo', inicial: null });
      return;
    }
    const exercicio = exercicios.find((e) => e.id === estava && e.situacao === 'rascunho');
    if (exercicio) setAberto({ tipo: 'rascunho', exercicio });
    else esquecerAberto(aba, autorId);
  }, [exercicios, autorId]);

  const tutorial = (
    <TutorialDoProfessor
      aberto={tutorialAberto}
      aoFechar={(desfecho) => {
        setTutorialAberto(false);
        // Concluído pelo último botão, "Escrever a atividade": o editor abre.
        if (desfecho === 'concluido' && !aberto) setAberto({ tipo: 'novo', inicial: null });
      }}
    />
  );

  if (aberto) {
    return (
      <>
      {tutorial}
      <EditorDeExercicio
        // Chave nova a cada abertura: o editor começa do que foi aberto, e
        // não do que ficou de outro exercício.
        key={aberto.tipo === 'rascunho' ? aberto.exercicio.id : 'novo'}
        id={aberto.tipo === 'rascunho' ? aberto.exercicio.id : null}
        autorId={autorId}
        inicial={aberto.tipo === 'rascunho' ? aberto.exercicio.conteudo : aberto.inicial}
        propostosOcultos={coleta.ocultos}
        aoFechar={(mudou) => {
          esquecerAberto(armazenamentoDaAba(), autorId);
          setAberto(null);
          if (mudou) setLeitura((n) => n + 1);
        }}
      />
      </>
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
      {tutorial}
      {coleta.ocultos && <AvisoDaSecaoOculta />}
      <section className="painel">
        <div className="cabecalho-painel">
          <h2>Seus exercícios</h2>
          <span className="acoes-painel">
            <button className="ajuda" onClick={() => setTutorialAberto(true)}>
              <QuestionMarkCircleIcon className="icone" aria-hidden="true" />
              Como criar uma atividade
            </button>
            <button className="primario" onClick={() => setAberto({ tipo: 'novo', inicial: null })}>
              Novo exercício
            </button>
          </span>
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
 * RLS e o gatilho da 0003 recusariam de qualquer jeito. Os dois controles são
 * os mesmos do painel de controle (D38), e o resto do painel fica lá.
 */
function PainelDoPesquisador() {
  return (
    <>
      <p className="rodape-painel">
        As aplicações do estudo, o mapa de rotas e a auditoria ficam no{' '}
        <a href={CAMINHO_CONTROLE}>painel de controle</a>.
      </p>
      <InterruptorDaColeta />
      <FreioDosPublicados />
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
