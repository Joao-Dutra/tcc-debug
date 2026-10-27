import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { catalogo } from '../exercicios/catalogo';
import { csvDoEstudo, sessoesDoEstudo } from '../estudo/exportacao';
import { supabaseConfigurado } from '../supabase/cliente';
import {
  criarAplicacao,
  definirAplicacaoAberta,
  lerAuditoria,
  limparAplicacao,
  listarAplicacoes,
  protegerAplicacao,
} from '../supabase/controle-do-pesquisador';
import type {
  AplicacaoNoPainel,
  LinhaDaAuditoria,
  ResultadoDaLimpeza,
} from '../supabase/controle-do-pesquisador';
import { lerDadosDoEstudo } from '../supabase/estudo';
import { sair } from '../supabase/identidade';
import { lerSessoesDoBanco } from '../supabase/sessoes-remotas';
import { confirmacaoConfere, mensagemDaFalha, problemaDoCodigo, textoDoMotivo } from './controle';
import { FreioDosPublicados, InterruptorDaColeta, quando } from './ControlesDaColeta';
import { EntradaDoPesquisador } from './EntradaDoPesquisador';
import { enderecoCompleto, mapaDeRotas } from './mapa-de-rotas';
import { useIdentidade } from './usar-identidade';
import { baixarMetricas } from './usar-metricas';
import { CAMINHO_METRICAS } from './usar-rota';

/**
 * O painel de controle do pesquisador (D38): o que antes era SQL à mão no
 * editor do Supabase. Fora da navegação do participante; o link para cá fica
 * no painel de métricas.
 *
 * A tela só mostra as seções para a conta com o papel de pesquisador, mas não
 * é ela que protege: toda ação é uma função do banco que confere o papel por
 * dentro (0005), e uma tela adulterada esbarra nela. A chave secreta nunca
 * passa por aqui.
 *
 * Nada aqui é visto pelo participante, e o congelamento de D32 e D34 não é
 * afetado.
 */

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="pagina controle">
      <header>
        <a className="discreto" href={CAMINHO_METRICAS}>
          Métricas das sessões
        </a>
        <h1>Painel de controle</h1>
        <p>
          Aplicações do estudo, interruptor da coleta, mapa de rotas e auditoria. Toda ação
          que muda alguma coisa fica registrada, com quem, quando e o resultado.
        </p>
      </header>
      {children}
    </div>
  );
}

