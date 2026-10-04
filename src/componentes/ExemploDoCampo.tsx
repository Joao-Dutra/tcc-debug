import { useState } from 'react';
import {
  campoVazio,
  exercicioDeExemplo,
  inserirExemplo,
  textoDoExemplo,
} from './exemplos-do-formulario';
import type { CampoComExemplo } from './exemplos-do-formulario';
import type { FormularioDoExercicio } from './formulario-do-exercicio';

/**
 * O botão de exemplo de um campo do formulário do professor (D35).
 *
 * Mostra como o campo fica num exercício do catálogo da estrutura escolhida.
 * Com o campo vazio, oferece inserir; com conteúdo, só mostra — o exemplo
 * nunca cobre o que o professor escreveu. Quem decide isso é
 * `exemplos-do-formulario.ts`, e não este componente.
 */

/** O que é código vai em largura fixa, como no editor; o que é prosa, não. */
const EM_CODIGO: readonly CampoComExemplo[] = [
  'codigoCorreto',
  'codigoComDefeito',
  'casos',
  'marcadores',
  'variaveisDeValor',
];

const NOMES: Record<CampoComExemplo, string> = {
  titulo: 'título',
  enunciado: 'enunciado',
  codigoCorreto: 'código correto',
  codigoComDefeito: 'código com defeito',
  casos: 'casos de teste',
  dicas: 'dicas',
  marcadores: 'marcadores',
  variaveisDeValor: 'variáveis de valor',
};

interface Props {
  formulario: FormularioDoExercicio;
  campo: CampoComExemplo;
  aoInserir: (formulario: FormularioDoExercicio) => void;
}

export function ExemploDoCampo({ formulario, campo, aoInserir }: Props) {
  const [aberto, setAberto] = useState(false);
  const nome = NOMES[campo];
  const exercicio = exercicioDeExemplo(formulario.estrutura, formulario.agrupamento);
  const texto = textoDoExemplo(formulario, campo);
  const vazio = campoVazio(formulario, campo);

  return (
    <div className="exemplo-do-campo">
      <button
        type="button"
        className="discreto"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        {aberto ? 'Esconder o exemplo' : `Ver exemplo de ${nome}`}
      </button>
      {aberto && (
        <div className="caixa-do-exemplo" role="note" aria-label={`Exemplo de ${nome}`}>
          <p className="origem-do-exemplo">Do exercício “{exercicio.titulo}”, do catálogo.</p>
          {texto ? (
            <p className={EM_CODIGO.includes(campo) ? 'texto-do-exemplo mono' : 'texto-do-exemplo'}>
              {texto}
            </p>
          ) : (
            <p>Esse exercício não tem {nome}: o campo pode ficar vazio.</p>
          )}
          {texto &&
            (vazio ? (
              <button type="button" onClick={() => aoInserir(inserirExemplo(formulario, campo))}>
                Usar este exemplo
              </button>
            ) : (
              <p className="rodape-painel">
                O campo já tem o seu texto: o exemplo fica só para consulta, e não o substitui.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
