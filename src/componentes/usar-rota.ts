import { useEffect, useState } from 'react';

/**
 * Roteamento por hash.
 *
 * Escolhido em vez do React Router porque cada exercício só precisa de uma URL
 * própria que possa ser enviada a um participante, e o hash entrega isso sem
 * dependência nova e sem exigir nada de um servidor — o que importa para a
 * publicação estática prevista no cronograma.
 */

export type Rota =
  | { tela: 'inicial' }
  | { tela: 'exercicio'; id: string }
  | { tela: 'metricas' };

export const CAMINHO_INICIAL = '#/';

/**
 * Painel do pesquisador (D11). Não é referenciada por nenhum elemento de
 * navegação: quem chega aqui digita a rota.
 */
export const CAMINHO_METRICAS = '#/metricas';

export function caminhoDoExercicio(id: string): string {
  return `#/exercicio/${encodeURIComponent(id)}`;
}

/** Um link colado errado não pode derrubar a aplicação. */
function decodificar(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

/** Separada do hook para poder ser verificada sem navegador. */
export function interpretarHash(hash: string): Rota {
  const partes = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter((parte) => parte !== '');

  if (partes[0] === 'metricas') return { tela: 'metricas' };

  if (partes[0] === 'exercicio' && partes[1]) {
    return { tela: 'exercicio', id: decodificar(partes[1]) };
  }
  return { tela: 'inicial' };
}

export function useRota(): Rota {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const aoMudar = () => setHash(window.location.hash);
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  return interpretarHash(hash);
}
