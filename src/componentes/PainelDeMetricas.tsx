import { Fragment, useEffect, useState } from 'react';
import {
  SEM_FILTRO,
  estadoDoEnvio,
  estadoDoEspelho,
  exportarSessoes,
  filtrarSessoes,
  limparArquivo,
  origemDe,
  sessaoValida,
  sessoesArquivadas,
} from '../nucleo/metricas';
import {
  LIMIAR_DE_OCIOSIDADE_MS,
  duracaoAtivaMs,
  intervalosOciosos,
  varreduraDe,
} from '../nucleo/sinais-de-sessao';
import { supabaseConfigurado } from '../supabase/cliente';
import { sair } from '../supabase/identidade';
import { EntradaDoPesquisador } from './EntradaDoPesquisador';
import { baixarMetricas } from './usar-metricas';
import { useIdentidade } from './usar-identidade';
import { useSessoesDoBanco } from './usar-sessoes-do-banco';
import type { Identidade } from '../supabase/identidade';
import type {
  Evento,
  FiltroDeSessoes,
  RegistroDeSessao,
  ResumoDaSessao,
} from '../nucleo/metricas';
import type { IntervaloOcioso, Varredura } from '../nucleo/sinais-de-sessao';

/**
 * Painel de inspeção das sessões (D11, D22).
 *
 * É instrumento do pesquisador, não do participante: existe para conferir se a
 * coleta está saindo correta — um defeito de instrumentação descoberto depois
 * do experimento não tem remédio — e para recortar o que vai para a análise.
 *
 * Duas origens. Com pesquisador autenticado, lê do banco as sessões de todos
 * os participantes. Sem ele, mostra o que está neste aparelho, como antes: é o
 * que mantém o painel útil em desenvolvimento e sem rede. Quem restringe a
 * leitura do banco é o RLS, e não esta escolha — uma identidade que não seja
 * de pesquisador, fazendo a mesma consulta, recebe só as próprias sessões.
 *
 * Todos os números vêm do núcleo: o `resumo`, calculado por `resumirSessao` a
 * partir do log (D6), e os sinais, lidos do log por `sinais-de-sessao` (D25).
 * Este componente formata e exibe; não calcula nada.
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

/**
 * O começo do uid basta para distinguir participantes numa tabela de
 * conferência; o uid inteiro fica no título da célula e vai na exportação.
 */
function participanteCurto(id: string | null): string {
  return id === null ? 'sem identidade' : id.slice(0, 8);
}

/** Valores distintos de um campo, em ordem, sem os ausentes. */
function opcoesDe(
  sessoes: RegistroDeSessao[],
  campo: (sessao: RegistroDeSessao) => string | null
): string[] {
  const valores = new Set<string>();
  for (const sessao of sessoes) {
    const valor = campo(sessao);
    if (valor !== null) valores.add(valor);
  }
  return [...valores].sort();
}

/** Exportada para poder ser verificada sem navegador. */
export function descreverEvento(evento: Evento): string {
  switch (evento.tipo) {
    case 'execucao':
      // Sem resultado não há casos a contar, e "0/0 casos" leria como se a
      // execução tivesse terminado sem teste nenhum.
      if (evento.situacao === 'interrompida') {
        return `execução (${evento.origem}) · interrompida antes do resultado`;
      }
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
    case 'localizacao-no-intervalo':
      return `clique na linha ${evento.linha} durante o intervalo · sem veredito`;
  }
}

/**
 * O sinal de varredura por extenso (D25). O sinal aponta a sessão para o
 * pesquisador olhar a sequência; a frase diz o que olhar nela.
 */
function descreverVarredura(varredura: Varredura): string {
  const forma =
    varredura.forma === 'ordenada' ? 'em linhas vizinhas, no mesmo sentido' : 'em rajada';
  return (
    `${varredura.tentativas} tentativas seguidas, da linha ${varredura.primeiraLinha} à ` +
    `${varredura.ultimaLinha}, em ${duracao(varredura.duracaoMs)}, ${forma}, sem executar, ` +
    'editar nem abrir dica entre elas'
  );
}

/** Os silêncios longos por extenso (D26): o maior e onde começa, para achá-lo na sequência. */
function descreverOciosidade(ociosos: IntervaloOcioso[]): string {
  const extensao = (o: IntervaloOcioso) => o.ateMs - o.deMs;
  const maior = ociosos.reduce((a, b) => (extensao(b) > extensao(a) ? b : a));
  const onde = `de ${duracao(extensao(maior))}, a partir de ${duracao(maior.deMs)}`;
  return ociosos.length === 1
    ? `um silêncio sem evento nenhum ${onde}; fica fora da duração ativa`
    : `${ociosos.length} silêncios de mais de ${duracao(LIMIAR_DE_OCIOSIDADE_MS)} sem evento ` +
        `nenhum, o maior ${onde}; ficam fora da duração ativa`;
}

