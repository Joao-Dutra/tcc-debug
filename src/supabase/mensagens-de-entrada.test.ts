import { describe, expect, it } from 'vitest';
import { mensagemDeEntrada } from './mensagens-de-entrada';

describe('as mensagens da entrada', () => {
  it('credenciais erradas não dizem qual dos dois está errado', () => {
    const m = mensagemDeEntrada({ code: 'invalid_credentials', status: 400 });
    expect(m.texto).toBe('E-mail ou senha incorretos. Confira os dois e tente de novo.');
    expect(m.campo).toBeUndefined();
  });

  it('cada falha de um campo aponta o campo', () => {
    expect(mensagemDeEntrada({ code: 'weak_password' }).campo).toBe('senha');
    expect(mensagemDeEntrada({ code: 'user_already_exists' }).campo).toBe('email');
    expect(mensagemDeEntrada({ code: 'email_address_invalid' }).campo).toBe('email');
    expect(mensagemDeEntrada({ code: 'email_not_confirmed' }).campo).toBe('email');
  });

  it('sem rede, diz que não falou com o servidor', () => {
    expect(mensagemDeEntrada({ name: 'AuthRetryableFetchError', status: 0 }).texto).toMatch(
      /Não foi possível falar com o servidor/
    );
  });

  it('o desconhecido vira uma frase em português, e nunca a do Supabase', () => {
    const m = mensagemDeEntrada({ code: 'algo_que_nao_existe', status: 500 });
    expect(m.texto).toMatch(/^Não foi possível entrar/);
  });

  it('nenhuma mensagem fica em inglês', () => {
    for (const code of [
      'invalid_credentials',
      'email_not_confirmed',
      'user_already_exists',
      'email_exists',
      'email_address_invalid',
      'weak_password',
      'over_request_rate_limit',
      'over_email_send_rate_limit',
      'signup_disabled',
      'provider_disabled',
      'email_provider_disabled',
      'user_banned',
    ]) {
      expect(mensagemDeEntrada({ code }).texto, code).not.toMatch(/\b(the|invalid|password|user)\b/i);
    }
  });
});
