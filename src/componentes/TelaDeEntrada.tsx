import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { Cabecalho } from './Cabecalho';
import { EntradaDoProfessor } from './EntradaDoProfessor';
import { CAMINHO_AUTORIA, CAMINHO_EXERCICIOS } from './usar-rota';

/**
 * A entrada, no padrão das telas de login, com duas saídas (D32).
 *
 * O risco desta tela é o estudante: uma tela com cara de login faz supor que
 * é preciso ter conta, e quem hesita na porta vira sessão perdida — mais da
 * metade das sessões dos pilotos já terminava sem ação nenhuma. Por isso o
 * caminho dele é visivelmente mais leve que o do professor, e não só diferente:
 *
 * - vem primeiro, à esquerda e no topo em tela estreita;
 * - é um botão só, sem campo nenhum, na cor da ação;
 * - diz com todas as letras que não há conta nem cadastro;
 * - leva junto o aviso de registro anônimo para pesquisa (D29), que é
 *   informativo e não pede aceite.
 *
 * O professor tem a entrada inteira — Google, e-mail e senha —, num bloco
 * contornado e mais estreito, que se lê como a segunda opção.
 *
 * O estudante continua sempre anônimo (D29): o botão só navega. A identidade
 * anônima já foi criada quando a aplicação abriu.
 */
export function TelaDeEntrada() {
  return (
    <div className="pagina tela-de-entrada com-cabecalho">
      <Cabecalho titulo="Entrar">
        <p>Escolha como você vai usar a ferramenta.</p>
      </Cabecalho>

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
          <h2 id="saida-professor">Sou professor</h2>
          <p className="rodape-painel">
            Para professores convidados, que escrevem exercícios. A conta passa a escrever
            depois de liberada pela equipe da pesquisa.
          </p>
          <EntradaDoProfessor
            aoEntrar={() => {
              window.location.hash = CAMINHO_AUTORIA;
            }}
          />
        </section>
      </main>
    </div>
  );
}
