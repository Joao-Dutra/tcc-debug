import { useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { supabaseConfigurado } from '../supabase/cliente';
import { sair } from '../supabase/identidade';
import { AguardandoLiberacao } from './AguardandoLiberacao';
import { Cabecalho } from './Cabecalho';
import { EntradaDoPesquisador } from './EntradaDoPesquisador';
import { estadoDaArea } from './estado-da-area';
import { useIdentidade } from './usar-identidade';
import { FolhaDeExercicio } from './FolhaDeExercicio';
import { CAMINHO_CONTROLE, CAMINHO_ENTRAR } from './usar-rota';

/**
 * O acesso da pesquisa (D39): a entrada do pesquisador em tela própria,
 * separada da do professor.
 *
 * Chega-se aqui por um link discreto no rodapé da tela de entrada, que é a
 * tela que os estudantes veem: um terceiro botão grande ali tiraria a leveza
 * do caminho do estudante (D32). Só e-mail e senha, como no painel de
 * métricas: a conta de pesquisador é criada à mão, e não por aqui.
 *
 * **Entrar não concede papel nenhum.** Quem entra com o papel vai para o
 * painel de controle; quem entra sem ele vê o mesmo aviso de liberação da
 * área do professor. Quem protege os dados é o banco, por papel (D24, D38).
 *
 * O cartão dividido é o da tela de entrada (D43), com a mesma folha de
 * exercício ao lado. Os estados e os textos são os de antes.
 */
export function EntradaDaPesquisa() {
  const identidade = useIdentidade();
  // A mesma leitura da área do professor: a regra de que conta anônima nunca
  // passa vale igual aqui.
  const estado = estadoDaArea(identidade, supabaseConfigurado());

  useEffect(() => {
    if (estado === 'pesquisador') window.location.hash = CAMINHO_CONTROLE;
  }, [estado]);

  return (
    <div className="jardim entrada-da-pesquisa">
    <div className="pagina com-cabecalho">
      <Cabecalho
        navegacao={
          <a className="voltar" href={CAMINHO_ENTRAR}>
            <ArrowLeftIcon className="icone" aria-hidden="true" />
            Entrar
          </a>
        }
        logo
      />

      <div className="cartao-de-entrada estreito">
        <div className="arte-da-entrada papeis-claros" aria-hidden="true">
          <FolhaDeExercicio />
        </div>
        <div className="lado-das-saidas papeis-claros">
          <h1>Acesso da pesquisa</h1>
          <p className="chamada-da-entrada">Para a equipe da pesquisa, com a conta criada por ela.</p>

          {estado === 'sem-banco' && (
            <p className="rodape-painel">
              O acesso da pesquisa lê os dados do banco, e o banco não está configurado nesta
              instalação.
            </p>
          )}
          {estado === 'entrar' && (
            <section className="painel bloco-da-pesquisa" aria-label="Entrar como pesquisador">
              <EntradaDoPesquisador />
            </section>
          )}
          {estado === 'conferindo' && <p className="rodape-painel">Conferindo o papel desta conta…</p>}
          {estado === 'pesquisador' && <p className="rodape-painel">Abrindo o painel de controle…</p>}
          {(estado === 'professor' || estado === 'aguardando') && (
            <>
              <AguardandoLiberacao papel="pesquisador" />
              <p className="conta-aberta">
                <span className="rodape-painel">Conta: {identidade.email ?? identidade.usuarioId}.</span>
                <button onClick={() => void sair()}>Sair</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
