import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { supabaseConfigurado } from '../supabase/cliente';
import {
  criarContaDeProfessor,
  entrarComGoogle,
  entrarComSenha,
  sair,
} from '../supabase/identidade';
import { lerMeusExercicios } from '../supabase/exercicios-de-professor';
import { estadoDaArea } from './estado-da-area';
import { useIdentidade } from './usar-identidade';
import { CAMINHO_AUTORIA, CAMINHO_INICIAL } from './usar-rota';
import type { ExercicioDeProfessor, SituacaoDoExercicio } from '../supabase/exercicios-de-professor';
import type { Identidade } from '../supabase/identidade';

/**
 * A área do professor (D29, D31).
 *
 * Entrar não concede nada: o perfil nasce como participante, e o papel de
 * professor é dado à mão, no banco — é o que garante que só pessoas
 * selecionadas escrevam exercícios. Por isso a tela tem quatro estados, e o de
 * quem entrou sem o papel diz com clareza que aguarda liberação, em vez de
 * mostrar uma área vazia que pareceria defeito.
 *
 * A tela escolhe o que mostrar pelo papel lido de `perfis`, mas não é ela que
 * protege nada: uma interface adulterada fingindo o papel esbarra no RLS ao
 * tentar criar o primeiro rascunho.
 */

function Moldura({ children, identidade }: { children: ReactNode; identidade?: Identidade }) {
  const comConta = identidade && (identidade.forma === 'google' || identidade.forma === 'email');
  return (
    <div className="pagina autoria">
      <header>
        <a className="voltar" href={CAMINHO_INICIAL}>
          <ArrowLeftIcon className="icone" aria-hidden="true" />
          Início
        </a>
        <h1>Área do professor</h1>
        {comConta && (
          <div className="conta-aberta">
            <p className="rodape-painel">
              Conta: {identidade.email ?? identidade.usuarioId}. Enquanto ela estiver aberta, o
              que for feito como aluno neste navegador é gravado sob ela — saia antes de
              entregar o aparelho a um aluno.
            </p>
            <button onClick={() => void sair()}>Sair</button>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

/**
 * Google ou e-mail e senha, e nenhum dos dois vincula ao anônimo do aparelho
 * (D29): o professor entra numa conta própria.
 */
function EntradaDoProfessor() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    if (!resultado.erro && 'confirmarPorEmail' in resultado && resultado.confirmarPorEmail) {
      setAviso(
        `Enviamos um link de confirmação para ${email}. Depois de confirmar, entre aqui com ` +
          'a senha.'
      );
      setModo('entrar');
    }
    setEnviando(false);
    if (!resultado.erro) setSenha('');
  };

  const comGoogle = async () => {
    setErro(null);
    // Volta para cá depois do Google: o código de retorno chega na consulta, e
    // a rota fica no hash.
    const resultado = await entrarComGoogle(CAMINHO_AUTORIA);
    setErro(resultado.erro);
  };

  return (
    <section className="painel">
      <h2>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h2>
      <p className="rodape-painel">
        A área é para professores convidados. Qualquer pessoa pode entrar, mas a conta só
        passa a escrever exercícios depois de liberada pela equipe da pesquisa.
      </p>
      <p>
        <button className="primario" onClick={() => void comGoogle()}>
          Entrar com Google
        </button>
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
    </section>
  );
}

const ROTULOS_DA_SITUACAO: Record<SituacaoDoExercicio, string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  publicado: 'Publicado',
  retirado: 'Retirado',
};

/** Os exercícios do professor, por situação. */
function ExerciciosDoProfessor({ autorId }: { autorId: string }) {
  const [exercicios, setExercicios] = useState<ExercicioDeProfessor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let valida = true;
    lerMeusExercicios(autorId)
      .then((lidos) => valida && setExercicios(lidos))
      .catch((e: unknown) => valida && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      valida = false;
    };
  }, [autorId]);

  if (erro) return <p className="erro">A leitura dos seus exercícios falhou ({erro}).</p>;
  if (exercicios === null) return <p className="rodape-painel">Lendo os seus exercícios…</p>;

  return (
    <section className="painel">
      <h2>Seus exercícios</h2>
      {exercicios.length === 0 ? (
        <p className="rodape-painel">Você ainda não escreveu nenhum exercício.</p>
      ) : (
        <ul className="lista-de-exercicios">
          {exercicios.map((e) => (
            <li key={e.id}>
              <span className={`situacao ${e.situacao}`}>{ROTULOS_DA_SITUACAO[e.situacao]}</span>
              <span className="titulo-do-exercicio">{e.conteudo.titulo || 'Sem título'}</span>
              {e.situacao === 'rascunho' && e.comentarioDaRevisao && (
                <span className="comentario-da-revisao">
                  Devolvido pela revisão: {e.comentarioDaRevisao}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AreaDoProfessor() {
  const identidade = useIdentidade();
  const estado = estadoDaArea(identidade, supabaseConfigurado());

  if (estado === 'sem-banco') {
    return (
      <Moldura>
        <p className="rodape-painel">
          A área do professor guarda os exercícios no banco, e o banco não está configurado
          nesta instalação.
        </p>
      </Moldura>
    );
  }

  if (estado === 'entrar') {
    // Anônimo, ou sem identidade ainda. A falha da entrada anônima não impede
    // nada aqui: o professor entra na conta dele.
    return (
      <Moldura>
        <EntradaDoProfessor />
      </Moldura>
    );
  }

  if (estado === 'conferindo') {
    return (
      <Moldura identidade={identidade}>
        <p className="rodape-painel">Conferindo o papel desta conta…</p>
      </Moldura>
    );
  }

  if (estado === 'professor') {
    return (
      <Moldura identidade={identidade}>
        <ExerciciosDoProfessor autorId={identidade.usuarioId as string} />
      </Moldura>
    );
  }

  if (estado === 'pesquisador') {
    return (
      <Moldura identidade={identidade}>
        <section className="painel">
          <h2>Esta conta é de pesquisador</h2>
          <p className="rodape-painel">
            O pesquisador revisa e publica os exercícios dos professores, mas não os escreve
            por aqui: os exercícios da pesquisa ficam no catálogo, no repositório, com a suíte
            de testes inteira.
          </p>
        </section>
      </Moldura>
    );
  }

  return (
    <Moldura identidade={identidade}>
      <section className="painel aguardando-liberacao" role="status">
        <h2>Aguardando liberação</h2>
        <p>
          A sua conta foi criada, mas ainda não pode escrever exercícios. A liberação é feita
          pela equipe da pesquisa, uma conta de cada vez, para que só professores convidados
          criem exercícios para os alunos.
        </p>
        <p className="rodape-painel">
          Quando a sua conta for liberada, recarregue esta página.
        </p>
      </section>
    </Moldura>
  );
}
