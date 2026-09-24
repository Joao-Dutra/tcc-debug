/**
 * Onde duas versões do mesmo programa divergem, e se a diferença é um defeito
 * só (D30).
 *
 * `linhaDoDefeito` é o alvo da declaração de localização (D7). Escrita à mão,
 * ela sai do lugar em silêncio a cada edição no código; derivada da comparação
 * entre as duas versões, ela não tem como sair. E é esta mesma conta que a área
 * de autoria usa para não pedir a linha ao professor — o catálogo e a
 * submissão obedecem à mesma regra por construção.
 *
 * **A regra.** O que importa não é quantas linhas diferem, e sim que o defeito
 * seja um só, coeso e localizável numa linha que se possa apontar:
 *
 * - **uma linha alterada**; ou
 * - **uma linha fora do lugar**: o trecho que difere tem as mesmas linhas nas
 *   duas versões, e só uma delas mudou de posição. A troca entre duas vizinhas
 *   — `lista-inserir-depois` — é o caso mais comum.
 *
 * Tudo o mais é recusado, com a razão.
 */

export type Divergencia =
  | {
      tipo: 'linha-alterada' | 'linha-fora-do-lugar';
      /** A linha declarada: a primeira das aceitas. */
      linha: number;
      /**
       * Onde apontar conta como localizar o defeito. Uma só na linha alterada.
       * Na linha fora do lugar, a que mudou de posição — e, na troca entre
       * duas vizinhas, as duas, porque mover qualquer uma delas produz a
       * mesma troca: apontar a segunda também é achar o defeito.
       */
      linhasAceitas: number[];
    }
  | {
      tipo: 'recusada';
      /** Explicação para quem escreveu o exercício, em uma frase. */
      motivo: string;
      /** As linhas que diferem, para a explicação apontar onde olhar. */
      linhas: number[];
    };

/**
 * Linhas comparadas sem o recuo: em JavaScript ele não muda nada, e um espaço a
 * mais numa linha qualquer não pode virar um segundo defeito.
 */
const normalizar = (linha: string) => linha.trim();

function listaDeLinhas(linhas: number[]): string {
  if (linhas.length <= 1) return `a linha ${linhas[0]}`;
  const ultimas = linhas.slice(-1)[0];
  return `as linhas ${linhas.slice(0, -1).join(', ')} e ${ultimas}`;
}

/** Mesmas linhas, contando repetições — o que uma reordenação preserva. */
function mesmoConjunto(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const contagem = new Map<string, number>();
  for (const x of a) contagem.set(x, (contagem.get(x) ?? 0) + 1);
  for (const x of b) {
    const n = contagem.get(x) ?? 0;
    if (n === 0) return false;
    contagem.set(x, n - 1);
  }
  return true;
}

/**
 * As posições, em `destino`, das linhas de `origem` que, movidas sozinhas para
 * outro lugar, transformam `origem` em `destino`. Vazio quando nenhuma
 * mudança de lugar de uma linha só explica a diferença.
 */
function linhasMovidas(origem: string[], destino: string[]): number[] {
  const movidas = new Set<number>();
  for (let de = 0; de < origem.length; de++) {
    const sem = [...origem.slice(0, de), ...origem.slice(de + 1)];
    for (let para = 0; para < origem.length; para++) {
      if (para === de) continue;
      const tentativa = [...sem.slice(0, para), origem[de], ...sem.slice(para)];
      if (tentativa.every((linha, i) => linha === destino[i])) movidas.add(para);
    }
  }
  return [...movidas].sort((a, b) => a - b);
}

export function analisarDivergencia(correto: string, comDefeito: string): Divergencia {
  const a = correto.split('\n').map(normalizar);
  const b = comDefeito.split('\n').map(normalizar);

  if (a.length !== b.length) {
    return {
      tipo: 'recusada',
      motivo:
        `As versões têm tamanhos diferentes (${a.length} e ${b.length} linhas). O defeito troca ` +
        'o conteúdo de uma linha, e não o número delas: com tamanhos diferentes, as linhas ' +
        'deixam de se corresponder, e uma instrução que falta não tem linha para o estudante ' +
        'apontar.',
      linhas: [],
    };
  }

  const divergentes: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) divergentes.push(i + 1);

  if (divergentes.length === 0) {
    return {
      tipo: 'recusada',
      motivo: 'As duas versões são iguais: não há defeito implantado.',
      linhas: [],
    };
  }

  const linhaEmBranco = (linha: number) => b[linha - 1] === '';

  if (divergentes.length === 1) {
    const [linha] = divergentes;
    if (linhaEmBranco(linha)) {
      return {
        tipo: 'recusada',
        motivo:
          `A linha ${linha} está em branco no código com defeito: o estudante não tem o que ` +
          'apontar ali.',
        linhas: divergentes,
      };
    }
    return { tipo: 'linha-alterada', linha, linhasAceitas: [linha] };
  }

  // Várias linhas diferem: só vale se o trecho entre a primeira e a última for
  // o mesmo conjunto de linhas, com uma só mudando de lugar.
  const inicio = divergentes[0];
  const fim = divergentes[divergentes.length - 1];
  const trechoCorreto = a.slice(inicio - 1, fim);
  const trechoComDefeito = b.slice(inicio - 1, fim);

  const movidas = mesmoConjunto(trechoCorreto, trechoComDefeito)
    ? linhasMovidas(trechoCorreto, trechoComDefeito).map((i) => inicio + i)
    : [];

  if (movidas.length === 0) {
    return {
      tipo: 'recusada',
      motivo:
        `As versões diferem em ${listaDeLinhas(divergentes)}, que não são as mesmas linhas ` +
        'com uma delas fora do lugar: parece haver mais de um defeito. Cada exercício tem um ' +
        'só, para a localização ter uma resposta.',
      linhas: divergentes,
    };
  }

  const aceitas = movidas.filter((linha) => !linhaEmBranco(linha));
  if (aceitas.length === 0) {
    return {
      tipo: 'recusada',
      motivo:
        'A linha que mudou de lugar está em branco: mover uma linha em branco não muda o ' +
        'programa.',
      linhas: divergentes,
    };
  }
  return { tipo: 'linha-fora-do-lugar', linha: aceitas[0], linhasAceitas: aceitas };
}
