import type {
  ItemDaVerificacao,
  RelatorioDaVerificacao,
} from './verificacao-do-exercicio';

/**
 * O relatório que o professor gravou ao enviar, lido na revisão (D31).
 *
 * Quem escreveu o relatório foi o navegador do professor, e um acesso direto à
 * API escreve o que quiser na coluna. Por isso ele só serve de referência do
 * que o professor viu: quem decide a publicação é a verificação refeita no
 * navegador do pesquisador. Este módulo faz as duas coisas que a revisão
 * precisa com ele — ler sem confiar e dizer onde diverge do refeito.
 *
 * Vive no núcleo porque é regra pura, sem rede e sem React, e porque a
 * sinalização da divergência é a parte que não pode falhar calada.
 */

const CHAVES: readonly ItemDaVerificacao['chave'][] = [
  'modelo',
  'defeito-unico',
  'sintaxe',
  'termina',
  'correto-passa',
  'defeito-quebra',
  'nomes',
  'quadro-denuncia',
];

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function itemValido(valor: unknown): ItemDaVerificacao | null {
  if (!ehObjeto(valor)) return null;
  const { chave, titulo, aprovado, explicacao } = valor;
  if (!CHAVES.includes(chave as ItemDaVerificacao['chave'])) return null;
  if (!ehTexto(titulo) || typeof aprovado !== 'boolean' || !ehTexto(explicacao)) return null;
  return { chave: chave as ItemDaVerificacao['chave'], titulo, aprovado, explicacao };
}

function derivadoValido(valor: unknown): RelatorioDaVerificacao['derivado'] | null {
  if (!ehObjeto(valor)) return null;
  const { linhaDoDefeito, linhasAceitas } = valor;
  if (!Number.isInteger(linhaDoDefeito)) return null;
  if (!Array.isArray(linhasAceitas) || !linhasAceitas.every((n) => Number.isInteger(n))) {
    return null;
  }
  return { linhaDoDefeito: linhaDoDefeito as number, linhasAceitas: linhasAceitas as number[] };
}

function avisoDeEstiloValido(valor: unknown): RelatorioDaVerificacao['avisosDeEstilo'][number] | null {
  if (!ehObjeto(valor) || (valor.versao !== 'com defeito' && valor.versao !== 'correta')) return null;
  const aviso = valor.aviso;
  if (!ehObjeto(aviso)) return null;
  if (!Number.isInteger(aviso.linha) || !ehTexto(aviso.construcao) || !ehTexto(aviso.sugestao)) {
    return null;
  }
  return {
    versao: valor.versao,
    aviso: { linha: aviso.linha as number, construcao: aviso.construcao, sugestao: aviso.sugestao },
  };
}

/**
 * O relatório gravado, se tiver a forma de um relatório; nulo se não tiver.
 *
 * Tudo ou nada: um relatório com um item malformado não é mostrado pela
 * metade, porque a metade que sobrasse pareceria o relatório inteiro.
 */
export function relatorioGravadoValido(valor: unknown): RelatorioDaVerificacao | null {
  if (!ehObjeto(valor)) return null;
  const { aprovado, itens, avisos, avisosDeEstilo, derivado } = valor;
  if (typeof aprovado !== 'boolean') return null;
  if (!Array.isArray(itens) || !Array.isArray(avisos) || !avisos.every(ehTexto)) return null;
  if (!Array.isArray(avisosDeEstilo)) return null;

  const itensLidos = itens.map(itemValido);
  if (itensLidos.some((i) => i === null)) return null;
  const estiloLido = avisosDeEstilo.map(avisoDeEstiloValido);
  if (estiloLido.some((a) => a === null)) return null;
  const derivadoLido = derivado === undefined ? undefined : derivadoValido(derivado);
  if (derivadoLido === null) return null;

  return {
    aprovado,
    itens: itensLidos as ItemDaVerificacao[],
    avisos,
    avisosDeEstilo: estiloLido as RelatorioDaVerificacao['avisosDeEstilo'],
    ...(derivadoLido ? { derivado: derivadoLido } : {}),
  };
}

