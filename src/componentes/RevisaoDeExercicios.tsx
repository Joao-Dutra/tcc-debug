import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { executar } from '../nucleo/executor';
import { conferirRelatorioGravado } from '../nucleo/relatorio-gravado';
import { exercicioDoRascunho, verificarExercicio } from '../nucleo/verificacao-do-exercicio';
import { supabaseConfigurado } from '../supabase/cliente';
import {
  devolver,
  lerExerciciosDaRevisao,
  publicar,
  rascunhoDoConteudo,
  retirar,
} from '../supabase/exercicios-de-professor';
import { sair } from '../supabase/identidade';
import { complexidadeDe } from './complexidade';
import { EntradaDoPesquisador } from './EntradaDoPesquisador';
import { estadoDaArea } from './estado-da-area';
import { CATEGORIAS, ESTRUTURAS } from './formulario-do-exercicio';
import { publicacaoLiberada } from './liberacoes-da-autoria';
import { PreviaDoExercicio } from './PreviaDoExercicio';
import { RelatorioDeVerificacao } from './RelatorioDeVerificacao';
import { useIdentidade } from './usar-identidade';
import { CAMINHO_INICIAL } from './usar-rota';
import type { ConferenciaDoRelatorio } from '../nucleo/relatorio-gravado';
import type { RelatorioDaVerificacao } from '../nucleo/verificacao-do-exercicio';
import type { ExercicioDeProfessor } from '../supabase/exercicios-de-professor';
import type { Identidade } from '../supabase/identidade';

/**
 * A revisão dos exercícios de professor, pelo pesquisador (D31).
 *
 * A regra desta tela: **a publicação depende só da verificação refeita aqui.**
 * O relatório gravado junto do envio foi escrito pelo navegador do professor,
 * e um acesso direto à API grava o que quiser naquela coluna. Ele aparece como
 * referência do que o professor viu, e a tela diz em voz alta quando ele
 * diverge do refeito — mas o botão de publicar não o consulta.
 *
 * O que se publica é exatamente o que foi verificado: o conteúdo lido na
 * abertura, o mesmo que foi à verificação. O professor não altera um exercício
 * em revisão (o RLS só o deixa mexer em rascunho), e mesmo que alterasse, a
 * publicação gravaria por cima a versão que passou aqui.
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
        <h1>Revisão dos exercícios</h1>
        {comConta && (
          <div className="conta-aberta">
            <p className="rodape-painel">Conta: {identidade.email ?? identidade.usuarioId}.</p>
            <button onClick={() => void sair()}>Sair</button>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

const quando = (iso: string | null) =>
  iso === null
    ? '—'
    : new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const rotuloDaEstrutura = (valor: string) =>
  ESTRUTURAS.find((e) => e.valor === valor)?.rotulo ?? valor;
const rotuloDaCategoria = (valor: string) =>
  CATEGORIAS.find((c) => c.valor === valor)?.rotulo ?? valor;

/** O código com o número de cada linha, que é como a localização é declarada. */
function CodigoNumerado({ codigo }: { codigo: string }) {
  return (
    <pre className="codigo-numerado">
      {codigo.split('\n').map((linha, i) => (
        <span key={i} className="linha-numerada">
          <span className="numero-da-linha" aria-hidden="true">
            {i + 1}
          </span>
          {linha}
          {'\n'}
        </span>
      ))}
    </pre>
  );
}

