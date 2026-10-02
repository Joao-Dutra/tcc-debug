import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabaseConfigurado } from '../supabase/cliente';
import { criarContaDeProfessor, entrarComGoogle, entrarComSenha } from '../supabase/identidade';
import { CAMINHO_AUTORIA } from './usar-rota';

/**
 * Entrada do professor: Google ou e-mail e senha, e nenhum dos dois vincula ao
 * anônimo do aparelho (D29) — o professor entra numa conta própria.
 *
 * Mora fora da área do professor desde que a entrada ganhou tela própria
 * (D32): é a mesma entrada lá e na área, para quem chega a ela pelo endereço.
 */

/**
 * O "G" do Google, nas quatro cores da marca, como o padrão do botão de
 * entrada com Google pede. Desenhado aqui, e não carregado de fora (D13).
 */
function IconeDoGoogle() {
  return (
    <svg className="icone-google" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface Props {
  /**
   * O que fazer quando a conta abre. Na tela de entrada, ir para a área; na
   * própria área, nada — ela muda sozinha quando a identidade muda.
   */
  aoEntrar?: () => void;
}

export function EntradaDoProfessor({ aoEntrar }: Props) {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comBanco = supabaseConfigurado();

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    setAviso(null);
    const resultado =
      modo === 'entrar'
        ? await entrarComSenha(email, senha)
        : await criarContaDeProfessor(email, senha);
    setErro(resultado.erro);
    setEnviando(false);
    if (resultado.erro) return;
    setSenha('');
    if ('confirmarPorEmail' in resultado && resultado.confirmarPorEmail) {
      setAviso(
        `Enviamos um link de confirmação para ${email}. Depois de confirmar, entre aqui com ` +
          'a senha.'
      );
      setModo('entrar');
      return;
    }
    aoEntrar?.();
  };

  const comGoogle = async () => {
    setErro(null);
    // Volta para a área depois do Google: o código de retorno chega na
    // consulta, e a rota fica no hash.
    const resultado = await entrarComGoogle(CAMINHO_AUTORIA);
    setErro(resultado.erro);
  };

  return (
    <div className="entrada-do-professor">
      {!comBanco && (
        <p className="rodape-painel">
          A entrada do professor guarda a conta no banco, e o banco não está configurado
          nesta instalação.
        </p>
      )}
      {/* Sem banco, os campos ficam à vista e desligados: a tela continua
          dizendo como se entra, sem prometer uma entrada que não funciona. */}
      <fieldset className="campos-da-entrada" disabled={!comBanco}>
        <button type="button" className="botao-google" onClick={() => void comGoogle()}>
          <IconeDoGoogle />
          Entrar com Google
        </button>
        <p className="separador-da-entrada" aria-hidden="true">
          <span>ou</span>
        </p>
        <form className="entrada-conta" onSubmit={(e) => void enviar(e)}>
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
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <button type="submit" disabled={enviando}>
            {modo === 'entrar' ? 'Entrar com e-mail' : 'Criar conta'}
          </button>
          <button
            type="button"
            className="discreto"
            onClick={() => {
              setModo(modo === 'entrar' ? 'criar' : 'entrar');
              setErro(null);
            }}
          >
            {modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
          </button>
          {erro && <p className="erro">{erro}</p>}
          {aviso && <p className="aviso-conta">{aviso}</p>}
        </form>
      </fieldset>
    </div>
  );
}
