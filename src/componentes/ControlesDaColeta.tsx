import { useCallback, useEffect, useState } from 'react';
import {
  lerEstadoDaColeta,
  lerTodosOsPublicados,
  mudarInterruptor,
  retirarComoPesquisador,
} from '../supabase/exercicios-de-professor';
import type { EstadoDaColeta, ExercicioDeProfessor } from '../supabase/exercicios-de-professor';
import { confirmacaoConfere } from './controle';
import { caminhoDaPrevia } from './usar-rota';

/**
 * O interruptor da coleta e o freio de emergência (D33), na área do professor
 * e no painel de controle (D38). Um componente só, nas duas telas: o
 * pesquisador não pode encontrar o interruptor dizendo uma coisa num lugar e
 * outra no outro.
 *
 * Desde a 0005, os dois vão por funções auditadas, e não pela tabela.
 */

export const quando = (iso: string | null) =>
  iso === null
    ? '—'
    : new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * O estado do interruptor da coleta (D33). Na dúvida — leitura em curso, ou
 * falhando —, oculto: a visão dos publicados também esconde quando não sabe,
 * e o aviso precisa dizer o que o aluno de fato vê.
 */
export function useEstadoDaColeta() {
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

/** Abre a pré-visualização em outra aba: a lista fica onde estava. */
export function LinkDaPrevia({ id }: { id: string }) {
  return (
    <a className="discreto" href={caminhoDaPrevia(id)} target="_blank" rel="noopener">
      Ver como o aluno veria
    </a>
  );
}

/**
 * Mostrar e ocultar a seção dos propostos. A confirmação é a do navegador, e
 * não digitada: nada se perde, e ligar de volta desfaz.
 */
export function InterruptorDaColeta({ aoMudar }: { aoMudar?: () => void }) {
  const coleta = useEstadoDaColeta();
  const [mudando, setMudando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    setErro(null);
    try {
      await mudarInterruptor(ocultar);
      coleta.recarregar();
      aoMudar?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setMudando(false);
    }
  };

  const { estado } = coleta;
  return (
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
      {erro && <p className="erro">{erro}</p>}
    </section>
  );
}

/**
 * O que o pesquisador digita para retirar: o título, que é o nome que ele lê
 * na lista. Sem título, o id, que é o que sobra para distinguir um do outro.
 */
export function alvoDoFreio(e: ExercicioDeProfessor): string {
  return e.conteudo.titulo.trim() || e.id;
}

/**
 * O freio de emergência: o pesquisador retira qualquer publicado. A retirada
 * não volta, e por isso pede o título digitado, e não um clique de
 * confirmação. O banco não recebe o título — a função da 0005 só recebe o
 * id —: a confirmação digitada aqui é contra o clique por engano, e quem
 * protege é o papel conferido na função.
 */
export function FreioDosPublicados({ aoRetirar }: { aoRetirar?: () => void }) {
  const [publicados, setPublicados] = useState<ExercicioDeProfessor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [leitura, setLeitura] = useState(0);
  const [emConfirmacao, setEmConfirmacao] = useState<string | null>(null);
  const [digitado, setDigitado] = useState('');
  const [retirando, setRetirando] = useState(false);

  useEffect(() => {
    let valida = true;
    lerTodosOsPublicados()
      .then((lidos) => valida && setPublicados(lidos))
      .catch((e: unknown) => valida && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      valida = false;
    };
  }, [leitura]);

  const abrirConfirmacao = (id: string | null) => {
    setEmConfirmacao(id);
    setDigitado('');
    setErro(null);
  };

  const retirar = async (e: ExercicioDeProfessor) => {
    setRetirando(true);
    try {
      await retirarComoPesquisador(e.id);
      abrirConfirmacao(null);
      setLeitura((n) => n + 1);
      aoRetirar?.();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setRetirando(false);
    }
  };

  return (
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
          {publicados.map((e) => {
            const alvo = alvoDoFreio(e);
            return (
              <li key={e.id}>
                <span className="titulo-do-exercicio">{e.conteudo.titulo || 'Sem título'}</span>
                <LinkDaPrevia id={e.id} />
                <button
                  className="discreto perigo"
                  onClick={() => abrirConfirmacao(emConfirmacao === e.id ? null : e.id)}
                  aria-expanded={emConfirmacao === e.id}
                >
                  Retirar
                </button>
                <span className="comentario-da-revisao">
                  Publicado em {quando(e.publicadoEm)} pela conta {e.autorId.slice(0, 8)}.
                </span>
                {emConfirmacao === e.id && (
                  <div className="confirmacao-digitada">
                    <p className="rodape-painel">
                      O exercício sai da vitrine e não volta, e o autor vê que foi retirado pela
                      equipe da pesquisa. Para confirmar, digite <strong>{alvo}</strong>.
                    </p>
                    <label>
                      Confirmação
                      <input
                        value={digitado}
                        onChange={(ev) => setDigitado(ev.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                    <button
                      className="perigo"
                      disabled={retirando || !confirmacaoConfere(digitado, alvo)}
                      onClick={() => void retirar(e)}
                    >
                      Retirar definitivamente
                    </button>
                    <button className="discreto" onClick={() => abrirConfirmacao(null)}>
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
