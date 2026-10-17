import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { catalogo } from '../exercicios/catalogo';
import { AVISO, VERSAO_DO_AVISO } from '../estudo/aviso';
import {
  ETAPAS,
  abrirEtapa,
  comecarPercurso,
  concluirQuestionario,
  continuarDepoisDoTempo,
  encerrarEtapa,
  entrarComGrupo,
  marcaDaEtapa,
  rotuloDaEtapa,
  ultimaEtapa,
} from '../estudo/percurso';
import type { EstadoDoPercurso } from '../estudo/percurso';
import { PERGUNTAS_DO_PERFIL, perfilCompleto } from '../estudo/perfil';
import type { PerfilDoParticipante, PerfilEmAndamento } from '../estudo/perfil';
import { exportarSessoes, pendentesDe, sessoesArquivadas, sincronizarPendentes } from '../nucleo/metricas';
import { supabaseConfigurado } from '../supabase/cliente';
import { entrarNoEstudo, gravarRespostas, situacaoDaAplicacao, trocarPorAnonimaNova } from '../supabase/estudo';
import type { SituacaoDaAplicacao } from '../supabase/estudo';
import { identidadeAtual, sair } from '../supabase/identidade';
import { Cabecalho } from './Cabecalho';
import { QUESTIONARIO } from '../estudo/questionario';
import { QuestionarioDoEstudo } from './QuestionarioDoEstudo';
import { TelaExercicio } from './TelaExercicio';
import {
  esquecerPercurso,
  grupoNoAparelho,
  guardarPercurso,
  guardarRespostasNoAparelho,
  lerPercurso,
} from './percurso-guardado';
import { useIdentidade } from './usar-identidade';
import { baixarMetricas } from './usar-metricas';

/**
 * A área do estudo (D37): `#/estudo/<codigo>`, fora da navegação.
 *
 * Um percurso guiado e fixo — aviso com consentimento, perfil, aquecimento
 * com o tutorial, cinco exercícios, questionário e o fim —, que envolve a tela de exercício
 * sem mudar o miolo dela. O que o percurso decide mora em `src/estudo/`; aqui
 * fica só a passagem de uma tela para outra.
 *
 * Com o banco configurado, entrar exige o banco: sem ele não há grupo
 * balanceado, nem como juntar as sessões de uma pessoa ao questionário dela.
 * Sem chaves — em desenvolvimento e nos testes —, o percurso roda com o grupo
 * escolhido no aparelho, marcado como tal em cada sessão.
 */

/** Quando a etapa abre, o prazo começa; se já venceu, nem abre. */
function comPrazo(estado: EstadoDoPercurso, agora: number): EstadoDoPercurso {
  if (estado.passo.tela !== 'exercicio') return estado;
  const aberto = abrirEtapa(estado, estado.passo.etapa, agora);
  const prazo = aberto.prazos[estado.passo.etapa]!;
  // Quem recarrega a página depois do prazo vai direto à tela do tempo
  // esgotado, sem abrir uma sessão que nasceria vencida.
  return prazo <= agora ? encerrarEtapa(aberto, estado.passo.etapa, 'tempo-esgotado') : aberto;
}

function TelaDoEstudo({
  rotulo,
  titulo,
  children,
}: {
  rotulo?: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="pagina area-do-estudo com-cabecalho">
      <Cabecalho
        semSaida
        navegacao={rotulo && <span className="posicao-no-percurso">{rotulo}</span>}
        titulo={titulo}
      />
      <main className="corpo-do-estudo">{children}</main>
    </div>
  );
}

const FALHA_DO_BANCO = 'Não foi possível falar com o servidor do estudo. Chame o pesquisador.';

