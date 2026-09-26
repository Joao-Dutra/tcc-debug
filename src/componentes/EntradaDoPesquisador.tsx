import { useState } from 'react';
import type { FormEvent } from 'react';
import { entrarComSenha } from '../supabase/identidade';

/**
 * Entrada do pesquisador, no painel de métricas e na revisão — as duas telas
 * ficam fora da navegação do participante (D11, D31).
 *
 * Só e-mail e senha, e sem vínculo: a conta de pesquisador é criada à mão no
 * Supabase, com o papel concedido lá. Vincular o anônimo deste aparelho a ela
 * traria para a conta do pesquisador as sessões de quem usou o aparelho antes.
 */
export function EntradaDoPesquisador() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (evento: FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    const resultado = await entrarComSenha(email, senha);
    setEnviando(false);
    setErro(resultado.erro);
    if (!resultado.erro) setSenha('');
  };

  return (
    <form className="entrada-pesquisador" onSubmit={(e) => void entrar(e)}>
      <label>
        E-mail
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Senha
        <input
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={enviando}>
        Entrar como pesquisador
      </button>
      {erro && <p className="erro">{erro}</p>}
    </form>
  );
}
