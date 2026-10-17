import { useEffect, useState } from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/16/solid';
import { catalogo } from '../exercicios/catalogo';
import { ETAPAS } from '../estudo/percurso';
import { executar } from '../nucleo/executor';
import { conferirIdentidadeAnonima, situacaoDaAplicacao } from '../supabase/estudo';
import { Cabecalho } from './Cabecalho';

/**
 * A conferência de uma máquina do laboratório (D37): `#/estudo/<codigo>/conferir`.
 *
 * A rede institucional pode bloquear domínios, e descobrir isso com a turma
 * sentada custaria a aula. O pesquisador abre esta rota em cada máquina antes
 * e vê, item a item, o que passou.
 *
 * Fora do percurso, e sem efeito nele: não grava sessão, não abre exercício
 * com métricas e não consome vaga na alternância. A identidade anônima de
 * teste nasce num cliente à parte, e a do aparelho continua a mesma.
 */

type Resultado = { estado: 'conferindo' } | { estado: 'ok'; detalhe: string } | { estado: 'falha'; detalhe: string };

const CONFERINDO: Resultado = { estado: 'conferindo' };

const descrever = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function conferirBanco(aplicacao: string): Promise<Resultado> {
  try {
    const situacao = await situacaoDaAplicacao(aplicacao);
    if (situacao === 'aberta') return { estado: 'ok', detalhe: 'o banco respondeu, e a aplicação está aberta' };
    return {
      estado: 'falha',
      detalhe:
        situacao === 'encerrada'
          ? 'o banco respondeu, mas a aplicação está encerrada'
          : 'o banco respondeu, mas este código não está cadastrado',
    };
  } catch (e) {
    return { estado: 'falha', detalhe: descrever(e) };
  }
}

async function conferirIdentidade(): Promise<Resultado> {
  try {
    await conferirIdentidadeAnonima();
    return { estado: 'ok', detalhe: 'uma identidade anônima foi criada' };
  } catch (e) {
    return { estado: 'falha', detalhe: descrever(e) };
  }
}

/** O código do aquecimento, como ele abre: é o primeiro que a turma vai executar. */
async function conferirWorker(): Promise<Resultado> {
  const aquecimento = catalogo.find((e) => e.id === ETAPAS[0].exercicioId)!;
  const saida = await executar(aquecimento);
  if (saida.erro) return { estado: 'falha', detalhe: saida.erro };
  if (saida.instantaneos.length === 0) return { estado: 'falha', detalhe: 'a execução não produziu passos' };
  return { estado: 'ok', detalhe: `o aquecimento executou em ${saida.instantaneos.length} passos` };
}

export function ConferenciaDoEstudo({ aplicacao }: { aplicacao: string }) {
  const [rodada, setRodada] = useState(0);
  const [banco, setBanco] = useState<Resultado>(CONFERINDO);
  const [identidade, setIdentidade] = useState<Resultado>(CONFERINDO);
  const [worker, setWorker] = useState<Resultado>(CONFERINDO);

  useEffect(() => {
    let valendo = true;
    const depois = (definir: (r: Resultado) => void) => (r: Resultado) => valendo && definir(r);
    setBanco(CONFERINDO);
    setIdentidade(CONFERINDO);
    setWorker(CONFERINDO);
    void conferirBanco(aplicacao).then(depois(setBanco));
    void conferirIdentidade().then(depois(setIdentidade));
    void conferirWorker().then(depois(setWorker));
    return () => {
      valendo = false;
    };
  }, [aplicacao, rodada]);

  const itens = [
    { nome: 'Leitura do banco', resultado: banco },
    { nome: 'Criação de identidade anônima', resultado: identidade },
    { nome: 'Execução no Worker', resultado: worker },
  ];
  const terminou = itens.every((i) => i.resultado.estado !== 'conferindo');

  return (
    <div className="pagina area-do-estudo com-cabecalho">
      <Cabecalho semSaida titulo="Conferência da máquina">
        <p>
          Aplicação <code>{aplicacao}</code>. Esta página não grava sessão e não ocupa vaga no
          estudo.
        </p>
      </Cabecalho>
      <main className="corpo-do-estudo">
        <ul className="conferencia">
          {itens.map(({ nome, resultado }) => (
            <li key={nome} className={resultado.estado}>
              {resultado.estado === 'ok' && <CheckIcon className="icone" aria-hidden="true" />}
              {resultado.estado === 'falha' && <XMarkIcon className="icone" aria-hidden="true" />}
              <span className="nome">{nome}</span>
              <span className="veredito">
                {resultado.estado === 'conferindo' ? 'conferindo…' : resultado.estado === 'ok' ? 'ok' : 'falha'}
              </span>
              {resultado.estado !== 'conferindo' && <span className="detalhe">{resultado.detalhe}</span>}
            </li>
          ))}
        </ul>
        <button onClick={() => setRodada((n) => n + 1)} disabled={!terminou}>
          Conferir de novo
        </button>
      </main>
    </div>
  );
}