function AvisoDoEstudo({
  aplicacao,
  comBanco,
  aoComecar,
}: {
  aplicacao: string;
  comBanco: boolean;
  aoComecar: (participanteId: string | null) => void;
}) {
  const identidade = useIdentidade();
  const [situacao, setSituacao] = useState<SituacaoDaAplicacao | 'conferindo' | 'falhou'>(
    comBanco ? 'conferindo' : 'aberta'
  );
  const [tentativa, setTentativa] = useState(0);
  const [concordo, setConcordo] = useState(false);
  const [comecando, setComecando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    if (!comBanco) return;
    let valendo = true;
    setSituacao('conferindo');
    situacaoDaAplicacao(aplicacao)
      .then((s) => valendo && setSituacao(s))
      .catch(() => valendo && setSituacao('falhou'));
    return () => {
      valendo = false;
    };
  }, [aplicacao, comBanco, tentativa]);

  if (situacao === 'conferindo') {
    return (
      <TelaDoEstudo titulo={AVISO.titulo}>
        <p className="rodape-painel" role="status">
          Preparando o estudo…
        </p>
      </TelaDoEstudo>
    );
  }
  if (situacao === 'falhou') {
    return (
      <TelaDoEstudo titulo="O estudo não abriu">
        <p className="erro">{FALHA_DO_BANCO}</p>
        <button onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button>
      </TelaDoEstudo>
    );
  }
  if (situacao === 'inexistente') {
    return (
      <TelaDoEstudo titulo="Estudo não encontrado">
        <p>
          Nenhuma aplicação do estudo tem o código <code>{aplicacao}</code>. Confira o endereço com o
          pesquisador.
        </p>
      </TelaDoEstudo>
    );
  }
  if (situacao === 'encerrada') {
    return (
      <TelaDoEstudo titulo="Estudo encerrado">
        <p>Esta aplicação do estudo já foi encerrada e não recebe mais participantes.</p>
      </TelaDoEstudo>
    );
  }

  // A identidade do aparelho precisa ter chegado antes da troca: trocar no
  // meio da entrada anônima da abertura deixaria duas idas à rede disputando
  // qual identidade fica.
  const identidadePronta = !comBanco || identidade.usuarioId !== null || identidade.falha !== null;

  const comecar = async (evento: FormEvent) => {
    evento.preventDefault();
    setComecando(true);
    setFalha(null);
    try {
      aoComecar(comBanco ? await trocarPorAnonimaNova() : null);
    } catch {
      setFalha(FALHA_DO_BANCO);
      setComecando(false);
    }
  };

  return (
    <TelaDoEstudo titulo={AVISO.titulo}>
      <form className="aviso-do-estudo" onSubmit={(e) => void comecar(e)}>
        {AVISO.paragrafos.map((p) => (
          <p key={p}>{p}</p>
        ))}
        {!comBanco && (
          <p className="rodape-painel">
            Instalação sem banco: o grupo é escolhido neste aparelho, e os dados ficam só nele.
          </p>
        )}
        {/* Quem não marca não entra: o botão só se libera com a caixa. */}
        <label className="concordo">
          <input type="checkbox" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} />
          {AVISO.concordo}
        </label>
        {falha && <p className="erro">{falha}</p>}
        <button className="primario" type="submit" disabled={!concordo || !identidadePronta || comecando}>
          {comecando ? 'Preparando…' : AVISO.comecar}
          <ArrowRightIcon className="icone" aria-hidden="true" />
        </button>
      </form>
    </TelaDoEstudo>
  );
}

function PerfilDoEstudo({ aoConfirmar }: { aoConfirmar: (perfil: PerfilDoParticipante) => Promise<void> }) {
  const [perfil, setPerfil] = useState<PerfilEmAndamento>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const confirmar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!perfilCompleto(perfil)) return;
    setEnviando(true);
    setFalha(null);
    try {
      await aoConfirmar(perfil);
    } catch {
      // A entrada é idempotente no banco: tentar de novo não ocupa outra vaga.
      setFalha('Não foi possível entrar no estudo. Tente de novo ou chame o pesquisador.');
      setEnviando(false);
    }
  };

  return (
    <TelaDoEstudo titulo="Sobre você">
      <form className="perfil-do-estudo" onSubmit={(e) => void confirmar(e)}>
        <p>Três perguntas rápidas. Nenhuma delas identifica você.</p>
        {PERGUNTAS_DO_PERFIL.map((p) => (
          <fieldset key={p.campo}>
            <legend>{p.pergunta}</legend>
            {p.opcoes.map((o) => (
              <label key={o.valor}>
                <input
                  type="radio"
                  name={p.campo}
                  value={o.valor}
                  checked={perfil[p.campo] === o.valor}
                  onChange={() => setPerfil((atual) => ({ ...atual, [p.campo]: o.valor }))}
                />
                {o.rotulo}
              </label>
            ))}
          </fieldset>
        ))}
        {falha && <p className="erro">{falha}</p>}
        <button className="primario" type="submit" disabled={!perfilCompleto(perfil) || enviando}>
          {enviando ? 'Entrando…' : 'Continuar'}
          <ArrowRightIcon className="icone" aria-hidden="true" />
        </button>
      </form>
    </TelaDoEstudo>
  );
}

