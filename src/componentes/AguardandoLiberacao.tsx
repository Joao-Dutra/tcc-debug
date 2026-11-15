/**
 * O aviso de quem entrou numa conta que ainda não tem o papel (D29, D39).
 *
 * Entrar nunca concede papel: quem o dá é a equipe da pesquisa. O aviso é o
 * mesmo nas duas portas — a área do professor e o acesso da pesquisa —, e só
 * a frase do que a conta ainda não pode fazer muda com a porta, para não
 * dizer a quem pediu acesso de pesquisa que ele não pode escrever exercícios.
 */

export type PapelPedido = 'professor' | 'pesquisador';

const O_QUE_FALTA: Record<PapelPedido, string> = {
  professor:
    'A sua conta foi criada, mas ainda não pode escrever exercícios. A aprovação é feita ' +
    'pela equipe da pesquisa, uma conta de cada vez, para que só professores convidados ' +
    'criem exercícios para os alunos.',
  pesquisador:
    'A sua conta entrou, mas ainda não tem acesso aos dados nem ao painel da pesquisa. A ' +
    'liberação é feita pela equipe da pesquisa, uma conta de cada vez, para que só os ' +
    'pesquisadores vejam o que os participantes fizeram.',
};

/**
 * O professor lê que o cadastro dele está na fila de aprovação (D45): desde a
 * 0007 o pesquisador o vê no painel e aprova por lá. O acesso da pesquisa
 * continua "aguardando liberação", porque esse papel segue sendo dado à mão.
 */
const TITULO: Record<PapelPedido, string> = {
  professor: 'Seu cadastro está aguardando aprovação',
  pesquisador: 'Aguardando liberação',
};

const DEPOIS: Record<PapelPedido, string> = {
  professor: 'Quando o seu cadastro for aprovado, recarregue esta página.',
  pesquisador: 'Quando a sua conta for liberada, recarregue esta página.',
};

export function AguardandoLiberacao({ papel }: { papel: PapelPedido }) {
  return (
    <section className="painel aguardando-liberacao" role="status">
      <h2>{TITULO[papel]}</h2>
      <p>{O_QUE_FALTA[papel]}</p>
      <p className="rodape-painel">{DEPOIS[papel]}</p>
    </section>
  );
}
