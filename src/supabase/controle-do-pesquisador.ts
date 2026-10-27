import { supabase } from './cliente';

/**
 * As funções do painel de controle do pesquisador (D38), da migração 0005.
 *
 * Toda ação é uma função do banco que confere o papel por dentro; este módulo
 * só chama. A recusa não volta como erro: a função a grava na auditoria e
 * responde `ok: false` com o motivo, porque uma exceção desfaria a linha de
 * auditoria junto. Por isso cada chamada confere o `ok`, e não só o erro —
 * uma resposta sem `ok` não passa por sucesso.
 */

function cliente() {
  const c = supabase();
  if (!c) throw new Error('O banco não está configurado nesta instalação.');
  return c;
}

/**
 * Uma ação recusada pelo banco, com o motivo que ele deu. O texto para o
 * pesquisador é da tela (`textoDoMotivo`); aqui fica o motivo cru.
 */
export class RecusaDoPainel extends Error {
  readonly motivo: string | undefined;
  constructor(motivo: string | undefined) {
    super(`o banco recusou: ${motivo ?? 'sem motivo'}`);
    this.motivo = motivo;
  }
}

type Resposta = { ok?: boolean; motivo?: string } & Record<string, unknown>;

async function chamar(funcao: string, argumentos: Record<string, unknown>): Promise<Resposta> {
  const { data, error } = await cliente().rpc(funcao, argumentos);
  if (error) throw new Error(error.message);
  const resposta = (data ?? null) as Resposta | null;
  if (resposta?.ok !== true) throw new RecusaDoPainel(resposta?.motivo);
  return resposta;
}

export interface AplicacaoNoPainel {
  codigo: string;
  aberta: boolean;
  protegida: boolean;
  entradas: number;
  criadaEm: string;
  participantesA: number;
  participantesB: number;
  sessoes: number;
  respostas: number;
}

/** Só o pesquisador lista; para outra conta a função levanta erro (0005). */
export async function listarAplicacoes(): Promise<AplicacaoNoPainel[]> {
  const { data, error } = await cliente().rpc('listar_aplicacoes');
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as {
    codigo: string;
    aberta: boolean;
    protegida: boolean;
    entradas: number;
    criada_em: string;
    participantes_a: number;
    participantes_b: number;
    sessoes: number;
    respostas: number;
  }[];
  return linhas.map((l) => ({
    codigo: l.codigo,
    aberta: l.aberta,
    protegida: l.protegida,
    entradas: l.entradas,
    criadaEm: l.criada_em,
    // Contagens vêm de `count(*)`, que é bigint: o PostgREST as entrega como
    // número, mas um proxy no caminho poderia trazer texto.
    participantesA: Number(l.participantes_a),
    participantesB: Number(l.participantes_b),
    sessoes: Number(l.sessoes),
    respostas: Number(l.respostas),
  }));
}

/** Nasce protegida, a menos que seja de teste (0005). */
export async function criarAplicacao(codigo: string, teste: boolean): Promise<void> {
  await chamar('criar_aplicacao', { p_codigo: codigo, p_teste: teste });
}

export async function definirAplicacaoAberta(codigo: string, aberta: boolean): Promise<void> {
  await chamar('definir_aplicacao_aberta', { p_codigo: codigo, p_aberta: aberta });
}

/** Num sentido só: não há como desproteger pelo painel nem pelo banco (0005). */
export async function protegerAplicacao(codigo: string): Promise<void> {
  await chamar('proteger_aplicacao', { p_codigo: codigo });
}

export interface ResultadoDaLimpeza {
  respostas: number;
  sessoes: number;
  participantes: number;
  entradasAntes: number;
}

/**
 * Limpa uma aplicação de teste fechada. O código digitado vai junto, e o banco
 * o confere de novo: a tela liberar o botão não basta.
 */
export async function limparAplicacao(codigo: string, confirmacao: string): Promise<ResultadoDaLimpeza> {
  const r = await chamar('limpar_aplicacao', { p_codigo: codigo, p_confirmacao: confirmacao });
  return {
    respostas: Number(r.respostas),
    sessoes: Number(r.sessoes),
    participantes: Number(r.participantes),
    entradasAntes: Number(r.entradas_antes),
  };
}

export interface LinhaDaAuditoria {
  id: number;
  em: string;
  quem: string | null;
  acao: string;
  alvo: string | null;
  resultado: 'ok' | 'recusada' | 'falhou';
  detalhe: Record<string, unknown>;
}

/** As últimas linhas, da mais nova para a mais velha. Só o pesquisador lê (0005). */
export async function lerAuditoria(limite = 50): Promise<LinhaDaAuditoria[]> {
  const { data, error } = await cliente()
    .from('auditoria_do_pesquisador')
    .select('id, em, quem, acao, alvo, resultado, detalhe')
    .order('id', { ascending: false })
    .range(0, limite - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as LinhaDaAuditoria[];
}
