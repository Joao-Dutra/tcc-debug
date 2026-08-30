import { Fragment, useState } from 'react';
import { exportarMetricas, sessoesArquivadas } from '../nucleo/metricas';
import { baixarMetricas } from './usar-metricas';
import type { Evento, RegistroDeSessao, ResumoDaSessao } from '../nucleo/metricas';

/**
 * Painel de inspeção das sessões arquivadas (D11).
 *
 * É instrumento do pesquisador, não do participante: existe para conferir,
 * durante o piloto, se a coleta está saindo correta — um defeito de
 * instrumentação descoberto depois do experimento não tem remédio.
 *
 * Todos os números vêm de `resumo`, que é calculado por `resumirSessao` a
 * partir do log (D6). Este componente formata e exibe; não recalcula nada.
 */

/** Exportada para poder ser verificada sem navegador. */
export function duracao(ms: number | null): string {
  if (ms === null) return '—';
  const segundos = Math.round(ms / 1000);
  if (segundos < 60) return `${segundos} s`;
  return `${Math.floor(segundos / 60)} min ${String(segundos % 60).padStart(2, '0')} s`;
}

/**
 * Composto a partir de campos que já vêm do resumo — nunca relido do log.
 * Separar "localizou mas não corrigiu" de "em aberto" é o que mostra, de
 * relance, em qual das duas etapas a sessão parou.
 */
function desfecho(resumo: ResumoDaSessao): string {
  if (resumo.corrigido) return 'corrigido';
  if (resumo.tempoAteLocalizacaoMs !== null) return 'localizou, sem corrigir';
  return 'em aberto';
}

/** Exportada para poder ser verificada sem navegador. */
export function descreverEvento(evento: Evento): string {
  switch (evento.tipo) {
    case 'execucao':
      return [
        `execução (${evento.origem})`,
        `${evento.casosPassaram}/${evento.casosTotal} casos`,
        evento.erro ? `erro: ${evento.erro}` : null,
      ]
        .filter((p) => p !== null)
        .join(' · ');
    case 'edicao':
      return `edição · ${evento.codigo.length} caracteres`;
    case 'dica':
      return `dica ${evento.indice + 1} revelada`;
    case 'localizacao':
      return `localização · linha ${evento.linha} · ${evento.correta ? 'correta' : 'incorreta'}`;
  }
}

function Sequencia({ sessao }: { sessao: RegistroDeSessao }) {
  return (
    <div className="sequencia">
      <p className="rodape-painel">
        sessão {sessao.id} · início {sessao.instanteDeInicio} · {sessao.eventos.length} eventos
        · {sessao.resumo.edicoes} edições · {sessao.resumo.execucoesComErro} execuções com erro
      </p>
      <ol className="eventos">
        {sessao.eventos.map((evento, i) => (
          <li key={i}>
            <span className="carimbo">{duracao(evento.t)}</span>
            {descreverEvento(evento)}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PainelDeMetricas() {
  const sessoes = sessoesArquivadas();
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="pagina">
      <header>
        <h1>Métricas das sessões</h1>
        <p>
          Sessões arquivadas desde que a página carregou. Recarregar a página apaga
          tudo o que não tiver sido exportado.
        </p>
      </header>

      <section className="painel">
        <div className="cabecalho-painel">
          <h2>Sessões ({sessoes.length})</h2>
          <button onClick={() => baixarMetricas(exportarMetricas(), 'metricas.json')}>
            Exportar métricas (JSON)
          </button>
        </div>

        {sessoes.length === 0 ? (
          <p className="rodape-painel">Nenhuma sessão arquivada.</p>
        ) : (
          <div className="rolagem">
            <table className="tabela-metricas">
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>Andaime</th>
                  <th>Duração</th>
                  <th>1ª execução</th>
                  <th>Localização</th>
                  <th>Correção</th>
                  <th>Execuções</th>
                  <th>Dicas</th>
                  <th>Tentativas</th>
                  <th>Desfecho</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessoes.map((sessao) => {
                  const r = sessao.resumo;
                  const estaAberta = aberta === sessao.id;
                  return (
                    <Fragment key={sessao.id}>
                      <tr>
                        <td>{sessao.exercicioId}</td>
                        <td>{sessao.andaime ?? 'não registrado'}</td>
                        <td>{duracao(sessao.duracaoTotalMs)}</td>
                        <td>{duracao(r.tempoAtePrimeiraExecucaoMs)}</td>
                        <td>{duracao(r.tempoAteLocalizacaoMs)}</td>
                        <td>{duracao(r.tempoAteCorrecaoMs)}</td>
                        <td>{r.execucoes}</td>
                        <td>{r.dicasReveladas}</td>
                        <td>{r.localizacoesTentadas}</td>
                        <td>{desfecho(r)}</td>
                        <td>
                          <button
                            className="discreto"
                            onClick={() => setAberta(estaAberta ? null : sessao.id)}
                          >
                            {estaAberta ? 'fechar' : 'eventos'}
                          </button>
                        </td>
                      </tr>
                      {estaAberta && (
                        <tr>
                          <td colSpan={11}>
                            <Sequencia sessao={sessao} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