/** Os sinais da sessão, lidos do log na hora (D25, D26): nada disto está gravado. */
function Sinais({ sessao }: { sessao: RegistroDeSessao }) {
  const varredura = varreduraDe(sessao.eventos);
  const ociosos = intervalosOciosos(sessao);
  if (!varredura && ociosos.length === 0) return <>—</>;
  return (
    <span className="sinais">
      {varredura && (
        <span className="sinal" title={descreverVarredura(varredura)}>
          varredura
        </span>
      )}
      {ociosos.length > 0 && (
        <span className="sinal" title={descreverOciosidade(ociosos)}>
          ociosa
        </span>
      )}
    </span>
  );
}

function Sequencia({ sessao }: { sessao: RegistroDeSessao }) {
  const varredura = varreduraDe(sessao.eventos);
  const ociosos = intervalosOciosos(sessao);
  return (
    <div className="sequencia">
      <p className="rodape-painel">
        sessão {sessao.id} · início {sessao.instanteDeInicio} · {sessao.eventos.length} eventos
        · {sessao.resumo.edicoes} edições · {sessao.resumo.execucoesComErro} execuções com erro
      </p>
      {varredura && (
        <p className="rodape-painel">Varredura: {descreverVarredura(varredura)}.</p>
      )}
      {ociosos.length > 0 && (
        <p className="rodape-painel">Ociosidade: {descreverOciosidade(ociosos)}.</p>
      )}
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

const ROTULOS_DO_FILTRO = {
  participanteId: 'Participante',
  exercicioId: 'Exercício',
  origemDoExercicio: 'Origem',
  andaime: 'Apoio',
} as const;

type CampoDoFiltro = keyof typeof ROTULOS_DO_FILTRO;
const CAMPOS_DO_FILTRO = Object.keys(ROTULOS_DO_FILTRO) as CampoDoFiltro[];

function Filtros({
  sessoes,
  filtro,
  mudar,
}: {
  sessoes: RegistroDeSessao[];
  filtro: FiltroDeSessoes;
  mudar: (filtro: FiltroDeSessoes) => void;
}) {
  // As opções saem das sessões da origem, e não do catálogo: filtrar por um
  // exercício que ninguém abriu só produziria tabela vazia.
  const opcoes: Record<CampoDoFiltro, string[]> = {
    participanteId: opcoesDe(sessoes, (s) => s.participanteId),
    exercicioId: opcoesDe(sessoes, (s) => s.exercicioId),
    origemDoExercicio: opcoesDe(sessoes, (s) => origemDe(s)),
    andaime: opcoesDe(sessoes, (s) => s.andaime),
  };

  return (
    <div className="filtros-painel">
      {CAMPOS_DO_FILTRO.map((campo) => (
        <label key={campo}>
          {ROTULOS_DO_FILTRO[campo]}
          <select
            value={filtro[campo] ?? ''}
            onChange={(e) => mudar({ ...filtro, [campo]: e.target.value || null })}
          >
            <option value="">todos</option>
            {opcoes[campo].map((valor) => (
              <option key={valor} value={valor}>
                {campo === 'participanteId' ? participanteCurto(valor) : valor}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="marcar">
        <input
          type="checkbox"
          checked={filtro.apenasValidas}
          onChange={(e) => mudar({ ...filtro, apenasValidas: e.target.checked })}
        />
        Só sessões válidas (ao menos uma execução do estudante)
      </label>
    </div>
  );
}

export function PainelDeMetricas() {
  const identidade = useIdentidade();
  const pesquisador = identidade.papel === 'pesquisador';
  const banco = useSessoesDoBanco(pesquisador);
  const origem = pesquisador ? 'banco' : 'aparelho';

  const espelho = estadoDoEspelho();
  const envio = estadoDoEnvio();
  const doAparelho = sessoesArquivadas();
  const todas = pesquisador ? (banco.sessoes ?? []) : doAparelho;

  const [filtro, setFiltro] = useState<FiltroDeSessoes>(SEM_FILTRO);
  const [aberta, setAberta] = useState<string | null>(null);
  // O arquivo mora fora do React; depois de limpá-lo, a tela precisa redesenhar.
  const [, redesenhar] = useState(0);

  // Relê o arquivo logo depois de montar. Vindo direto de um exercício, o
  // React desenha o painel ANTES de a tela do exercício desmontar e arquivar
  // o retrato final da sessão: a primeira leitura sai velha — sem a última
  // execução, e portanto com a contagem de válidas errada.
  useEffect(() => redesenhar((n) => n + 1), []);

  // Trocar de origem é trocar de conjunto: um participante escolhido entre as
  // sessões do aparelho pode não existir no banco, e o filtro velho mostraria
  // uma tabela vazia sem dizer por quê.
  useEffect(() => {
    setFiltro(SEM_FILTRO);
    setAberta(null);
  }, [origem]);

  const sessoes = filtrarSessoes(todas, filtro);
  const validas = todas.filter(sessaoValida).length;

  // A exportação é do que está na tela, e diz de onde veio e que recorte foi
  // aplicado: um arquivo filtrado sem essa anotação seria lido depois como a
  // coleta inteira.
  const exportar = () =>
    baixarMetricas(
      exportarSessoes(sessoes, { origem, filtro, totalNaOrigem: todas.length }),
      `metricas-${origem}.json`
    );

  // A mesma máquina serve a vários participantes (D15). Apagar é irreversível e
  // é dado de pesquisa, então pede confirmação e lembra de exportar antes.
  const limpar = () => {
    const confirmado = window.confirm(
      `Apagar as ${doAparelho.length} sessões guardadas neste navegador? ` +
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

  const contaSemPapel =
    (identidade.forma === 'email' || identidade.forma === 'google') &&
    identidade.papel !== null &&
    !pesquisador;

  return (
    <div className="pagina">
      <header>
        <h1>Métricas das sessões</h1>
        {pesquisador ? (
          <p>
            Sessões de todos os participantes, lidas do banco. Os filtros
            recortam a tabela e a exportação; nada é apagado.
          </p>
        ) : (
          <p>
            Sessões guardadas neste navegador, inclusive as de cargas anteriores da
            página. Ficam até serem apagadas aqui: entre um participante e outro,
            exporte e depois limpe.
          </p>
        )}
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

      {supabaseConfigurado() && (
        <section className="painel">
          {pesquisador || contaSemPapel ? (
            <div className="cabecalho-painel">
              <p className="rodape-painel">
                {pesquisador
                  ? 'Enquanto esta conta estiver aberta, as sessões feitas neste navegador são gravadas sob ela. Saia antes de entregar o aparelho a um participante.'
                  : 'Esta conta não tem o papel de pesquisador: o painel mostra só o que está neste aparelho.'}
              </p>
              <button onClick={() => void sair()}>Sair</button>
            </div>
          ) : (
            <EntradaDoPesquisador />
          )}
        </section>
      )}

      {pesquisador && banco.erro && (
        <p className="erro">A leitura do banco falhou ({banco.erro}).</p>
      )}

      <section className="painel">
        <div className="cabecalho-painel">
          <h2>
            Sessões ({sessoes.length} de {todas.length} · {validas} válidas)
          </h2>
          <div className="acoes-painel">
            {pesquisador && (
              <button onClick={banco.recarregar} disabled={banco.carregando}>
                {banco.carregando ? 'Lendo…' : 'Recarregar do banco'}
              </button>
            )}
            <button onClick={exportar} disabled={sessoes.length === 0}>
              Exportar o que está na tela (JSON)
            </button>
            {/* Limpar é do aparelho. Na leitura do banco o botão não aparece:
                apagaria outra coisa que não o que está na tela. */}
            {!pesquisador && (
              <button
                className="perigo"
                onClick={limpar}
                disabled={doAparelho.length === 0 && espelho.avisoDeLeitura === null}
              >
                Limpar sessões deste navegador
              </button>
            )}
          </div>
        </div>

        <Filtros sessoes={todas} filtro={filtro} mudar={setFiltro} />

        {sessoes.length === 0 ? (
          <p className="rodape-painel">
            {todas.length > 0
              ? 'Nenhuma sessão atende ao filtro.'
              : pesquisador && banco.carregando
                ? 'Lendo as sessões do banco…'
                : 'Nenhuma sessão.'}
          </p>
        ) : (
          <div className="rolagem">
            <table className="tabela-metricas">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Exercício</th>
                  <th>Origem</th>
                  <th>Andaime</th>
                  <th>Válida</th>
                  <th>Sinais</th>
                  <th>Duração</th>
                  <th title="Sem os silêncios de mais de cinco minutos sem evento nenhum (D26)">
                    Ativa
                  </th>
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
                        <td title={sessao.participanteId ?? undefined}>
                          {participanteCurto(sessao.participanteId)}
                        </td>
                        <td>{sessao.exercicioId}</td>
                        <td>{origemDe(sessao)}</td>
                        <td>{sessao.andaime ?? 'não registrado'}</td>
                        <td>{sessaoValida(sessao) ? 'sim' : 'não'}</td>
                        <td>
                          <Sinais sessao={sessao} />
                        </td>
                        <td>{duracao(sessao.duracaoTotalMs)}</td>
                        <td>{duracao(duracaoAtivaMs(sessao))}</td>
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
                          <td colSpan={16}>
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