export type ConferenciaDoRelatorio =
  /** O gravado diz o mesmo que o refeito, nos pontos que decidem. */
  | { tipo: 'confere'; gravado: RelatorioDaVerificacao }
  | { tipo: 'diverge'; gravado: RelatorioDaVerificacao; diferencas: string[] }
  /**
   * Sem relatório. A tela do professor não envia sem ele, então a ausência já
   * é sinal de que o envio não passou por ela.
   */
  | { tipo: 'ausente' }
  /** Há algo gravado, mas sem a forma de um relatório. */
  | { tipo: 'ilegivel' };

function mesmasLinhas(a: number[], b: number[]): boolean {
  const ordenar = (l: number[]) => [...l].sort((x, y) => x - y);
  const [oa, ob] = [ordenar(a), ordenar(b)];
  return oa.length === ob.length && oa.every((n, i) => n === ob[i]);
}

const descreverDerivado = (d: RelatorioDaVerificacao['derivado']) =>
  d === undefined
    ? 'nenhuma'
    : d.linhasAceitas.length > 1
      ? `linhas ${d.linhasAceitas.join(' e ')}`
      : `linha ${d.linhaDoDefeito}`;

/**
 * Onde o gravado diverge do refeito.
 *
 * Compara o que decide — o veredito, o resultado de cada item, a linha do
 * defeito — e a contagem dos avisos de estilo, que também sai do código. As
 * explicações ficam de fora: trazem mensagens do motor de JavaScript, que
 * mudam de um navegador para outro sem que nada tenha sido forjado.
 *
 * Divergir não diz que houve fraude: o verificador pode ter mudado entre o
 * envio e a revisão. Diz que o pesquisador deve olhar, e nada mais — a
 * publicação continua decidida só pelo refeito.
 */
export function conferirRelatorioGravado(
  valor: unknown,
  refeito: RelatorioDaVerificacao
): ConferenciaDoRelatorio {
  if (valor === null || valor === undefined) return { tipo: 'ausente' };
  const gravado = relatorioGravadoValido(valor);
  if (!gravado) return { tipo: 'ilegivel' };

  const diferencas: string[] = [];
  if (gravado.aprovado !== refeito.aprovado) {
    diferencas.push(
      `O gravado diz que o exercício ${gravado.aprovado ? 'passou' : 'não passou'}; ` +
        `refeito aqui, ${refeito.aprovado ? 'passou' : 'não passou'}.`
    );
  }

  for (const item of refeito.itens) {
    const doGravado = gravado.itens.find((i) => i.chave === item.chave);
    if (!doGravado) {
      diferencas.push(`O gravado não tem o item “${item.titulo}”.`);
    } else if (doGravado.aprovado !== item.aprovado) {
      diferencas.push(
        `“${item.titulo}”: o gravado diz que ${doGravado.aprovado ? 'passou' : 'não passou'}; ` +
          `refeito aqui, ${item.aprovado ? 'passou' : 'não passou'}.`
      );
    }
  }
  for (const item of gravado.itens) {
    if (!refeito.itens.some((i) => i.chave === item.chave)) {
      diferencas.push(`O gravado tem um item que a verificação daqui não tem: “${item.titulo}”.`);
    }
  }

  const g = gravado.derivado;
  const r = refeito.derivado;
  const mesmoDerivado =
    (g === undefined && r === undefined) ||
    (g !== undefined &&
      r !== undefined &&
      g.linhaDoDefeito === r.linhaDoDefeito &&
      mesmasLinhas(g.linhasAceitas, r.linhasAceitas));
  if (!mesmoDerivado) {
    diferencas.push(
      `Linha do defeito: o gravado diz ${descreverDerivado(g)}; refeito aqui, ${descreverDerivado(r)}.`
    );
  }

  if (gravado.avisosDeEstilo.length !== refeito.avisosDeEstilo.length) {
    diferencas.push(
      `Avisos de estilo: ${gravado.avisosDeEstilo.length} no gravado, ` +
        `${refeito.avisosDeEstilo.length} refeito aqui.`
    );
  }

  return diferencas.length === 0
    ? { tipo: 'confere', gravado }
    : { tipo: 'diverge', gravado, diferencas };
}
