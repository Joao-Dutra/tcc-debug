import { useEffect, useState } from 'react';
import { interpretarAndaime } from './andaime';
import type { NivelDeAndaime } from './andaime';

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
  | { tela: 'exercicio'; id: string; andaime: NivelDeAndaime }
  | { tela: 'metricas' };

export const CAMINHO_INICIAL = '#/';

/**
 * Painel do pesquisador (D11). Não é referenciada por nenhum elemento de
 * navegação: quem chega aqui digita a rota.
 */
export const CAMINHO_METRICAS = '#/metricas';

/**
 * O nível vai explícito no link quando informado, mesmo sendo `completo` o
 * padrão: é este endereço que será enviado a um participante, e ele precisa
 * dizer sozinho sob qual apoio a sessão foi aberta.
 */
export function caminhoDoExercicio(id: string, andaime?: NivelDeAndaime): string {
  const caminho = `#/exercicio/${encodeURIComponent(id)}`;
  return andaime === undefined ? caminho : `${caminho}?andaime=${andaime}`;
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
  // A consulta vem dentro do hash, então window.location.search fica vazio e
  // é aqui que ela precisa ser separada do caminho.
  const [caminho, consulta = ''] = hash.replace(/^#\/?/, '').split('?');
  const partes = caminho.split('/').filter((parte) => parte !== '');

  if (partes[0] === 'metricas') return { tela: 'metricas' };

  if (partes[0] === 'exercicio' && partes[1]) {
    return {
      tela: 'exercicio',
      id: decodificar(partes[1]),
      andaime: interpretarAndaime(new URLSearchParams(consulta).get('andaime')),
    };
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
