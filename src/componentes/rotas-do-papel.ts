import type { Identidade } from '../supabase/identidade';
import { CAMINHO_AUTORIA, CAMINHO_CONTROLE, CAMINHO_MAPA_DE_ROTAS, CAMINHO_METRICAS } from './usar-rota';

/**
 * As rotas que cada papel vê no menu do cabeçalho (D39), sem React.
 *
 * O menu é só conveniência: esconder uma rota dele não protege nada, e
 * mostrar não libera nada. Quem barra o acesso é o banco, por papel (D24).
 * Por isso a regra é curta, e o teste cobra que o participante — anônimo ou
 * com conta sem papel — não veja menu nenhum.
 */

export interface RotaDoMenu {
  rotulo: string;
  caminho: string;
}

export function rotasDoPapel(identidade: Pick<Identidade, 'forma' | 'papel'>): RotaDoMenu[] {
  // Anônimo nunca tem menu, qualquer que seja o papel lido: é a mesma regra
  // da área do professor (estado-da-area.ts).
  if (identidade.forma !== 'google' && identidade.forma !== 'email') return [];
  if (identidade.papel === 'professor') return [{ rotulo: 'Área do professor', caminho: CAMINHO_AUTORIA }];
  if (identidade.papel === 'pesquisador') {
    return [
      { rotulo: 'Painel de controle', caminho: CAMINHO_CONTROLE },
      { rotulo: 'Métricas', caminho: CAMINHO_METRICAS },
      { rotulo: 'Mapa de rotas', caminho: CAMINHO_MAPA_DE_ROTAS },
    ];
  }
  return [];
}
