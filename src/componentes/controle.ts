/**
 * As regras da tela do painel de controle do pesquisador (D38), sem React.
 *
 * A tela consulta estas regras para avisar antes; quem decide é o banco. O
 * código da aplicação e a confirmação digitada são conferidos de novo nas
 * funções da 0005, e o teste deste módulo compara a regra daqui com a de lá:
 * uma tela que aceitasse o que o banco recusa só adiaria o erro.
 */

/** A regra do `check` de `aplicacoes_do_estudo` (0004), repetida na 0005. */
export const REGRA_DO_CODIGO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const LIMITE_DO_CODIGO = 60;

/** O intervalo que `definir_limite_de_participantes` aceita (0006). */
export const LIMITE_MINIMO_DE_PARTICIPANTES = 1;
export const LIMITE_MAXIMO_DE_PARTICIPANTES = 1000;

/**
 * O limite digitado pelo pesquisador, como número, ou nulo se não serve. Só
 * inteiros no intervalo do banco: o resto seria recusado lá, e aqui a tela
 * diz antes.
 */
export function limiteDigitado(texto: string): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto.trim());
  return n >= LIMITE_MINIMO_DE_PARTICIPANTES && n <= LIMITE_MAXIMO_DE_PARTICIPANTES ? n : null;
}

/** O que há de errado com o código, para a tela dizer antes de enviar; nulo se nada. */
export function problemaDoCodigo(codigo: string): string | null {
  if (codigo === '') return 'Escreva o código da aplicação.';
  if (codigo.length > LIMITE_DO_CODIGO) return `O código tem no máximo ${LIMITE_DO_CODIGO} caracteres.`;
  if (!REGRA_DO_CODIGO.test(codigo)) {
    return 'Só letras minúsculas sem acento e algarismos, em partes separadas por um hífen — como aeds1-2026.';
  }
  return null;
}

/**
 * A confirmação digitada confere com o alvo. Exata, sem aparar espaço nem
 * ignorar maiúscula: é a mesma comparação que a função do banco faz, e um
 * botão liberado que o banco depois recusa ensinaria a não confiar no botão.
 */
export function confirmacaoConfere(digitado: string, alvo: string): boolean {
  return alvo !== '' && digitado === alvo;
}

/**
 * O motivo de cada recusa das funções da 0005 e da 0006, como o pesquisador o
 * lê. O teste confere que todo motivo que as migrações devolvem tem texto aqui.
 */
export const TEXTOS_DOS_MOTIVOS: Record<string, string> = {
  'so-pesquisador': 'Só a conta de pesquisador pode fazer isto.',
  'codigo-invalido': 'O código não segue a regra: letras minúsculas, algarismos e hífens.',
  'codigo-existente': 'Já existe uma aplicação com este código.',
  'parametro-invalido': 'O pedido chegou incompleto ao banco.',
  'aplicacao-inexistente': 'A aplicação não existe.',
  'aplicacao-protegida': 'A aplicação é protegida: o painel nunca a limpa.',
  'aplicacao-aberta': 'Feche a aplicação antes de limpar.',
  'confirmacao-nao-confere': 'O código digitado não confere com o da aplicação.',
  'sem-linha-da-coleta': 'O interruptor da coleta não está no banco: a migração 0003 rodou?',
  'nao-publicado': 'O exercício não está mais publicado.',
  'limite-invalido': 'O limite de participantes vai de 1 a 1000.',
  'abaixo-das-entradas':
    'O limite não pode ficar abaixo de quem já entrou. Para não receber mais ninguém, feche a aplicação.',
  'conta-inexistente': 'A conta não existe mais.',
  'conta-anonima': 'Conta anônima de estudante não recebe papel.',
  'e-pesquisador': 'A conta é de pesquisador, e este painel não mexe nesse papel.',
  'ja-e-professor': 'A conta já é de professor.',
  'nao-e-professor': 'A conta não é de professor.',
  'a-propria-conta': 'Você não pode mexer no papel da sua própria conta.',
  'papel-mudou': 'O papel da conta mudou enquanto você olhava. Recarregue a lista.',
};

export function textoDoMotivo(motivo: string | undefined): string {
  if (motivo && TEXTOS_DOS_MOTIVOS[motivo]) return TEXTOS_DOS_MOTIVOS[motivo];
  return 'O banco recusou o pedido.';
}

/** O que a tela escreve de uma falha: o motivo, quando o banco deu um; senão, a mensagem. */
export function mensagemDaFalha(falha: unknown): string {
  if (falha instanceof Error && 'motivo' in falha) {
    return textoDoMotivo((falha as Error & { motivo?: string }).motivo);
  }
  return falha instanceof Error ? falha.message : String(falha);
}

/**
 * As duas listas da seção "Professores" (D45): quem aguarda aprovação e quem
 * já é professor. A conta de pesquisador não entra em nenhuma — o painel não
 * dá nem tira esse papel, e listá-la com um botão ao lado convidaria ao
 * engano. A ordem de cada lista é a que veio do banco.
 */
export function separarCadastros<C extends { papel: string }>(
  cadastros: readonly C[]
): { aguardando: C[]; professores: C[] } {
  return {
    aguardando: cadastros.filter((c) => c.papel === 'participante'),
    professores: cadastros.filter((c) => c.papel === 'professor'),
  };
}
