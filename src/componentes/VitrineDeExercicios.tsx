import { useLayoutEffect, useRef, useState } from 'react';
import { catalogo } from '../exercicios/catalogo';
import { NIVEIS_DE_ANDAIME, rotuloDoAndaime } from './andaime';
import { complexidadeDe } from './complexidade';
import { MiniaturaDoExercicio } from './MiniaturaDoExercicio';
import { useExerciciosPublicados } from './usar-exercicios-publicados';
import { Cabecalho } from './Cabecalho';
import { SECOES, secaoDe } from './secoes-da-vitrine';
import { caminhoDoExercicio } from './usar-rota';
import type { SecaoDaVitrine } from './secoes-da-vitrine';
import type { Exercicio } from '../nucleo/tipos';

/**
 * Lista de exercícios em vitrine: uma fileira por seção — cada estrutura de
 * dados, e a ordenação (D34) —, com um cartão por exercício.
 *
 * Nada de progresso, pontuação ou marca de resolvido: saber de antemão quais
 * já foram resolvidos muda a forma como o estudante encara os que faltam. A
 * aparência de D43 — o jardim escuro, os cartões como fichas de caso, a
 * joaninha que aparece no cartão sob o ponteiro — tem jeito de jogo, e
 * nenhuma mecânica de jogo: não há fase travada, estrela nem contagem.
 */

type Filtro = SecaoDaVitrine | 'todas';

/**
 * Glifo de cada seção, montado com as mesmas primitivas do desenho de
 * verdade. Em grafite e sem nenhuma cor de significado: é ícone de fileira, não
 * estado de estrutura (D19). O da ordenação são três posições em degrau, de
 * altura crescente: o vetor, e o que se faz com ele.
 */
function GlifoDaEstrutura({ tipo }: { tipo: SecaoDaVitrine }) {
  return (
    <svg className="glifo" viewBox="0 0 32 24" aria-hidden="true">
      {tipo === 'vetor' &&
        [0, 1, 2].map((i) => <rect key={i} x={2 + i * 10} y={7} width={8} height={10} rx={1.5} />)}
      {tipo === 'ordenacao' &&
        [0, 1, 2].map((i) => (
          <rect key={i} x={3 + i * 9.5} y={15 - i * 4.5} width={7.5} height={5 + i * 4.5} rx={1.5} />
        ))}
      {tipo === 'pilha' &&
        [0, 1, 2].map((i) => <rect key={i} x={8} y={16 - i * 7} width={16} height={6} rx={1.5} />)}
      {tipo === 'fila' && (
        <>
          {[0, 1, 2].map((i) => <rect key={i} x={2 + i * 8} y={7} width={6.5} height={10} rx={1.5} />)}
          <path d="M 27 12 L 31 12 M 29 10 L 31 12 L 29 14" />
        </>
      )}
      {tipo === 'lista-encadeada' && (
        <>
          <rect x={1} y={7} width={10} height={10} rx={1.5} />
          <rect x={20} y={7} width={10} height={10} rx={1.5} />
          <path d="M 8 12 L 19 12 M 16.5 9.5 L 19 12 L 16.5 14.5" />
        </>
      )}
    </svg>
  );
}

function CartaoDoExercicio({ exercicio }: { exercicio: Exercicio }) {
  const complexidade = complexidadeDe(exercicio.dificuldade);
  return (
    <li className={exercicio.miniatura ? 'cartao' : 'cartao sem-miniatura'}>
      {exercicio.miniatura ? (
        <MiniaturaDoExercicio exercicio={exercicio} />
      ) : (
        // Sem instantâneo escolhido não há desenho para mostrar, e inventar um
        // seria afirmar um estado que o exercício não tem. Fica o glifo da
        // estrutura, que diz do que o exercício trata sem descrever execução
        // nenhuma.
        <div className="miniatura vazia" aria-hidden="true">
          <GlifoDaEstrutura tipo={exercicio.estrutura} />
        </div>
      )}
      <div className="corpo-cartao">
        <h3>{exercicio.titulo}</h3>
        <p className="meta-exercicio">
          {exercicio.tutorial && <span className="etiqueta">tutorial</span>}
          {/* A complexidade descreve o exercício, e não quem o abre: é a mesma
              informação de antes, dita em palavra em vez de fração. A cor vem
              junto do termo, nunca sozinha. */}
          <span className={`etiqueta complexidade ${complexidade.classe}`}>
            {complexidade.termo}
          </span>
        </p>
        {/* Um cartão por exercício, com as duas aberturas dentro dele. Dois
            cartões sugeririam dois exercícios. */}
        <p className="abertura">
          <span className="rotulo-abertura">abrir</span>
          {NIVEIS_DE_ANDAIME.map((nivel) => (
            <a key={nivel} className="nivel" href={caminhoDoExercicio(exercicio.id, nivel)}>
              {rotuloDoAndaime(nivel)}
            </a>
          ))}
        </p>
      </div>
    </li>
  );
}

