import { Cabecalho } from './Cabecalho';
import { CenaDoDetetive } from './CenaDoDetetive';
import { IconeApontar, IconeExecutar, IconeObservar } from './IlustracoesDaInicial';
import { CAMINHO_ENTRAR } from './usar-rota';

/**
 * Tela inicial: diz o que a ferramenta é e leva à entrada, que separa o
 * estudante do professor numa tela própria (D32).
 *
 * Não mostra exercício nenhum, nem quantos existem, nem quais já foram
 * abertos — é a mesma regra da lista, sem progresso (D8).
 *
 * A aparência é a de D43: o jardim à noite, o título aceso e o detetive com a
 * joaninha em três camadas, que acompanham o ponteiro. O texto é o de antes.
 * A moldura de fora (`jardim`) é a mesma das entradas e da vitrine: ela
 * troca os papéis de cor para o que está dentro dela, e nenhuma tela de fora
 * dessas os herda. Os três passos ficam em cartões claros, onde as
 * ilustrações têm as cores em que foram desenhadas.
 *
 * Um movimento só quando a tela abre — a cena chega, o título acende, o texto
 * e o botão entram —, e depois só o que responde ao ponteiro. Quem pediu
 * menos movimento ao sistema vê tudo no lugar, parado.
 */
export function TelaInicial() {
  return (
    <div className="jardim inicial">
      <div className="pagina com-cabecalho">
        <Cabecalho naInicial logo />

        <section className="abertura-inicial">
          <div className="chamada">
            <h1>Todo programa aqui tem um defeito. Descubra qual.</h1>
            <p>
              Cada exercício traz um código quase correto, com um erro de lógica colocado
              de propósito. Você executa, acompanha a estrutura de dados mudando passo a
              passo e descobre em que ponto o programa sai do trilho.
            </p>
            {/* Um botão só (D32). A escolha entre estudante e professor fica na
                tela de entrada, onde cada caminho tem o seu espaço. */}
            <a className="botao primario" href={CAMINHO_ENTRAR}>
              Entrar
            </a>
          </div>
          <CenaDoDetetive />
        </section>

        {/* Numerado porque é de fato uma sequência: é a ordem em que o trabalho
            acontece dentro de cada exercício. */}
        <ol className="passos">
          <li>
            <IconeExecutar />
            <h2>Execute</h2>
            <p>Rode o código e veja quais casos de teste falham.</p>
          </li>
          <li>
            <IconeObservar />
            <h2>Observe</h2>
            <p>Avance a execução passo a passo e acompanhe o desenho da estrutura.</p>
          </li>
          <li>
            <IconeApontar />
            <h2>Aponte e corrija</h2>
            <p>Clique no número da linha suspeita e conserte o código.</p>
          </li>
        </ol>

        <footer className="rodape-inicial">
          Trabalho de conclusão de curso em Sistemas de Informação, IFMG Campus Ouro
          Branco. Desenvolvido por João Victor Dutra Martins Silva.
        </footer>
      </div>
    </div>
  );
}