/** O que o professor escreveu, para o pesquisador ler antes de decidir. */
function ConteudoParaLer({ exercicio }: { exercicio: ExercicioDeProfessor }) {
  const c = exercicio.conteudo;
  return (
    <>
      <dl className="dados-do-exercicio">
        <dt>Estrutura</dt>
        <dd>{rotuloDaEstrutura(c.estrutura)}</dd>
        <dt>Complexidade</dt>
        <dd>{complexidadeDe(c.dificuldade).termo}</dd>
        <dt>Tipo do defeito</dt>
        <dd>{rotuloDaCategoria(c.categoriaDefeito)}</dd>
        {c.estrutura === 'vetor' && (
          <>
            <dt>Marcadores</dt>
            <dd>{c.marcadores.join(', ') || '—'}</dd>
            <dt>Variáveis de valor</dt>
            <dd>{c.variaveisDeValor.join(', ') || '—'}</dd>
          </>
        )}
        <dt>Enviado em</dt>
        <dd>{quando(exercicio.enviadoEm)}</dd>
        {/* Só o identificador: o banco não guarda o e-mail em `perfis` (D29), e
            quem precisa saber quem é o encontra no painel do Supabase. */}
        <dt>Conta do autor</dt>
        <dd>
          <code>{exercicio.autorId}</code>
        </dd>
      </dl>

      <h3>Enunciado</h3>
      <p className="texto-do-exercicio">{c.enunciado}</p>

      <h3>Dicas</h3>
      <p className="rodape-painel">
        Confira que nenhuma nomeia a linha do defeito, e que crescem da atenção à propriedade.
      </p>
      <ol className="dicas-da-revisao">
        {c.dicas.map((dica, i) => (
          <li key={i}>{dica}</li>
        ))}
      </ol>

      <h3>Casos de teste</h3>
      <ul className="casos-da-revisao">
        {c.casosDeTeste.map((caso, i) => (
          <li key={i}>
            {caso.descricao}: <code>{caso.expressao}</code> deve dar{' '}
            <code>{JSON.stringify(caso.esperado)}</code>
          </li>
        ))}
      </ul>

      <div className="lado-a-lado codigos-da-revisao">
        <div>
          <h3>Código com defeito</h3>
          <CodigoNumerado codigo={c.codigoComDefeito} />
        </div>
        <div>
          <h3>Código correto</h3>
          <CodigoNumerado codigo={c.codigoCorreto} />
        </div>
      </div>
    </>
  );
}

