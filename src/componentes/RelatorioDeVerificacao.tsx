import { CheckIcon, XMarkIcon } from '@heroicons/react/16/solid';
import type { RelatorioDaVerificacao } from '../nucleo/verificacao-do-exercicio';

/**
 * O relatório da verificação de um exercício (D31), item a item.
 *
 * Cada recusa vem com a razão e com o que fazer — o professor não tem a suíte
 * do catálogo para ler, e um "não passou" sem explicação o deixaria
 * adivinhando. O estilo (D17) aparece à parte, porque avisa e não recusa.
 */
export function RelatorioDeVerificacao({ relatorio }: { relatorio: RelatorioDaVerificacao }) {
  return (
    <div className="relatorio">
      <p className={relatorio.aprovado ? 'veredito aprovado' : 'veredito recusado'}>
        {relatorio.aprovado
          ? 'Passou na verificação.'
          : 'Não passou na verificação. Veja abaixo o que corrigir.'}
      </p>
      <ul className="casos itens-da-verificacao">
        {relatorio.itens.map((item) => (
          <li key={item.chave} className={item.aprovado ? 'passou' : 'falhou'}>
            {item.aprovado ? (
              <CheckIcon className="icone" aria-hidden="true" />
            ) : (
              <XMarkIcon className="icone" aria-hidden="true" />
            )}
            <span>
              <span className="so-leitor">{item.aprovado ? 'passou: ' : 'não passou: '}</span>
              {item.titulo}
            </span>
            <span className="detalhe-da-verificacao">{item.explicacao}</span>
          </li>
        ))}
      </ul>

      {relatorio.avisos.length > 0 && (
        <div className="avisos-da-verificacao">
          <h3>Avisos</h3>
          <ul>
            {relatorio.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </div>
      )}

      {relatorio.avisosDeEstilo.length > 0 && (
        <div className="avisos-da-verificacao">
          <h3>Estilo: o que só existe em JavaScript</h3>
          <p className="rodape-painel">
            Não impede o envio, mas o aluno estudou em Java ou em C, e tropeçar na sintaxe mede
            desconhecimento da linguagem em vez de depuração (D17).
          </p>
          <ul>
            {relatorio.avisosDeEstilo.map(({ versao, aviso }) => (
              <li key={`${versao}-${aviso.linha}-${aviso.construcao}`}>
                Versão {versao}, linha {aviso.linha}: {aviso.construcao} — {aviso.sugestao}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