/**
 * Quanto o agradecimento espera antes de cada nova tentativa de subir o que
 * ficou pendente. A primeira é na chegada; depois destas, a tela chama o
 * pesquisador. Curtas de propósito: o participante está parado esperando.
 */
const ESPERAS_DO_ENVIO_FINAL_MS = [2_000, 5_000];

type EnvioFinal = 'enviando' | 'pronto' | 'pendente';

/**
 * Sobe o que ficou pendente do participante e, só com a fila dele vazia,
 * troca a identidade do aparelho. Devolve quantas sessões dele ficaram.
 */
async function enviarETrocar(participanteId: string): Promise<number> {
  await sincronizarPendentes();
  const restantes = pendentesDe(participanteId);
  if (restantes === 0 && identidadeAtual().usuarioId === participanteId) await sair();
  return restantes;
}

/**
 * O fim do percurso. Nenhum resultado: nem quantos exercícios foram
 * corrigidos, nem tempo, nem comparação — o participante que soubesse o
 * próprio desempenho poderia contá-lo ao colega do lado, que ainda está no
 * meio.
 *
 * Ao chegar aqui, o que ficou pendente sobe, e o aparelho troca de identidade
 * para o uso seguinte deste navegador não cair no participante. A troca só
 * acontece com a fila do participante vazia: depois dela, a identidade
 * anterior não volta, e o RLS recusaria a sessão dela subindo pela nova. Se a
 * fila não esvazia depois de algumas tentativas, a tela pede o pesquisador, e
 * ele resolve ali mesmo: tenta de novo, ou exporta o JSON do aparelho.
 */
function Agradecimento({ aplicacao, participanteId }: { aplicacao: string; participanteId: string | null }) {
  // Sem banco não há fila nem troca: a coleta é só do aparelho.
  const [envio, setEnvio] = useState<EnvioFinal>(participanteId === null ? 'pronto' : 'enviando');
  const [restantes, setRestantes] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  // Uma rodada por tentativa, mesmo com o efeito rodando duas vezes no StrictMode.
  const rodada = useRef(-1);

  useEffect(() => {
    if (participanteId === null || rodada.current === tentativa) return;
    rodada.current = tentativa;
    // A rodada da chegada insiste sozinha; a do botão é uma tentativa só.
    const esperas = tentativa === 0 ? ESPERAS_DO_ENVIO_FINAL_MS : [];
    void (async () => {
      setEnvio('enviando');
      let faltam = await enviarETrocar(participanteId);
      for (const espera of esperas) {
        if (faltam === 0) break;
        await new Promise((pronto) => window.setTimeout(pronto, espera));
        faltam = await enviarETrocar(participanteId);
      }
      setRestantes(faltam);
      setEnvio(faltam === 0 ? 'pronto' : 'pendente');
    })();
  }, [participanteId, tentativa]);

  const exportar = () =>
    baixarMetricas(exportarSessoes(sessoesArquivadas()), `metricas-aparelho-${aplicacao}.json`);

  return (
    <TelaDoEstudo titulo="Obrigado pela participação">
      {envio === 'enviando' && (
        <p role="status">Enviando as suas respostas. Não feche esta página ainda.</p>
      )}
      {envio === 'pronto' && <p>As suas respostas foram registradas. Você já pode fechar esta página.</p>}
      {envio === 'pendente' && (
        <div className="envio-pendente">
          <p className="erro">
            Parte do que você fez ainda não chegou ao servidor do estudo. Não feche esta página: chame o
            pesquisador.
          </p>
          {/* Para o pesquisador: a identidade fica a do participante até a fila esvaziar. */}
          <p className="rodape-painel">
            {restantes === 1
              ? '1 sessão deste participante está só neste aparelho.'
              : `${restantes} sessões deste participante estão só neste aparelho.`}{' '}
            A identidade não foi trocada.
          </p>
          <div className="acoes-do-envio">
            <button className="primario" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </button>
            <button onClick={exportar}>Exportar JSON local</button>
          </div>
        </div>
      )}
    </TelaDoEstudo>
  );
}

