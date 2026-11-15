import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { Cabecalho } from './Cabecalho';
import { EntradaDoProfessor } from './EntradaDoProfessor';
import { FolhaDeExercicio } from './FolhaDeExercicio';
import { CAMINHO_AUTORIA, CAMINHO_ENTRAR_PESQUISA, CAMINHO_EXERCICIOS } from './usar-rota';

/**
 * A entrada, no padrão das telas de login, com duas saídas (D32).
 *
 * O risco desta tela é o estudante: uma tela com cara de login faz supor que
 * é preciso ter conta, e quem hesita na porta vira sessão perdida — mais da
 * metade das sessões dos pilotos já terminava sem ação nenhuma. Por isso o
 * caminho dele é visivelmente mais leve que o do professor, e não só diferente:
 *
 * - vem primeiro, no topo do cartão, num bloco só dele;
 * - é um botão só, sem campo nenhum, na cor da ação;
 * - diz com todas as letras que não há conta nem cadastro;
 * - leva junto o aviso de registro anônimo para pesquisa (D29), que é
 *   informativo e não pede aceite.
 *
 * O professor tem a entrada inteira — Google, e-mail e senha —, num bloco
 * separado que diz, antes de qualquer campo, que aquele login é só de
 * professor. Sem isso os campos se liam como "a tela pede conta", que é o
 * engano que esta tela existe para evitar.
 *
 * A composição é a de D43: um cartão dividido que ocupa quase a tela toda,
 * com a folha de exercício e a lupa de um lado e as duas saídas do outro,
 * sobre o jardim desfocado da tela inicial. Mudou a aparência, e nenhum
 * fluxo: os controles e a ordem são os de antes.
 *
 * O estudante continua sempre anônimo (D29): o botão só navega. A identidade
 * anônima já foi criada quando a aplicação abriu.
 */
export function TelaDeEntrada() {
  return (
    <div className="jardim tela-de-entrada">
      <div className="pagina com-cabecalho">
        <Cabecalho logo />

        <div className="cartao-de-entrada">
          {/* Decoração: a folha não diz nada que o texto ao lado não diga. */}
          <div className="arte-da-entrada papeis-claros" aria-hidden="true">
            <FolhaDeExercicio />
          </div>

          <div className="lado-das-saidas papeis-claros">
            <h1>Entrar</h1>
            <p className="chamada-da-entrada">Escolha como você vai usar a ferramenta.</p>

            <main className="saidas-da-entrada">
              <section className="saida-estudante" aria-labelledby="saida-estudante">
                <h2 id="saida-estudante">Sou estudante</h2>
                <p className="leveza">Não precisa de conta nem de cadastro: é só entrar.</p>
                <a className="botao primario entrar-estudante" href={CAMINHO_EXERCICIOS}>
                  Entrar como estudante
                  <ArrowRightIcon className="icone" aria-hidden="true" />
                </a>
                {/* Junto do botão, e não no rodapé: é o que acontece ao clicar nele.
                    Informativo, sem nada a aceitar, e não substitui o termo de
                    consentimento do experimento, que é conduzido (D29). */}
                <p className="aviso-pesquisa">
                  A sua interação é registrada de forma anônima para fins de pesquisa, incluindo o
                  código que você escrever.
                </p>
              </section>

              <section className="saida-professor" aria-labelledby="saida-professor">
                <div className="titulo-da-saida">
                  <h2 id="saida-professor">Sou professor</h2>
                  <span className="so-professores">Login só para professores</span>
                </div>
                <p className="rodape-painel">
                  Para professores convidados, que escrevem exercícios. A conta passa a escrever
                  depois de liberada pela equipe da pesquisa.
                </p>
                <EntradaDoProfessor
                  comTituloDoModo
                  aoEntrar={() => {
                    window.location.hash = CAMINHO_AUTORIA;
                  }}
                />
                <p className="nota-do-login">
                  Estudante não usa este formulário: o botão de cima já leva aos exercícios.
                </p>
              </section>
            </main>

            {/* A entrada do pesquisador fica num link discreto, e não num terceiro
                bloco: esta é a tela que os estudantes veem, e o caminho deles
                precisa continuar o mais leve (D32, D39). */}
            <footer className="rodape-da-entrada">
              <a href={CAMINHO_ENTRAR_PESQUISA}>Acesso da pesquisa</a>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
