import { useCallback, useEffect, useRef, useState } from 'react';
import {
  concederPapelDeProfessor,
  listarCadastrosDeProfessor,
  revogarPapelDeProfessor,
} from '../supabase/controle-do-pesquisador';
import type { CadastroDeProfessor } from '../supabase/controle-do-pesquisador';
import { mensagemDaFalha, separarCadastros } from './controle';

/**
 * A aprovação de professores, no painel de controle (D45).
 *
 * Duas listas: quem se cadastrou e ainda não tem o papel, com "Aprovar", e
 * quem já é professor, com "Revogar". As contas anônimas dos estudantes não
 * aparecem — o banco não as entrega (0007).
 *
 * Aqui só se pede. Quem confere que a conta é de pesquisador, que o papel em
 * jogo é só o de professor e que ninguém mexe na própria conta é o banco, por
 * dentro de cada função; uma tela adulterada esbarra lá. O papel de
 * pesquisador não é dado nem tirado por esta tela: continua só por SQL.
 *
 * Aprovar é um clique: não perde nada, e revogar desfaz. Revogar pede
 * confirmação num diálogo da própria página, porque tira de alguém o que ele
 * usa para trabalhar.
 */

/** De quanto em quanto a lista se relê sozinha, para o cadastro novo aparecer. */
const RELEITURA_MS = 20_000;

const data = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function useCadastros() {
  const [cadastros, setCadastros] = useState<CadastroDeProfessor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState(0);
  useEffect(() => {
    let valida = true;
    listarCadastrosDeProfessor()
      .then((lidos) => {
        if (!valida) return;
        setCadastros(lidos);
        setErro(null);
      })
      .catch((e: unknown) => valida && setErro(mensagemDaFalha(e)));
    return () => {
      valida = false;
    };
  }, [pedido]);
  const recarregar = useCallback(() => setPedido((n) => n + 1), []);
  // Relê sozinha enquanto a aba está à vista: quem acabou de se cadastrar
  // aparece sem ninguém apertar nada.
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === 'visible') recarregar();
    }, RELEITURA_MS);
    return () => window.clearInterval(relogio);
  }, [recarregar]);
  return { cadastros, erro, recarregar };
}

function Conta({ cadastro }: { cadastro: CadastroDeProfessor }) {
  return (
    <span className="conta-do-cadastro">
      <strong>{cadastro.nome ?? cadastro.email}</strong>
      {cadastro.nome && <span className="email-do-cadastro">{cadastro.email}</span>}
      <span className="data-do-cadastro">cadastro em {data(cadastro.cadastradoEm)}</span>
    </span>
  );
}

export function SecaoDosProfessores() {
  const { cadastros, erro, recarregar } = useCadastros();
  const [agindo, setAgindo] = useState(false);
  const [retorno, setRetorno] = useState<{ texto: string; falhou: boolean } | null>(null);
  const [aRevogar, setARevogar] = useState<CadastroDeProfessor | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  // O diálogo é o do navegador para a página (`<dialog>`), e não um `confirm`:
  // prende o foco, fecha no Esc e segue o desenho do resto do painel.
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aRevogar && !d.open) d.showModal();
    if (!aRevogar && d.open) d.close();
  }, [aRevogar]);

  const agir = async (acao: () => Promise<void>, feito: string) => {
    setAgindo(true);
    setRetorno(null);
    try {
      await acao();
      setRetorno({ texto: feito, falhou: false });
    } catch (e) {
      setRetorno({ texto: mensagemDaFalha(e), falhou: true });
    } finally {
      setAgindo(false);
      recarregar();
    }
  };

  const aprovar = (c: CadastroDeProfessor) =>
    void agir(() => concederPapelDeProfessor(c.id), `${c.email} foi aprovada: já pode escrever exercícios.`);

  const revogar = (c: CadastroDeProfessor) => {
    setARevogar(null);
    void agir(() => revogarPapelDeProfessor(c.id), `${c.email} não é mais professor.`);
  };

  const { aguardando, professores } = separarCadastros(cadastros ?? []);

  return (
    <section className="painel secao-dos-professores" aria-labelledby="titulo-dos-professores">
      <div className="cabecalho-painel">
        <h2 id="titulo-dos-professores">Professores</h2>
        <button onClick={recarregar}>Recarregar</button>
      </div>
      <p className="rodape-painel">
        Quem criou conta pelo Google ou por e-mail e senha. Aprovar libera a escrita de
        exercícios; o papel de pesquisador não é dado por aqui.
      </p>
      {erro && <p className="erro">A leitura dos cadastros falhou ({erro}).</p>}
      {/* Sempre na página, vazia até haver o que dizer: é assim que o leitor
          de tela anuncia o resultado da ação. */}
      <p className={retorno?.falhou ? 'erro retorno-dos-professores' : 'retorno-dos-professores'} role="status">
        {retorno?.texto}
      </p>

      <div className="grupo-de-cadastros">
        <h3 id="titulo-aguardando">Aguardando aprovação</h3>
        {cadastros === null && !erro && <p className="rodape-painel">Lendo os cadastros…</p>}
        {cadastros !== null && aguardando.length === 0 && (
          <p className="rodape-painel">Ninguém aguardando.</p>
        )}
        {aguardando.length > 0 && (
          <ul className="lista-de-cadastros" aria-labelledby="titulo-aguardando">
            {aguardando.map((c) => (
              <li key={c.id}>
                <Conta cadastro={c} />
                <button className="primario" disabled={agindo} onClick={() => aprovar(c)}>
                  Aprovar<span className="so-leitor"> {c.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grupo-de-cadastros">
        <h3 id="titulo-aprovados">Professores aprovados</h3>
        {cadastros !== null && professores.length === 0 && (
          <p className="rodape-painel">Nenhum professor aprovado.</p>
        )}
        {professores.length > 0 && (
          <ul className="lista-de-cadastros" aria-labelledby="titulo-aprovados">
            {professores.map((c) => (
              <li key={c.id}>
                <Conta cadastro={c} />
                <button className="perigo" disabled={agindo} onClick={() => setARevogar(c)}>
                  Revogar<span className="so-leitor"> {c.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialogo}
        className="dialogo-do-painel"
        aria-labelledby="titulo-da-revogacao"
        onClose={() => setARevogar(null)}
      >
        {aRevogar && (
          <>
            <h3 id="titulo-da-revogacao">Revogar o papel de professor?</h3>
            <p>
              <strong>{aRevogar.email}</strong> deixa de escrever e de publicar exercícios. Os
              que já publicou continuam publicados; para tirá-los, use “Retirar”, em
              Publicados pelos professores.
            </p>
            <p className="rodape-painel">Dá para aprovar de novo depois.</p>
            <div className="acoes-do-dialogo">
              <button autoFocus onClick={() => setARevogar(null)}>
                Cancelar
              </button>
              <button className="perigo" onClick={() => revogar(aRevogar)}>
                Revogar o papel
              </button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
