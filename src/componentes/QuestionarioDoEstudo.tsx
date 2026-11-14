import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import {
  LIMITE_DA_RESPOSTA_ABERTA,
  NAO_USEI,
  QUESTIONARIO,
  VALORES_DA_ESCALA,
  afirmacoesQueFaltam,
  montarResposta,
} from '../estudo/questionario';
import type { CampoAberto, EscalasEmAndamento, RespostaDoQuestionario } from '../estudo/questionario';

/**
 * O questionário do fim do percurso (D37). O texto e a ordem moram em
 * `src/estudo/questionario.ts`; aqui fica só o formulário.
 *
 * Os itens são obrigatórios, e o botão só se libera com todos: o SUS não
 * tem escore parcial. No bloco dos recursos, "Não usei" é resposta (D42). As
 * abertas são opcionais. A tela diz quantos faltam, e não quais, para não
 * apontar a pergunta como se ela tivesse resposta certa.
 */
export function QuestionarioDoEstudo({
  aoEnviar,
}: {
  aoEnviar: (resposta: RespostaDoQuestionario) => Promise<void>;
}) {
  const [escalas, setEscalas] = useState<EscalasEmAndamento>({});
  const [abertas, setAbertas] = useState<Partial<Record<CampoAberto, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const faltam = afirmacoesQueFaltam(escalas);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const resposta = montarResposta(escalas, abertas);
    if (!resposta) return;
    setEnviando(true);
    setFalha(null);
    try {
      await aoEnviar(resposta);
    } catch {
      // As respostas continuam no formulário: tentar de novo não perde nada,
      // e uma segunda chegada ao banco é lida como "já gravada".
      setFalha('Não foi possível enviar as respostas. Tente de novo ou chame o pesquisador.');
      setEnviando(false);
    }
  };

  return (
    <form className="questionario-do-estudo" onSubmit={(e) => void enviar(e)}>
      {QUESTIONARIO.introducao.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {QUESTIONARIO.blocos.map((bloco) => (
        <section key={bloco.titulo}>
          <h2>{bloco.titulo}</h2>
          {bloco.instrucao && <p>{bloco.instrucao}</p>}
          {bloco.itens.map((item) => (
            <fieldset key={item.id} className="afirmacao">
              <legend>{item.texto}</legend>
              <div className={bloco.naoUsei ? 'escala com-nao-usei' : 'escala'}>
                {VALORES_DA_ESCALA.map((valor) => (
                  <label key={valor}>
                    <input
                      type="radio"
                      name={item.id}
                      value={valor}
                      checked={escalas[item.id] === valor}
                      onChange={() => setEscalas((atual) => ({ ...atual, [item.id]: valor }))}
                    />
                    <span className="valor">{valor}</span>
                    {bloco.ancoras[valor] && <span className="ancora">{bloco.ancoras[valor]}</span>}
                  </label>
                ))}
                {bloco.naoUsei && (
                  <label className="nao-usei">
                    <input
                      type="radio"
                      name={item.id}
                      value={NAO_USEI}
                      checked={escalas[item.id] === NAO_USEI}
                      onChange={() => setEscalas((atual) => ({ ...atual, [item.id]: NAO_USEI }))}
                    />
                    <span className="valor">{QUESTIONARIO.naoUsei}</span>
                  </label>
                )}
              </div>
            </fieldset>
          ))}
        </section>
      ))}
      {QUESTIONARIO.abertas.map((a) => (
        <label key={a.campo} className="aberta">
          <span>
            {a.pergunta} <span className="opcional">({QUESTIONARIO.opcional})</span>
          </span>
          <textarea
            rows={3}
            maxLength={LIMITE_DA_RESPOSTA_ABERTA}
            value={abertas[a.campo] ?? ''}
            onChange={(e) => setAbertas((atual) => ({ ...atual, [a.campo]: e.target.value }))}
          />
        </label>
      ))}
      {faltam > 0 && (
        <p className="rodape-painel" role="status">
          {faltam === 1 ? 'Falta 1 item para marcar.' : `Faltam ${faltam} itens para marcar.`}
        </p>
      )}
      {falha && <p className="erro">{falha}</p>}
      <button className="primario" type="submit" disabled={faltam > 0 || enviando}>
        {enviando ? 'Enviando…' : QUESTIONARIO.enviar}
        <ArrowRightIcon className="icone" aria-hidden="true" />
      </button>
    </form>
  );
}