/** O relatório gravado, só como referência, com a divergência à vista. */
function RelatorioDoProfessor({ conferencia }: { conferencia: ConferenciaDoRelatorio }) {
  if (conferencia.tipo === 'ausente') {
    return (
      <p className="sinal-de-divergencia" role="alert">
        Nenhum relatório gravado. A tela do professor não envia sem um, então este envio não
        passou por ela.
      </p>
    );
  }
  if (conferencia.tipo === 'ilegivel') {
    return (
      <p className="sinal-de-divergencia" role="alert">
        O relatório gravado não tem a forma de um relatório de verificação. Este envio não
        passou pela tela do professor, ou foi alterado depois.
      </p>
    );
  }
  return (
    <>
      {conferencia.tipo === 'diverge' ? (
        <div className="sinal-de-divergencia" role="alert">
          <p>
            O relatório gravado diverge da verificação refeita aqui. Pode ser uma versão
            anterior do verificador, ou um relatório escrito fora da tela do professor.
          </p>
          <ul>
            {conferencia.diferencas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rodape-painel">O relatório gravado diz o mesmo que a verificação refeita.</p>
      )}
      <details className="relatorio-gravado">
        <summary>Ver o relatório gravado</summary>
        <RelatorioDeVerificacao relatorio={conferencia.gravado} />
      </details>
    </>
  );
}

type Refeita =
  | { tipo: 'verificando' }
  | { tipo: 'pronta'; relatorio: RelatorioDaVerificacao }
  | { tipo: 'falhou'; erro: string };

function ExercicioEmRevisao({
  exercicio,
  aoFechar,
}: {
  exercicio: ExercicioDeProfessor;
  aoFechar: (mudou: boolean) => void;
}) {
  // Lido uma vez, na abertura: é este o conteúdo que vai à verificação e, se
  // ela aprovar, à publicação.
  const [rascunho] = useState(() => rascunhoDoConteudo(exercicio.conteudo));
  // A prévia só desenha: id e linha não entram na execução. Fixada na
  // abertura, para não executar as duas versões de novo a cada desenho da tela.
  const [previa] = useState(() =>
    exercicioDoRascunho('previa', rascunhoDoConteudo(exercicio.conteudo), {
      linhaDoDefeito: 1,
      linhasAceitas: [1],
    })
  );
  const [refeita, setRefeita] = useState<Refeita>({ tipo: 'verificando' });
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emRevisao = exercicio.situacao === 'em_revisao';

  useEffect(() => {
    if (!emRevisao) return;
    let valida = true;
    verificarExercicio(rascunho, executar)
      .then((relatorio) => valida && setRefeita({ tipo: 'pronta', relatorio }))
      .catch(
        (e: unknown) =>
          valida && setRefeita({ tipo: 'falhou', erro: e instanceof Error ? e.message : String(e) })
      );
    return () => {
      valida = false;
    };
  }, [emRevisao, rascunho]);

  const relatorio = refeita.tipo === 'pronta' ? refeita.relatorio : null;
  // Só o refeito decide. O gravado não entra nesta conta.
  const derivado = publicacaoLiberada(relatorio);

  const agir = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      aoFechar(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setOcupado(false);
    }
  };

  const aoPublicar = () => {
    if (!derivado) return;
    const confirmado = window.confirm(
      'Publicar este exercício? Ele passa a aparecer na vitrine para os alunos.\n\n' +
        'Durante uma coleta de dados, não publique: a vitrine que os participantes veem ' +
        'precisa ser a mesma do começo ao fim da coleta (D31).'
    );
    if (confirmado) void agir(() => publicar(exercicio.id, rascunho, derivado));
  };

  const aoRetirar = () => {
    const confirmado = window.confirm(
      'Retirar este exercício da vitrine? Ele continua guardado, com as sessões dos alunos, ' +
        'mas deixa de ser oferecido. Não há como publicá-lo de novo: para isso, o professor ' +
        'cria um rascunho a partir dele.'
    );
    if (confirmado) void agir(() => retirar(exercicio.id));
  };

  return (
    <section className="painel revisao-do-exercicio">
      <div className="cabecalho-painel">
        <h2>{exercicio.conteudo.titulo || 'Sem título'}</h2>
        <button className="discreto" onClick={() => aoFechar(false)}>
          Voltar à fila
        </button>
      </div>

      <ConteudoParaLer exercicio={exercicio} />

      {emRevisao && (
        <div className="bloco-do-editor">
          <h3>Verificação refeita neste navegador</h3>
          <p className="rodape-painel">
            É esta, e só esta, que decide a publicação.
          </p>
          {refeita.tipo === 'verificando' && (
            <p className="rodape-painel" role="status">
              Verificando…
            </p>
          )}
          {refeita.tipo === 'falhou' && (
            <p className="erro">A verificação não pôde ser feita ({refeita.erro}).</p>
          )}
          {relatorio && <RelatorioDeVerificacao relatorio={relatorio} />}
        </div>
      )}

      {emRevisao && relatorio && (
        <div className="bloco-do-editor">
          <h3>Relatório gravado pelo professor</h3>
          <p className="rodape-painel">
            Só referência do que o professor viu ao enviar. Foi escrito pelo navegador dele, e não
            prova nada.
          </p>
          <RelatorioDoProfessor
            conferencia={conferirRelatorioGravado(exercicio.verificacaoDoProfessor, relatorio)}
          />
        </div>
      )}

      <div className="bloco-do-editor">
        <h3>O desenho, com e sem o defeito</h3>
        <PreviaDoExercicio exercicio={previa} />
      </div>

      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}

      {emRevisao && (
        <div className="bloco-do-editor decisao-da-revisao">
          <h3>Decisão</h3>
          <div className="acoes-painel">
            <button className="primario" disabled={!derivado || ocupado} onClick={aoPublicar}>
              Publicar
            </button>
          </div>
          {relatorio && !relatorio.aprovado && (
            <p className="rodape-painel">
              Não passou na verificação refeita aqui, e por isso não pode ser publicado. Devolva
              ao professor dizendo o que corrigir.
            </p>
          )}
          <label className="comentario-para-devolver">
            Comentário para o professor
            <textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="O que precisa mudar antes de uma nova revisão"
            />
          </label>
          <div className="acoes-painel">
            <button
              disabled={comentario.trim() === '' || ocupado}
              onClick={() => void agir(() => devolver(exercicio.id, comentario.trim()))}
            >
              Devolver ao professor
            </button>
          </div>
        </div>
      )}

      {exercicio.situacao === 'publicado' && (
        <div className="bloco-do-editor decisao-da-revisao">
          <h3>Publicado em {quando(exercicio.publicadoEm)}</h3>
          <div className="acoes-painel">
            <button className="perigo" disabled={ocupado} onClick={aoRetirar}>
              Retirar da vitrine
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const GRUPOS = [
  { situacao: 'em_revisao', titulo: 'Aguardando revisão', vazio: 'Nada aguarda revisão.' },
  { situacao: 'publicado', titulo: 'Publicados', vazio: 'Nenhum exercício publicado.' },
  { situacao: 'retirado', titulo: 'Retirados', vazio: 'Nenhum exercício retirado.' },
] as const;

function FilaDaRevisao() {
  const [exercicios, setExercicios] = useState<ExercicioDeProfessor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<ExercicioDeProfessor | null>(null);
  const [leitura, setLeitura] = useState(0);

  useEffect(() => {
    let valida = true;
    lerExerciciosDaRevisao()
      .then((lidos) => valida && setExercicios(lidos))
      .catch((e: unknown) => valida && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      valida = false;
    };
  }, [leitura]);

  if (aberto) {
    return (
      <ExercicioEmRevisao
        key={aberto.id}
        exercicio={aberto}
        aoFechar={(mudou) => {
          setAberto(null);
          if (mudou) setLeitura((n) => n + 1);
        }}
      />
    );
  }

  if (erro) return <p className="erro">A leitura da fila falhou ({erro}).</p>;
  if (exercicios === null) return <p className="rodape-painel">Lendo a fila…</p>;

  return (
    <>
      {GRUPOS.map((grupo) => {
        const doGrupo = exercicios.filter((e) => e.situacao === grupo.situacao);
        return (
          <section key={grupo.situacao} className="painel">
            <h2>{grupo.titulo}</h2>
            {doGrupo.length === 0 ? (
              <p className="rodape-painel">{grupo.vazio}</p>
            ) : (
              <ul className="lista-de-exercicios">
                {doGrupo.map((e) => (
                  <li key={e.id}>
                    <span className="titulo-do-exercicio">{e.conteudo.titulo || 'Sem título'}</span>
                    <span className="rodape-painel">
                      {rotuloDaEstrutura(e.conteudo.estrutura)} · enviado em {quando(e.enviadoEm)}
                    </span>
                    <button className="discreto" onClick={() => setAberto(e)}>
                      {grupo.situacao === 'em_revisao' ? 'Revisar' : 'Abrir'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

export function RevisaoDeExercicios() {
  const identidade = useIdentidade();
  const estado = estadoDaArea(identidade, supabaseConfigurado());

  if (estado === 'sem-banco') {
    return (
      <Moldura>
        <p className="rodape-painel">
          Os exercícios de professor ficam no banco, e o banco não está configurado nesta
          instalação.
        </p>
      </Moldura>
    );
  }

  if (estado === 'entrar') {
    return (
      <Moldura>
        <EntradaDoPesquisador />
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

  if (estado === 'pesquisador') {
    return (
      <Moldura identidade={identidade}>
        <FilaDaRevisao />
      </Moldura>
    );
  }

  // Professor, ou conta ainda sem papel. A tela não protege nada — o RLS
  // devolveria só os exercícios da própria conta —, mas diz por que não há
  // fila, em vez de mostrar uma vazia.
  return (
    <Moldura identidade={identidade}>
      <section className="painel">
        <h2>Esta conta não revisa exercícios</h2>
        <p className="rodape-painel">
          A revisão é feita por contas de pesquisador. Para escrever exercícios, use a área do
          professor.
        </p>
      </section>
    </Moldura>
  );
}
