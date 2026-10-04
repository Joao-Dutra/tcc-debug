/**
 * O Worker de execução sem acesso à rede (D33).
 *
 * Nenhum exercício precisa de rede, e desde D33 o código publicado por um
 * professor roda no navegador de cada aluno sem que ninguém o leia antes.
 * O Worker já não alcança a página nem a sessão guardada; com isto, também
 * não manda nem busca nada fora dela pelos caminhos comuns.
 *
 * Cada nome vira uma função que recusa com uma mensagem em português — e não
 * `undefined`, que daria ao estudante um "fetch is not a function" sem
 * explicação. A recusa vale para chamar e para construir com `new`.
 *
 * Os nomes saem do escopo global e de toda a cadeia de protótipos dele: no
 * navegador, as operações do escopo global moram no próprio objeto, mas um
 * protótipo que ainda as tivesse devolveria o original a quem o procurasse
 * ali. A substituição não pode ser desfeita: nem gravável, nem configurável.
 *
 * Sem DOM e sem `self`: recebe o escopo, para o teste poder passar um de
 * mentira, e o Worker passa `globalThis`.
 */

/** O que o pedido deixa indisponível. */
export const NOMES_DA_REDE = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
] as const;

export const MENSAGEM_DA_REDE =
  'O acesso à rede está bloqueado na execução dos exercícios: nenhum exercício precisa dele.';

function recusar(nome: string) {
  // Uma função comum, e não seta: é construível, e `new WebSocket(...)` chega
  // aqui e recusa como a chamada.
  return function recusado(): never {
    throw new Error(`${MENSAGEM_DA_REDE} (${nome})`);
  };
}

export function bloquearRede(escopo: object): void {
  for (const nome of NOMES_DA_REDE) {
    for (let objeto = Object.getPrototypeOf(escopo); objeto; objeto = Object.getPrototypeOf(objeto)) {
      if (Object.prototype.hasOwnProperty.call(objeto, nome)) {
        try {
          delete (objeto as Record<string, unknown>)[nome];
        } catch {
          // Não configurável num protótipo: o nome próprio, abaixo, o encobre.
        }
      }
    }
    Object.defineProperty(escopo, nome, {
      value: recusar(nome),
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }
}
