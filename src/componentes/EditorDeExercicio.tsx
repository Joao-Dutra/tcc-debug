import { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { executar } from '../nucleo/executor';
import {
  NOMES_DA_ESTRUTURA,
  exercicioDoRascunho,
  verificarExercicio,
} from '../nucleo/verificacao-do-exercicio';
import {
  apagarRascunho,
  criarRascunho,
  publicar,
  salvarRascunho,
} from '../supabase/exercicios-de-professor';
import { complexidadeDe } from './complexidade';
import { ExemploDoCampo } from './ExemploDoCampo';
import {
  CATEGORIAS,
  ESTRUTURAS,
  formularioDe,
  formularioVazio,
  rascunhoDoFormulario,
} from './formulario-do-exercicio';
import { publicacaoLiberada, verificacaoValeParaOAtual } from './liberacoes-da-autoria';
import { PreviaDoExercicio } from './PreviaDoExercicio';
import { RelatorioDeVerificacao } from './RelatorioDeVerificacao';
import { temaDoEditor } from './tema-do-editor';
import { caminhoDaPrevia } from './usar-rota';
import type { FormularioDoExercicio } from './formulario-do-exercicio';
import type {
  RascunhoDeExercicio,
  RelatorioDaVerificacao,
} from '../nucleo/verificacao-do-exercicio';
import type { Exercicio, TipoEstrutura } from '../nucleo/tipos';

/**
 * O editor de um exercício de professor (D31).
 *
 * A ordem dos campos segue a ordem do trabalho, e o primeiro é a estrutura:
 * ela decide os nomes que o desenho procura, e esses nomes aparecem antes de o
 * professor escrever a primeira linha de código. Recusar só na verificação
 * seria deixá-lo descobrir a regra depois de escrever o programa inteiro.
 *
 * Desde D33 o próprio autor publica, e o caminho está nos botões, em ordem:
 * salvar, verificar, ver como o aluno veria, publicar. Publicar exige a
 * verificação aprovada **do que está no formulário agora**: se algo mudou
 * depois de verificar, verifica-se de novo. A verificação é a única porta —
 * não há revisão depois dela —, e por isso ela não pode valer para um texto
 * que não foi o verificado.
 *
 * Ver como o aluno veria é consulta, e não etapa: abre a pré-visualização em
 * outra aba, com o rascunho salvo, e o editor fica como estava.
 */

const CONFIGURACAO_DO_EDITOR = {
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
};

/** Os nomes que o desenho da estrutura procura, mostrados antes do código. */
function NomesEsperados({ estrutura }: { estrutura: TipoEstrutura }) {
  const contrato = NOMES_DA_ESTRUTURA[estrutura];
  return (
    <div className="nomes-esperados" role="note">
      <h3>Nomes que o desenho procura</h3>
      <p className="rodape-painel">
        O desenho da estrutura encontra as variáveis pelo nome: use exatamente estes, nas duas
        versões do código.
      </p>
      <ul>
        {contrato.obrigatorios.map((n) => (
          <li key={n.nome}>
            <code>{n.nome}</code> — {n.papel}
          </li>
        ))}
        {contrato.opcionais.map((n) => (
          <li key={n.nome}>
            <code>{n.nome}</code> — {n.papel} (opcional)
          </li>
        ))}
      </ul>
      {contrato.declaraMarcadores && (
        <p className="rodape-painel">
          No vetor, diga também quais variáveis apontam posições — os marcadores, desenhados
          abaixo da fileira — e quais guardam valores, como a temporária de uma troca,
          desenhadas em caixas ao lado.
        </p>
      )}
    </div>
  );
}

interface Props {
  /** Nulo para um exercício novo. */
  id: string | null;
  inicial: RascunhoDeExercicio | null;
  aoFechar: (mudou: boolean) => void;
  /**
   * A seção dos propostos está oculta aos alunos pelo interruptor da coleta
   * (D33). A publicação avisa: senão o professor publica, não vê o exercício
   * na vitrine e supõe que falhou.
   */
  propostosOcultos: boolean;
}

export function EditorDeExercicio({ id: idInicial, inicial, aoFechar, propostosOcultos }: Props) {
  const [formulario, setFormulario] = useState<FormularioDoExercicio>(() =>
    inicial ? formularioDe(inicial) : formularioVazio()
  );
  const [id, setId] = useState<string | null>(idInicial);
  const [relatorio, setRelatorio] = useState<RelatorioDaVerificacao | null>(null);
  // O rascunho exatamente como estava quando foi verificado.
  const [verificado, setVerificado] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Exercicio | null>(null);
  const [ocupado, setOcupado] = useState<null | 'salvando' | 'verificando' | 'abrindo' | 'publicando'>(
    null
  );
  const [erros, setErros] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [mudou, setMudou] = useState(false);

  // O exemplo entra pelo formulário inteiro que `inserirExemplo` devolve: é lá
  // que mora a regra de nunca cobrir o que o professor escreveu (D35).
  const substituir = (novo: FormularioDoExercicio) => {
    setFormulario(novo);
    setMensagem(null);
  };

  const mudar = (parcial: Partial<FormularioDoExercicio>) => {
    setFormulario((f) => ({ ...f, ...parcial }));
    setMensagem(null);
  };

  /** O rascunho do formulário, ou nulo com os erros de digitação à vista. */
  const converter = (): RascunhoDeExercicio | null => {
    const conversao = rascunhoDoFormulario(formulario);
    setErros(conversao.erros);
    return conversao.rascunho;
  };

  const atual = rascunhoDoFormulario(formulario).rascunho;
  const valeParaOAtual = verificacaoValeParaOAtual(relatorio, verificado, atual);
  const liberada = publicacaoLiberada(relatorio, verificado, atual);

  const falhou = (e: unknown) => {
    setMensagem(null);
    setErros([e instanceof Error ? e.message : String(e)]);
  };

  /** Grava o rascunho, criando-o se ainda não existe no banco; devolve o id. */
  const gravar = async (rascunho: RascunhoDeExercicio): Promise<string> => {
    if (id) {
      await salvarRascunho(id, rascunho);
      return id;
    }
    const novo = await criarRascunho(rascunho);
    setId(novo);
    return novo;
  };

  const salvar = async () => {
    const rascunho = converter();
    if (!rascunho) return;
    setOcupado('salvando');
    try {
      await gravar(rascunho);
      setMudou(true);
      setMensagem('Rascunho salvo.');
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(null);
    }
  };

  const verificar = async () => {
    const rascunho = converter();
    if (!rascunho) return;
    setOcupado('verificando');
    setMensagem(null);
    try {
      setRelatorio(await verificarExercicio(rascunho, executar));
      setVerificado(JSON.stringify(rascunho));
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(null);
    }
  };

  // A aba é aberta já, no clique, e o endereço vem depois de salvar: aberta
  // depois de uma espera, o navegador a trataria como janela não pedida.
  const verComoOAluno = async () => {
    if (!atual || !liberada) return;
    const aba = window.open('about:blank', '_blank');
    setOcupado('abrindo');
    try {
      const alvo = await gravar(atual);
      setMudou(true);
      if (aba) aba.location.href = `${window.location.pathname}${caminhoDaPrevia(alvo)}`;
    } catch (e) {
      aba?.close();
      falhou(e);
    } finally {
      setOcupado(null);
    }
  };

  const publicarAgora = async () => {
    if (!atual || !relatorio || !liberada) return;
    const aviso = propostosOcultos
      ? '\n\nA seção dos propostos está oculta aos alunos enquanto durar a coleta da pesquisa: ' +
        'o exercício fica publicado, e aparece para eles quando a seção voltar.'
      : '';
    const confirmado = window.confirm(
      'Publicar este exercício? Os alunos passam a vê-lo, e o conteúdo publicado não muda mais: ' +
        'para corrigir, você cria um rascunho novo a partir dele e retira este.' +
        aviso
    );
    if (!confirmado) return;
    setOcupado('publicando');
    try {
      const alvo = await gravar(atual);
      await publicar(alvo, atual, relatorio);
      aoFechar(true);
    } catch (e) {
      falhou(e);
      setOcupado(null);
    }
  };

  const apagar = async () => {
    if (!id) {
      aoFechar(mudou);
      return;
    }
    if (!window.confirm('Apagar este rascunho? Isto não pode ser desfeito.')) return;
    try {
      await apagarRascunho(id);
      aoFechar(true);
    } catch (e) {
      falhou(e);
    }
  };

  const verPrevia = () => {
    const rascunho = converter();
    if (!rascunho) return;
    // Um exercício só para desenhar: id e linha não entram na execução.
    setPrevia(exercicioDoRascunho('previa', rascunho, { linhaDoDefeito: 1, linhasAceitas: [1] }));
  };

  const vetor = formulario.estrutura === 'vetor';

  return (
    <section className="painel editor-de-exercicio">
      <div className="cabecalho-painel">
        <h2>{id ? 'Rascunho' : 'Novo exercício'}</h2>
        <button className="discreto" onClick={() => aoFechar(mudou)}>
          Voltar à lista
        </button>
      </div>

      <div className="campos">
        <label>
          Estrutura de dados
          <select
            value={formulario.estrutura}
            onChange={(e) => mudar({ estrutura: e.target.value as TipoEstrutura })}
          >
            {ESTRUTURAS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </label>

        {/* A ordenação é agrupamento, e não estrutura (D34): o exercício continua
            vetor, com os marcadores e a temporária da troca, e o agrupamento
            só o põe no filtro da ordenação, dentro da seção dos propostos. */}
        {vetor && (
          <label>
            Agrupamento na vitrine
            <span className="ajuda">
              Um algoritmo de ordenação continua sendo vetor. Agrupado em ordenação, ele aparece
              no filtro Ordenação, dentro da seção dos propostos por professores, e os exemplos
              passam a vir de um exercício de ordenação.
            </span>
            <select
              value={formulario.agrupamento ?? ''}
              onChange={(e) =>
                mudar({ agrupamento: e.target.value === 'ordenacao' ? 'ordenacao' : null })
              }
            >
              <option value="">Vetor</option>
              <option value="ordenacao">Ordenação</option>
            </select>
          </label>
        )}

        <NomesEsperados estrutura={formulario.estrutura} />

        <div className="campo-com-exemplo">
          <label>
            Título
            <input
              value={formulario.titulo}
              onChange={(e) => mudar({ titulo: e.target.value })}
              placeholder="Vetor: o que o estudante vê de errado"
            />
          </label>
          <ExemploDoCampo formulario={formulario} campo="titulo" aoInserir={substituir} />
        </div>

        <div className="campo-com-exemplo">
          <label>
            Enunciado
            <span className="ajuda">
              O comportamento esperado, e um convite a olhar o desenho — nunca o sintoma nem a
              região do código.
            </span>
            <textarea
              rows={4}
              value={formulario.enunciado}
              onChange={(e) => mudar({ enunciado: e.target.value })}
            />
          </label>
          <ExemploDoCampo formulario={formulario} campo="enunciado" aoInserir={substituir} />
        </div>

        <div className="lado-a-lado">
          <label>
            Complexidade
            <select
              value={formulario.dificuldade}
              onChange={(e) => mudar({ dificuldade: Number(e.target.value) as 1 | 2 | 3 })}
            >
              {([1, 2, 3] as const).map((n) => (
                <option key={n} value={n}>
                  {complexidadeDe(n).termo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo do defeito
            <select
              value={formulario.categoriaDefeito}
              onChange={(e) =>
                mudar({ categoriaDefeito: e.target.value as FormularioDoExercicio['categoriaDefeito'] })
              }
            >
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>

        {vetor && (
          <div className="lado-a-lado">
            <div className="campo-com-exemplo">
              <label>
                Marcadores de posição
                <span className="ajuda">Em ordem, separados por vírgula; o primeiro é o principal.</span>
                <input
                  value={formulario.marcadores}
                  onChange={(e) => mudar({ marcadores: e.target.value })}
                  placeholder="j, ultimo"
                />
              </label>
              <ExemploDoCampo formulario={formulario} campo="marcadores" aoInserir={substituir} />
            </div>
            <div className="campo-com-exemplo">
              <label>
                Variáveis de valor
                <span className="ajuda">Desenhadas em caixas, como a temporária de uma troca.</span>
                <input
                  value={formulario.variaveisDeValor}
                  onChange={(e) => mudar({ variaveisDeValor: e.target.value })}
                  placeholder="temp"
                />
              </label>
              <ExemploDoCampo formulario={formulario} campo="variaveisDeValor" aoInserir={substituir} />
            </div>
          </div>
        )}

        <div className="campo-de-codigo">
          <span className="rotulo-do-campo">Código correto</span>
          <ExemploDoCampo formulario={formulario} campo="codigoCorreto" aoInserir={substituir} />
          <CodeMirror
            value={formulario.codigoCorreto}
            height="240px"
            basicSetup={CONFIGURACAO_DO_EDITOR}
            theme={temaDoEditor}
            extensions={[javascript()]}
            onChange={(valor) => mudar({ codigoCorreto: valor })}
          />
        </div>

        <div className="campo-de-codigo">
          <span className="rotulo-do-campo">Código com defeito</span>
          <span className="ajuda">
            O mesmo programa, com um defeito só: uma linha alterada, ou uma linha fora do lugar.
            A linha do defeito sai da comparação entre as duas versões.
          </span>
          <ExemploDoCampo formulario={formulario} campo="codigoComDefeito" aoInserir={substituir} />
          {formulario.codigoComDefeito.trim() === '' && formulario.codigoCorreto.trim() !== '' && (
            <button
              type="button"
              className="discreto"
              onClick={() => mudar({ codigoComDefeito: formulario.codigoCorreto })}
            >
              Começar pela cópia do código correto
            </button>
          )}
          <CodeMirror
            value={formulario.codigoComDefeito}
            height="240px"
            basicSetup={CONFIGURACAO_DO_EDITOR}
            theme={temaDoEditor}
            extensions={[javascript()]}
            onChange={(valor) => mudar({ codigoComDefeito: valor })}
          />
        </div>

        <fieldset className="casos-do-formulario">
          <legend>Casos de teste</legend>
          <span className="ajuda">
            A expressão é avaliada depois do programa. O valor esperado vai em JSON: números como
            42, textos entre aspas como "ana", vetores como [1, 2].
          </span>
          <ExemploDoCampo formulario={formulario} campo="casos" aoInserir={substituir} />
          {formulario.casos.map((caso, i) => (
            <div key={i} className="caso-do-formulario">
              <input
                aria-label={`Descrição do caso ${i + 1}`}
                placeholder="O que o caso confere"
                value={caso.descricao}
                onChange={(e) =>
                  mudar({
                    casos: formulario.casos.map((c, j) => (j === i ? { ...c, descricao: e.target.value } : c)),
                  })
                }
              />
              <input
                aria-label={`Expressão do caso ${i + 1}`}
                className="mono"
                placeholder="itens[0]"
                value={caso.expressao}
                onChange={(e) =>
                  mudar({
                    casos: formulario.casos.map((c, j) => (j === i ? { ...c, expressao: e.target.value } : c)),
                  })
                }
              />
              <input
                aria-label={`Valor esperado do caso ${i + 1}`}
                className="mono"
                placeholder="0"
                value={caso.esperado}
                onChange={(e) =>
                  mudar({
                    casos: formulario.casos.map((c, j) => (j === i ? { ...c, esperado: e.target.value } : c)),
                  })
                }
              />
              <button
                type="button"
                className="discreto"
                onClick={() => mudar({ casos: formulario.casos.filter((_, j) => j !== i) })}
              >
                Tirar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              mudar({ casos: [...formulario.casos, { descricao: '', expressao: '', esperado: '' }] })
            }
          >
            Acrescentar caso
          </button>
        </fieldset>

        <fieldset className="dicas-do-formulario">
          <legend>Dicas</legend>
          <span className="ajuda">
            Três, em ordem crescente: a primeira dirige a atenção, a segunda aponta a relação
            onde está o problema, a terceira diz a propriedade que deveria valer. Nenhuma nomeia
            a linha do defeito.
          </span>
          <ExemploDoCampo formulario={formulario} campo="dicas" aoInserir={substituir} />
          {formulario.dicas.map((dica, i) => (
            <textarea
              key={i}
              aria-label={`Dica ${i + 1}`}
              rows={2}
              value={dica}
              onChange={(e) => {
                const dicas = [...formulario.dicas] as FormularioDoExercicio['dicas'];
                dicas[i] = e.target.value;
                mudar({ dicas });
              }}
            />
          ))}
        </fieldset>
      </div>

      {erros.length > 0 && (
        <ul className="erros-do-formulario" role="alert">
          {erros.map((erro) => (
            <li key={erro} className="erro">
              {erro}
            </li>
          ))}
        </ul>
      )}
      {mensagem && <p className="mensagem-do-editor" role="status">{mensagem}</p>}

      {/* O caminho até o aluno, em ordem (D33). Ver o desenho fica à parte:
          é ferramenta de escrita, e não passo da publicação. */}
      <ol className="etapas-da-publicacao" aria-label="Caminho até a publicação">
        <li>
          <button onClick={() => void salvar()} disabled={ocupado !== null}>
            {ocupado === 'salvando' ? 'Salvando…' : 'Salvar rascunho'}
          </button>
        </li>
        <li>
          <button onClick={() => void verificar()} disabled={ocupado !== null}>
            {ocupado === 'verificando' ? 'Verificando…' : 'Verificar'}
          </button>
        </li>
        <li>
          <button onClick={() => void verComoOAluno()} disabled={!liberada || ocupado !== null}>
            {ocupado === 'abrindo' ? 'Abrindo…' : 'Ver como o aluno veria'}
          </button>
        </li>
        <li>
          <button
            className="primario"
            onClick={() => void publicarAgora()}
            disabled={!liberada || ocupado !== null}
          >
            {ocupado === 'publicando' ? 'Publicando…' : 'Publicar'}
          </button>
        </li>
      </ol>
      <div className="acoes-painel">
        <button onClick={verPrevia} disabled={ocupado !== null}>
          Ver o desenho
        </button>
        <button className="perigo" onClick={() => void apagar()} disabled={ocupado !== null}>
          {id ? 'Apagar rascunho' : 'Descartar'}
        </button>
      </div>
      {!liberada && (
        <p className="rodape-painel">
          {relatorio && !valeParaOAtual
            ? 'O exercício mudou desde a última verificação. Verifique de novo antes de publicar.'
            : 'Ver como o aluno veria e publicar dependem da verificação aprovada do que está no ' +
              'formulário.'}
        </p>
      )}

      {previa && (
        <div className="bloco-do-editor">
          <h3>O desenho, com e sem o defeito</h3>
          <PreviaDoExercicio exercicio={previa} />
        </div>
      )}
      {relatorio && (
        <div className="bloco-do-editor">
          <h3>Verificação</h3>
          <RelatorioDeVerificacao relatorio={relatorio} />
        </div>
      )}
    </section>
  );
}
