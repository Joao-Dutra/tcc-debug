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
  enviarParaRevisao,
  salvarRascunho,
} from '../supabase/exercicios-de-professor';
import { complexidadeDe } from './complexidade';
import {
  CATEGORIAS,
  ESTRUTURAS,
  formularioDe,
  formularioVazio,
  rascunhoDoFormulario,
} from './formulario-do-exercicio';
import { PreviaDoExercicio } from './PreviaDoExercicio';
import { RelatorioDeVerificacao } from './RelatorioDeVerificacao';
import { temaDoEditor } from './tema-do-editor';
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
 * Enviar exige a verificação aprovada **do que está no formulário agora**: se
 * algo mudou depois de verificar, verifica-se de novo. Sem isso, verificar e
 * depois editar mandaria para a revisão um exercício que ninguém verificou.
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
}

export function EditorDeExercicio({ id: idInicial, inicial, aoFechar }: Props) {
  const [formulario, setFormulario] = useState<FormularioDoExercicio>(() =>
    inicial ? formularioDe(inicial) : formularioVazio()
  );
  const [id, setId] = useState<string | null>(idInicial);
  const [relatorio, setRelatorio] = useState<RelatorioDaVerificacao | null>(null);
  // O rascunho exatamente como estava quando foi verificado.
  const [verificado, setVerificado] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Exercicio | null>(null);
  const [ocupado, setOcupado] = useState<null | 'salvando' | 'verificando' | 'enviando'>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [mudou, setMudou] = useState(false);

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
  const verificacaoValeParaOAtual =
    relatorio !== null && atual !== null && verificado === JSON.stringify(atual);
  const podeEnviar = verificacaoValeParaOAtual && relatorio?.aprovado === true;

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

  const enviar = async () => {
    if (!atual || !relatorio || !podeEnviar) return;
    setOcupado('enviando');
    try {
      const alvo = await gravar(atual);
      await enviarParaRevisao(alvo, atual, relatorio);
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

        <NomesEsperados estrutura={formulario.estrutura} />

        <label>
          Título
          <input
            value={formulario.titulo}
            onChange={(e) => mudar({ titulo: e.target.value })}
            placeholder="Vetor: o que o estudante vê de errado"
          />
        </label>

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
            <label>
              Marcadores de posição
              <span className="ajuda">Em ordem, separados por vírgula; o primeiro é o principal.</span>
              <input
                value={formulario.marcadores}
                onChange={(e) => mudar({ marcadores: e.target.value })}
                placeholder="j, ultimo"
              />
            </label>
            <label>
              Variáveis de valor
              <span className="ajuda">Desenhadas em caixas, como a temporária de uma troca.</span>
              <input
                value={formulario.variaveisDeValor}
                onChange={(e) => mudar({ variaveisDeValor: e.target.value })}
                placeholder="temp"
              />
            </label>
          </div>
        )}

        <div className="campo-de-codigo">
          <span className="rotulo-do-campo">Código correto</span>
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

      <div className="acoes-painel">
        <button onClick={() => void salvar()} disabled={ocupado !== null}>
          {ocupado === 'salvando' ? 'Salvando…' : 'Salvar rascunho'}
        </button>
        <button onClick={verPrevia} disabled={ocupado !== null}>
          Ver o desenho
        </button>
        <button onClick={() => void verificar()} disabled={ocupado !== null}>
          {ocupado === 'verificando' ? 'Verificando…' : 'Verificar'}
        </button>
        <button className="primario" onClick={() => void enviar()} disabled={!podeEnviar || ocupado !== null}>
          {ocupado === 'enviando' ? 'Enviando…' : 'Enviar para revisão'}
        </button>
        <button className="perigo" onClick={() => void apagar()} disabled={ocupado !== null}>
          {id ? 'Apagar rascunho' : 'Descartar'}
        </button>
      </div>
      {relatorio && !verificacaoValeParaOAtual && (
        <p className="rodape-painel">
          O exercício mudou desde a última verificação. Verifique de novo antes de enviar.
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
