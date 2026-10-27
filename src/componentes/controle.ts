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
 * O motivo de cada recusa das funções da 0005, como o pesquisador o lê. O
 * teste confere que todo motivo que a migração devolve tem texto aqui.
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
