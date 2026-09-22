import { Fragment, useState } from 'react';
import {
  estadoDoEnvio,
  estadoDoEspelho,
  exportarMetricas,
  limparArquivo,
  sessoesArquivadas,
} from '../nucleo/metricas';
import { baixarMetricas } from './usar-metricas';
import { useIdentidade } from './usar-identidade';
import type { Identidade } from '../supabase/identidade';
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

/**
 * Como a pessoa está identificada (D21), em uma linha.
 *
 * É informação de conferência, do pesquisador: serve para saber, antes de
 * começar a sessão, se o aparelho está gravando sob identidade e sob qual.
 * Exportada para poder ser verificada sem navegador.
 */
export function descreverIdentidade(identidade: Identidade): string {
  const papel = identidade.papel ?? 'papel não lido';
  switch (identidade.forma) {
    case 'nenhuma':
      return 'sem identidade — as sessões ficam só neste aparelho';
    case 'anonima':
      return `anônima · ${identidade.usuarioId} · ${papel}`;
    case 'google':
      return `Google · ${identidade.email ?? identidade.usuarioId} · ${papel}`;
    case 'email':
      return `e-mail · ${identidade.email ?? identidade.usuarioId} · ${papel}`;
  }
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
  const espelho = estadoDoEspelho();
  const envio = estadoDoEnvio();
  const identidade = useIdentidade();
  const [aberta, setAberta] = useState<string | null>(null);
  // O arquivo mora fora do React; depois de limpá-lo, a tela precisa redesenhar.
  const [, redesenhar] = useState(0);

  // A mesma máquina serve a vários participantes (D15). Apagar é irreversível e
  // é dado de pesquisa, então pede confirmação e lembra de exportar antes.
  const limpar = () => {
    const confirmado = window.confirm(
      `Apagar as ${sessoes.length} sessões guardadas neste navegador? ` +
        (envio.pendentes > 0
          ? `${envio.pendentes} delas ainda não chegaram ao banco e se perdem. `
          : '') +
        'Isto não pode ser desfeito: exporte antes, se ainda não exportou.'
    );
    if (!confirmado) return;
    limparArquivo();
    setAberta(null);
    redesenhar((n) => n + 1);
  };

  return (
    <div className="pagina">
      <header>
        <h1>Métricas das sessões</h1>
        <p>
          Sessões guardadas neste navegador, inclusive as de cargas anteriores da
          página. Ficam até serem apagadas aqui: entre um participante e outro,
          exporte e depois limpe.
        </p>
      </header>

      {!espelho.ativo && (
        <p className="erro">
          O armazenamento do navegador não está ligado: as sessões se perdem ao
          recarregar a página.
        </p>
      )}
      {espelho.falhaDeGravacao && (
        <p className="erro">
          O navegador recusou a última gravação ({espelho.falhaDeGravacao}). As
          sessões seguem na memória desta página: exporte antes de recarregar.
        </p>
      )}
      {espelho.avisoDeLeitura && (
        <p className="erro">Ao iniciar, {espelho.avisoDeLeitura}.</p>
      )}

      <p className="rodape-painel">
        Identidade: {descreverIdentidade(identidade)}
        {envio.ativo
          ? ` · banco ligado · ${envio.pendentes} sessão(ões) por enviar`
          : ' · banco desligado nesta instalação'}
      </p>
      {identidade.falha && (
        <p className="erro">A identificação falhou ({identidade.falha}).</p>
      )}
      {envio.ultimaFalha && (
        <p className="erro">
          O último envio ao banco falhou ({envio.ultimaFalha}). As sessões
          seguem neste aparelho e serão reenviadas; exporte antes de limpar.
        </p>
      )}

      <section className="painel">
        <div className="cabecalho-painel">
          <h2>Sessões ({sessoes.length})</h2>
          <div className="acoes-painel">
            <button onClick={() => baixarMetricas(exportarMetricas(), 'metricas.json')}>
              Exportar métricas (JSON)
            </button>
            <button
              className="perigo"
              onClick={limpar}
              disabled={sessoes.length === 0 && espelho.avisoDeLeitura === null}
            >
              Limpar sessões deste navegador
            </button>
          </div>
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