/**
 * Onde está a opção escolhida do filtro, para a pílula escura deslizar até
 * ela (D43). A pílula é um enfeite do grupo, e não um elemento a mais: quem
 * diz qual opção vale continua sendo o `aria-pressed` de cada botão.
 *
 * Medido no próprio botão, e de novo quando a largura muda: em tela estreita
 * as opções quebram de linha, e a pílula precisa descer junto.
 */
function usePilulaDoFiltro(filtro: Filtro) {
  const grupo = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const elemento = grupo.current;
    if (!elemento) return;
    const medir = () => {
      const escolhida = elemento.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!escolhida) return;
      elemento.style.setProperty('--pilula-x', `${escolhida.offsetLeft}px`);
      elemento.style.setProperty('--pilula-y', `${escolhida.offsetTop}px`);
      elemento.style.setProperty('--pilula-largura', `${escolhida.offsetWidth}px`);
      elemento.style.setProperty('--pilula-altura', `${escolhida.offsetHeight}px`);
      elemento.classList.add('com-pilula');
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [filtro]);
  return grupo;
}

export function VitrineDeExercicios() {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const grupoDoFiltro = usePilulaDoFiltro(filtro);

  // O tutorial abre a fileira dele. A ordenação é estável, então o resto
  // mantém a ordem do catálogo, que já é por complexidade (D8).
  const fileiras = SECOES.map(({ secao, nome }) => ({
    tipo: secao,
    nome,
    exercicios: catalogo
      .filter((e) => secaoDe(e) === secao)
      .sort((a, b) => Number(b.tutorial ?? false) - Number(a.tutorial ?? false)),
  })).filter((fileira) => fileira.exercicios.length > 0);

  const visiveis = fileiras.filter((f) => filtro === 'todas' || f.tipo === filtro);

  // Os propostos por professores vêm do banco (D31). Enquanto a leitura não
  // termina, se ela falhar ou se não houver banco, a seção simplesmente não
  // existe: a vitrine do aluno não é lugar de aviso de conexão, e o catálogo
  // continua inteiro.
  const publicados = useExerciciosPublicados();
  const propostos =
    publicados.estado === 'pronto'
      ? publicados.exercicios.filter((e) => filtro === 'todas' || secaoDe(e) === filtro)
      : [];

  return (
    <div className="jardim vitrine">
    <div className="pagina com-cabecalho">
      {/* Sem link de volta ao lado da marca: a marca já leva ao início, e dois
          caminhos para o mesmo lugar, lado a lado, seriam ruído. */}
      <Cabecalho titulo="Exercícios" logo>
        {/* As duas escalas são fáceis de confundir, então a tela diz qual é
            qual antes de mostrá-las. */}
        <p>
          Cada cartão é um programa com um defeito para encontrar. A complexidade é do
          exercício e não muda. O apoio você escolhe ao abrir: sem apoio, a ferramenta
          auxilia menos durante a investigação.
        </p>
      </Cabecalho>

      {/* A barra do filtro e cada fileira têm chão e cabeçalho próprios (D34),
          no mesmo tratamento do topo da página (D32): antes, filtro, títulos e
          cartões pousavam soltos na sala. */}
      <div className="barra-do-filtro">
        <span className="rotulo-do-filtro" id="rotulo-do-filtro">
          Mostrar
        </span>
        <div className="filtro" role="group" aria-labelledby="rotulo-do-filtro" ref={grupoDoFiltro}>
          {[{ tipo: 'todas' as const, nome: 'Todas' }, ...fileiras].map((opcao) => (
            <button
              key={opcao.tipo}
              className="opcao-filtro"
              aria-pressed={filtro === opcao.tipo}
              onClick={() => setFiltro(opcao.tipo)}
            >
              {opcao.tipo !== 'todas' && <GlifoDaEstrutura tipo={opcao.tipo} />}
              {opcao.nome}
            </button>
          ))}
        </div>
      </div>

      {visiveis.map((fileira) => (
        <section key={fileira.tipo} className="fileira" aria-labelledby={`fileira-${fileira.tipo}`}>
          <h2 id={`fileira-${fileira.tipo}`} className="cabecalho-da-fileira">
            <GlifoDaEstrutura tipo={fileira.tipo} />
            {fileira.nome}
          </h2>
          <ul className="prateleira">
            {fileira.exercicios.map((exercicio) => (
              <CartaoDoExercicio key={exercicio.id} exercicio={exercicio} />
            ))}
          </ul>
        </section>
      ))}

      {/* Seção à parte, e não misturada às fileiras: o catálogo é o material
          da pesquisa, revisado com a suíte inteira, e os propostos passaram
          por outro caminho (D31). Na ordem da publicação, a mesma do convite
          para o próximo. */}
      {propostos.length > 0 && (
        <section className="fileira propostos" aria-labelledby="fileira-propostos">
          <div className="cabecalho-da-fileira">
            <h2 id="fileira-propostos">Propostos por professores</h2>
            <p className="nota-da-fileira">Escritos por professores convidados.</p>
          </div>
          <ul className="prateleira">
            {propostos.map((exercicio) => (
              <CartaoDoExercicio key={exercicio.id} exercicio={exercicio} />
            ))}
          </ul>
        </section>
      )}
    </div>
    </div>
  );
}