export function AreaDoEstudo({ aplicacao }: { aplicacao: string }) {
  const comBanco = supabaseConfigurado();
  const identidade = useIdentidade();
  const [estado, setEstado] = useState<EstadoDoPercurso | null>(() => {
    const guardado = lerPercurso(aplicacao);
    return guardado && comPrazo(guardado, Date.now());
  });
  // Com banco, o percurso guardado vale só para a identidade que o começou. A
  // identidade chega depois da primeira tela, e até lá a conferência espera.
  const [conferindo, setConferindo] = useState(() => comBanco && estado?.participanteId != null);

  const mudar = (novo: EstadoDoPercurso | null) => {
    const comPrazoAberto = novo && comPrazo(novo, Date.now());
    if (comPrazoAberto) guardarPercurso(comPrazoAberto);
    else esquecerPercurso();
    setEstado(comPrazoAberto);
  };

  useEffect(() => {
    if (!conferindo) return;
    if (identidade.usuarioId === null && identidade.falha === null) return;
    if (identidade.usuarioId !== estado?.participanteId) {
      esquecerPercurso();
      setEstado(null);
    }
    setConferindo(false);
  }, [conferindo, identidade, estado]);

  // O fim esquece o percurso guardado: recarregar a página depois dele abre o
  // aviso, para o próximo participante, e não o agradecimento de outro.
  const noFim = estado?.passo.tela === 'agradecimento';
  useEffect(() => {
    if (noFim) esquecerPercurso();
  }, [noFim]);

  if (conferindo) {
    return (
      <TelaDoEstudo titulo={AVISO.titulo}>
        <p className="rodape-painel" role="status">
          Retomando o estudo…
        </p>
      </TelaDoEstudo>
    );
  }

  if (estado === null) {
    return (
      <AvisoDoEstudo
        aplicacao={aplicacao}
        comBanco={comBanco}
        aoComecar={(participanteId) => mudar(comecarPercurso(aplicacao, VERSAO_DO_AVISO, participanteId))}
      />
    );
  }

  const { passo } = estado;

  if (passo.tela === 'perfil') {
    return (
      <PerfilDoEstudo
        aoConfirmar={async (perfil) => {
          if (!comBanco) {
            mudar(entrarComGrupo(estado, grupoNoAparelho(), true));
            return;
          }
          const { grupo } = await entrarNoEstudo(aplicacao, estado.versaoDoAviso, perfil);
          mudar(entrarComGrupo(estado, grupo, false));
        }}
      />
    );
  }

  if (passo.tela === 'tempo-esgotado') {
    const ultimo = ultimaEtapa(passo.etapa);
    return (
      <TelaDoEstudo rotulo={rotuloDaEtapa(passo.etapa)} titulo="O tempo deste exercício terminou">
        <p>{ultimo ? 'Este era o último exercício.' : 'Vamos para o próximo.'}</p>
        <button className="primario" autoFocus onClick={() => mudar(continuarDepoisDoTempo(estado))}>
          {ultimo ? 'Concluir' : 'Continuar'}
          <ArrowRightIcon className="icone" aria-hidden="true" />
        </button>
      </TelaDoEstudo>
    );
  }

  if (passo.tela === 'questionario') {
    return (
      <TelaDoEstudo titulo={QUESTIONARIO.titulo}>
        <QuestionarioDoEstudo
          aoEnviar={async (resposta) => {
            if (comBanco) {
              // "Já gravada" também segue: é o reenvio de quem recarregou a
              // página antes de a confirmação chegar.
              await gravarRespostas(aplicacao, resposta);
            } else {
              guardarRespostasNoAparelho({
                ...resposta,
                aplicacao,
                grupoNoAparelho: estado.grupo,
                respondidoEm: new Date().toISOString(),
              });
            }
            mudar(concluirQuestionario(estado));
          }}
        />
      </TelaDoEstudo>
    );
  }

  if (passo.tela === 'agradecimento') {
    return <Agradecimento aplicacao={aplicacao} participanteId={estado.participanteId} />;
  }

  const etapa = ETAPAS[passo.etapa];
  // O teste do percurso garante que toda etapa está no catálogo.
  const exercicio = catalogo.find((e) => e.id === etapa.exercicioId)!;
  const andaime = etapa.apoio[estado.grupo!];

  return (
    <TelaExercicio
      // Cada etapa é uma sessão nova, e recarregar a página na mesma etapa
      // também: a anterior foi arquivada ao sair (D15).
      key={`estudo:${passo.etapa}`}
      exercicio={exercicio}
      andaime={andaime}
      percurso={{
        rotulo: rotuloDaEtapa(passo.etapa),
        ultimo: ultimaEtapa(passo.etapa),
        sessao: { marca: marcaDaEtapa(estado, passo.etapa), participanteId: estado.participanteId },
        prazo: estado.prazos[passo.etapa]!,
        abrirTutorial: etapa.aquecimento,
        aoEncerrar: (motivo) => mudar(encerrarEtapa(estado, passo.etapa, motivo)),
      }}
    />
  );
}
