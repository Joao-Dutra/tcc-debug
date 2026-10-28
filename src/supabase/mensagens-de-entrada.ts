/**
 * O que a tela de entrada diz quando entrar dá errado (D39).
 *
 * Até aqui a tela repetia a frase do Supabase, em inglês e escrita para quem
 * programa: "Invalid login credentials". Aqui cada falha conhecida vira uma
 * frase que diz o que aconteceu e o que fazer, e aponta o campo, quando há um,
 * para a tela ligar a mensagem a ele.
 *
 * A decisão é pelo `code` do erro, e não pela mensagem: a mensagem muda de
 * uma versão da biblioteca para outra, o código é contrato. Sem módulo do
 * Supabase aqui, para o teste rápido alcançar a regra inteira.
 */

/** O que interessa de um erro de autenticação. */
export interface FalhaDeEntrada {
  code?: string;
  status?: number;
  name?: string;
}

export type CampoDaEntrada = 'email' | 'senha';

export interface MensagemDeEntrada {
  texto: string;
  /** O campo que precisa mudar; ausente quando a falha não é de um campo só. */
  campo?: CampoDaEntrada;
}

const POR_CODIGO: Record<string, MensagemDeEntrada> = {
  // Não diz qual dos dois está errado, de propósito: dizer que o e-mail existe
  // ajudaria quem tenta adivinhar contas.
  invalid_credentials: { texto: 'E-mail ou senha incorretos. Confira os dois e tente de novo.' },
  email_not_confirmed: {
    texto:
      'Esta conta ainda não foi confirmada. Abra o link que enviamos para o seu e-mail e entre de novo.',
    campo: 'email',
  },
  user_already_exists: {
    texto: 'Já existe uma conta com este e-mail. Use "Já tenho conta" para entrar.',
    campo: 'email',
  },
  email_exists: {
    texto: 'Já existe uma conta com este e-mail. Use "Já tenho conta" para entrar.',
    campo: 'email',
  },
  email_address_invalid: { texto: 'Este endereço de e-mail não é válido.', campo: 'email' },
  weak_password: {
    texto: 'A senha é fraca demais. Use ao menos 8 caracteres, misturando letras e números.',
    campo: 'senha',
  },
  over_request_rate_limit: {
    texto: 'Muitas tentativas seguidas. Espere um minuto antes de tentar de novo.',
  },
  over_email_send_rate_limit: {
    texto: 'Muitos e-mails enviados para este endereço. Espere alguns minutos antes de tentar de novo.',
    campo: 'email',
  },
  signup_disabled: { texto: 'A criação de contas está desligada. Fale com a equipe da pesquisa.' },
  provider_disabled: {
    texto: 'Esta forma de entrar está desligada. Use a outra, ou fale com a equipe da pesquisa.',
  },
  email_provider_disabled: {
    texto: 'A entrada por e-mail está desligada. Use o Google, ou fale com a equipe da pesquisa.',
  },
  user_banned: { texto: 'Esta conta está bloqueada. Fale com a equipe da pesquisa.' },
};

const SEM_REDE: MensagemDeEntrada = {
  texto: 'Não foi possível falar com o servidor. Confira a conexão e tente de novo.',
};

const DESCONHECIDA: MensagemDeEntrada = {
  texto: 'Não foi possível entrar. Tente de novo; se continuar, fale com a equipe da pesquisa.',
};

export function mensagemDeEntrada(falha: FalhaDeEntrada): MensagemDeEntrada {
  const conhecida = falha.code ? POR_CODIGO[falha.code] : undefined;
  if (conhecida) return conhecida;
  // A biblioteca devolve status 0 quando o pedido nem chegou ao servidor.
  if (falha.name === 'AuthRetryableFetchError' || falha.status === 0) return SEM_REDE;
  return DESCONHECIDA;
}