export function PainelDeControle() {
  const identidade = useIdentidade();
  const comConta = identidade.forma === 'email' || identidade.forma === 'google';

  if (!supabaseConfigurado()) {
    return (
      <Moldura>
        <p className="rodape-painel">
          O painel de controle age sobre o banco, e o banco não está configurado nesta instalação.
        </p>
      </Moldura>
    );
  }
  if (!comConta) {
    return (
      <Moldura>
        <section className="painel">
          <EntradaDoPesquisador />
        </section>
      </Moldura>
    );
  }
  if (identidade.papel === null) {
    return (
      <Moldura>
        <p className="rodape-painel">Lendo o papel da conta…</p>
      </Moldura>
    );
  }
  if (identidade.papel !== 'pesquisador') {
    return (
      <Moldura>
        <section className="painel">
          <div className="cabecalho-painel">
            <p className="rodape-painel">
              Esta conta não tem o papel de pesquisador, e o painel de controle é só dele.
            </p>
            <button onClick={() => void sair()}>Sair</button>
          </div>
        </section>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <section className="painel">
        <div className="cabecalho-painel">
          <p className="rodape-painel">
            Conta: {identidade.email ?? identidade.usuarioId}. Saia antes de entregar o aparelho a
            um participante.
          </p>
          <button onClick={() => void sair()}>Sair</button>
        </div>
      </section>
      <PainelDoPesquisador />
    </Moldura>
  );
}

/**
 * As ações primeiro, e o mapa de rotas, que é longo e só se consulta, perto
 * do fim. A lista das aplicações é lida uma vez e serve às duas seções.
 */
function PainelDoPesquisador() {
  const leitura = useAplicacoes();
  return (
    <>
      <SecaoDasAplicacoes leitura={leitura} />
      <InterruptorDaColeta />
      <FreioDosPublicados />
      <SecaoDoMapaDeRotas aplicacoes={leitura.aplicacoes?.map((a) => a.codigo) ?? []} />
      <SecaoDaAuditoria />
    </>
  );
}

// --------------------------------------------------------------- aplicações ---

/** As aplicações, relidas a pedido: é a lista que o resto do painel usa. */
function useAplicacoes() {
  const [aplicacoes, setAplicacoes] = useState<AplicacaoNoPainel[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState(0);
  useEffect(() => {
    let valida = true;
    setErro(null);
    listarAplicacoes()
      .then((lidas) => valida && setAplicacoes(lidas))
      .catch((e: unknown) => valida && setErro(mensagemDaFalha(e)));
    return () => {
      valida = false;
    };
  }, [pedido]);
  const recarregar = useCallback(() => setPedido((n) => n + 1), []);
  return { aplicacoes, erro, recarregar };
}

function SecaoDasAplicacoes({ leitura }: { leitura: ReturnType<typeof useAplicacoes> }) {
  const { aplicacoes, erro, recarregar } = leitura;
  const [falha, setFalha] = useState<string | null>(null);
  const [emLimpeza, setEmLimpeza] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);

  const agir = async (acao: () => Promise<void>) => {
    setAgindo(true);
    setFalha(null);
    try {
      await acao();
    } catch (e) {
      setFalha(mensagemDaFalha(e));
    } finally {
      setAgindo(false);
      recarregar();
    }
  };

  const proteger = (codigo: string) => {
    // Não é destrutivo, mas não se desfaz: nem o painel nem o banco
    // desprotegem (0005). Um clique de confirmação basta, sem digitar.
    const confirmado = window.confirm(
      `Proteger ${codigo}? A proteção não se desfaz: o painel nunca mais limpa esta aplicação.`
    );
    if (confirmado) void agir(() => protegerAplicacao(codigo));
  };

  const emLimpezaAgora = aplicacoes?.find((a) => a.codigo === emLimpeza) ?? null;

  return (
    <>
      <section className="painel" aria-labelledby="titulo-das-aplicacoes">
        <div className="cabecalho-painel">
          <h2 id="titulo-das-aplicacoes">Aplicações do estudo</h2>
          <button onClick={recarregar}>Recarregar</button>
        </div>
        {erro && <p className="erro">A leitura das aplicações falhou ({erro}).</p>}
        {falha && <p className="erro">{falha}</p>}
        {aplicacoes === null ? (
          !erro && <p className="rodape-painel">Lendo as aplicações…</p>
        ) : aplicacoes.length === 0 ? (
          <p className="rodape-painel">Nenhuma aplicação cadastrada.</p>
        ) : (
          <div className="rolagem">
            <table className="tabela-metricas tabela-das-aplicacoes">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Situação</th>
                  <th>Proteção</th>
                  <th>Entradas</th>
                  <th>Grupo A</th>
                  <th>Grupo B</th>
                  <th>Sessões</th>
                  <th>Respostas</th>
                  <th>Criada</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {aplicacoes.map((a) => (
                  <tr key={a.codigo}>
                    <td>
                      <strong>{a.codigo}</strong>
                    </td>
                    <td>{a.aberta ? 'aberta' : 'fechada'}</td>
                    <td>{a.protegida ? 'protegida' : 'de teste'}</td>
                    <td>{a.entradas}</td>
                    <td>{a.participantesA}</td>
                    <td>{a.participantesB}</td>
                    <td>{a.sessoes}</td>
                    <td>{a.respostas}</td>
                    <td>{quando(a.criadaEm)}</td>
                    <td>
                      <span className="acoes-da-linha">
                        <button
                          className="discreto"
                          disabled={agindo}
                          onClick={() => void agir(() => definirAplicacaoAberta(a.codigo, !a.aberta))}
                        >
                          {a.aberta ? 'Fechar' : 'Abrir'}
                        </button>
                        {!a.protegida && (
                          <button className="discreto" disabled={agindo} onClick={() => proteger(a.codigo)}>
                            Proteger
                          </button>
                        )}
                        {/* A protegida não tem o botão: o banco recusaria, e a
                            ausência diz isso antes. */}
                        {!a.protegida && (
                          <button
                            className="discreto perigo"
                            disabled={agindo}
                            onClick={() => setEmLimpeza(emLimpeza === a.codigo ? null : a.codigo)}
                            aria-expanded={emLimpeza === a.codigo}
                          >
                            Limpar
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <FormularioDeCriacao aoCriar={recarregar} />
      </section>

      {emLimpezaAgora && (
        <PainelDaLimpeza
          key={emLimpezaAgora.codigo}
          aplicacao={emLimpezaAgora}
          aoLimpar={recarregar}
          aoFechar={() => setEmLimpeza(null)}
        />
      )}
    </>
  );
}

function FormularioDeCriacao({ aoCriar }: { aoCriar: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [teste, setTeste] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ erro: boolean; texto: string } | null>(null);
  const problema = problemaDoCodigo(codigo);

  const criar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (problema) return;
    setEnviando(true);
    setResultado(null);
    try {
      await criarAplicacao(codigo, teste);
      setResultado({
        erro: false,
        texto: `${codigo} criada, ${teste ? 'de teste' : 'protegida'} e aberta.`,
      });
      setCodigo('');
      setTeste(false);
      aoCriar();
    } catch (e) {
      setResultado({ erro: true, texto: mensagemDaFalha(e) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="criar-aplicacao" onSubmit={(e) => void criar(e)}>
      <h3>Nova aplicação</h3>
      <label>
        Código
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="aeds1-2026"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="regra-do-codigo"
        />
      </label>
      <label className="marcar">
        <input type="checkbox" checked={teste} onChange={(e) => setTeste(e.target.checked)} />
        Aplicação de teste (pode ser limpa pelo painel)
      </label>
      <button type="submit" className="primario" disabled={enviando || problema !== null}>
        Criar
      </button>
      <p id="regra-do-codigo" className="rodape-painel">
        {codigo !== '' && problema
          ? problema
          : 'Sem marcar “de teste”, a aplicação nasce protegida — é o caso da coleta real —, e o painel nunca a limpa.'}
      </p>
      {resultado && <p className={resultado.erro ? 'erro' : 'rodape-painel'}>{resultado.texto}</p>}
    </form>
  );
}

/**
 * A limpeza de uma aplicação de teste. Primeiro o CSV, que é o dado que vai
 * sumir; depois o código digitado, que o banco confere de novo. Fechada,
 * porque o banco recusa a aberta (0005).
 */
function PainelDaLimpeza({
  aplicacao,
  aoLimpar,
  aoFechar,
}: {
  aplicacao: AplicacaoNoPainel;
  aoLimpar: () => void;
  aoFechar: () => void;
}) {
  const [digitado, setDigitado] = useState('');
  const [exportado, setExportado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<ResultadoDaLimpeza | null>(null);

  // O mesmo CSV do painel de métricas (D37), recortado nesta aplicação: as
  // sessões do banco juntadas aos participantes e às respostas.
  const exportar = async () => {
    setExportando(true);
    setErro(null);
    try {
      const [sessoes, dados] = await Promise.all([lerSessoesDoBanco(), lerDadosDoEstudo()]);
      baixarMetricas(
        csvDoEstudo(sessoesDoEstudo(sessoes, aplicacao.codigo), dados.participantes, dados.respostas),
        `estudo-${aplicacao.codigo}.csv`,
        'text/csv;charset=utf-8'
      );
      setExportado(true);
    } catch (e) {
      setErro(`O CSV não pôde ser lido do banco (${mensagemDaFalha(e)}).`);
    } finally {
      setExportando(false);
    }
  };

  const limpar = async () => {
    setLimpando(true);
    setErro(null);
    try {
      setFeito(await limparAplicacao(aplicacao.codigo, digitado));
      setDigitado('');
      aoLimpar();
    } catch (e) {
      setErro(mensagemDaFalha(e));
    } finally {
      setLimpando(false);
    }
  };

  return (
    <section className="painel painel-da-limpeza" aria-labelledby="titulo-da-limpeza">
      <div className="cabecalho-painel">
        <h2 id="titulo-da-limpeza">Limpar {aplicacao.codigo}</h2>
        {/* "Cancelar", e não "Fechar": fechar, nesta tela, é fechar a aplicação. */}
        <button className="discreto" onClick={aoFechar}>
          {feito ? 'Concluir' : 'Cancelar'}
        </button>
      </div>
      {feito ? (
        <p role="status">
          Limpa: {feito.respostas} resposta(s), {feito.sessoes} sessão(ões) e {feito.participantes}{' '}
          participante(s) apagados; o contador voltou de {feito.entradasAntes} a zero. Contas e
          perfis continuam no banco.
        </p>
      ) : (
        <>
          <p className="rodape-painel">
            Apaga {aplicacao.respostas} resposta(s), {aplicacao.sessoes} sessão(ões) e{' '}
            {aplicacao.participantesA + aplicacao.participantesB} participante(s) desta aplicação, e
            zera o contador de entradas. Não apaga contas nem perfis, e não se desfaz.
          </p>
          {aplicacao.aberta && (
            <p className="erro">{textoDoMotivo('aplicacao-aberta')} Use “Fechar” na tabela acima.</p>
          )}
          <ol className="passos-da-limpeza">
            <li>
              <button onClick={() => void exportar()} disabled={exportando}>
                {exportando ? 'Lendo…' : 'Exportar CSV desta aplicação'}
              </button>{' '}
              <span className="rodape-painel">
                {exportado ? 'Exportado.' : 'Ainda não exportado nesta tela.'}
              </span>
            </li>
            <li>
              <label>
                <span>
                  Para confirmar, digite <strong>{aplicacao.codigo}</strong>
                </span>
                <input
                  value={digitado}
                  onChange={(e) => setDigitado(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </li>
            <li>
              <button
                className="perigo"
                disabled={limpando || aplicacao.aberta || !confirmacaoConfere(digitado, aplicacao.codigo)}
                onClick={() => void limpar()}
              >
                Limpar definitivamente
              </button>
            </li>
          </ol>
        </>
      )}
      {erro && <p className="erro">{erro}</p>}
    </section>
  );
}

// ---------------------------------------------------------- mapa de rotas ---

function BotaoDeCopiar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<'parado' | 'copiado' | 'falhou'>('parado');
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado('copiado');
    } catch {
      // Sem permissão de área de transferência, o endereço continua à vista
      // para ser selecionado à mão.
      setEstado('falhou');
    }
  };
  return (
    <button className="discreto" onClick={() => void copiar()} aria-label={`Copiar ${texto}`}>
      {estado === 'copiado' ? 'Copiado' : estado === 'falhou' ? 'Não copiou: selecione' : 'Copiar'}
    </button>
  );
}

function SecaoDoMapaDeRotas({ aplicacoes }: { aplicacoes: string[] }) {
  const grupos = mapaDeRotas(catalogo, aplicacoes);
  return (
    <section className="painel" aria-labelledby="titulo-do-mapa">
      <h2 id="titulo-do-mapa">Mapa de rotas</h2>
      <p className="rodape-painel">
        Todos os endereços da aplicação, prontos para abrir ou copiar. Os de cada aplicação do
        estudo são os que se entregam na aula.
      </p>
      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="grupo-do-mapa">
          <h3>{grupo.titulo}</h3>
          {grupo.rotas.length === 0 ? (
            <p className="rodape-painel">Nenhuma.</p>
          ) : (
            <ul className="lista-do-mapa">
              {grupo.rotas.map((rota) => {
                const endereco = enderecoCompleto(rota.caminho, window.location);
                return (
                  <li key={rota.caminho}>
                    <span className="rotulo-da-rota">{rota.rotulo}</span>
                    <a href={rota.caminho}>{endereco}</a>
                    <BotaoDeCopiar texto={endereco} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

// -------------------------------------------------------------- auditoria ---

/** O detalhe numa linha: o motivo da recusa em texto, o resto como veio. */
function detalheLegivel(linha: LinhaDaAuditoria): string {
  const { motivo, ...resto } = linha.detalhe as { motivo?: string } & Record<string, unknown>;
  const partes: string[] = [];
  if (typeof motivo === 'string') partes.push(textoDoMotivo(motivo));
  const sobra = Object.entries(resto).map(([chave, valor]) => `${chave}: ${JSON.stringify(valor)}`);
  return [...partes, ...sobra].join(' · ');
}

function SecaoDaAuditoria() {
  const identidade = useIdentidade();
  const [linhas, setLinhas] = useState<LinhaDaAuditoria[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState(0);

  useEffect(() => {
    let valida = true;
    setErro(null);
    lerAuditoria()
      .then((lidas) => valida && setLinhas(lidas))
      .catch((e: unknown) => valida && setErro(mensagemDaFalha(e)));
    return () => {
      valida = false;
    };
  }, [pedido]);

  return (
    <section className="painel" aria-labelledby="titulo-da-auditoria">
      <div className="cabecalho-painel">
        <h2 id="titulo-da-auditoria">Auditoria</h2>
        <button onClick={() => setPedido((n) => n + 1)}>Recarregar</button>
      </div>
      <p className="rodape-painel">
        As últimas 50 ações do painel, inclusive as recusadas. A tabela só cresce: nem a chave
        secreta altera ou apaga uma linha.
      </p>
      {erro && <p className="erro">A leitura da auditoria falhou ({erro}).</p>}
      {linhas === null ? (
        !erro && <p className="rodape-painel">Lendo a auditoria…</p>
      ) : linhas.length === 0 ? (
        <p className="rodape-painel">Nenhuma ação registrada.</p>
      ) : (
        <div className="rolagem">
          <table className="tabela-metricas">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Conta</th>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Resultado</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td>{quando(l.em)}</td>
                  <td>{l.quem === identidade.usuarioId ? 'esta conta' : (l.quem?.slice(0, 8) ?? '—')}</td>
                  <td>{l.acao}</td>
                  <td>{l.alvo ?? '—'}</td>
                  <td>{l.resultado}</td>
                  <td className="detalhe-da-auditoria">{detalheLegivel(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
