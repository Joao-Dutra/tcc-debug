import { NIVEIS_DE_ANDAIME, rotuloDoAndaime } from './andaime';
import {
  CAMINHO_AUTORIA,
  CAMINHO_CONTROLE,
  CAMINHO_ENTRAR,
  CAMINHO_EXERCICIOS,
  CAMINHO_INICIAL,
  CAMINHO_METRICAS,
  caminhoDaConferencia,
  caminhoDoEstudo,
  caminhoDoExercicio,
} from './usar-rota';

/**
 * O mapa de rotas do painel de controle (D38), sem React.
 *
 * Cada caminho sai das funções de `usar-rota.ts`, e nunca é escrito à mão
 * aqui: um endereço copiado do painel e entregue na aula precisa ser o que a
 * aplicação de fato interpreta. O teste confere isso devolvendo cada caminho
 * ao interpretador.
 */

export interface RotaDoMapa {
  rotulo: string;
  caminho: string;
}

export interface GrupoDoMapa {
  titulo: string;
  rotas: RotaDoMapa[];
}

export function mapaDeRotas(
  exercicios: readonly { id: string; titulo: string }[],
  aplicacoes: readonly string[]
): GrupoDoMapa[] {
  return [
    {
      titulo: 'Telas',
      rotas: [
        { rotulo: 'Início', caminho: CAMINHO_INICIAL },
        { rotulo: 'Entrar', caminho: CAMINHO_ENTRAR },
        { rotulo: 'Vitrine', caminho: CAMINHO_EXERCICIOS },
        { rotulo: 'Área do professor', caminho: CAMINHO_AUTORIA },
        { rotulo: 'Métricas', caminho: CAMINHO_METRICAS },
        { rotulo: 'Painel de controle', caminho: CAMINHO_CONTROLE },
      ],
    },
    {
      titulo: 'Exercícios do catálogo',
      // O nível vai sempre explícito: é o endereço que diz sob qual apoio a
      // sessão foi aberta (usar-rota.ts).
      rotas: exercicios.flatMap((e) =>
        NIVEIS_DE_ANDAIME.map((nivel) => ({
          rotulo: `${e.titulo} — ${rotuloDoAndaime(nivel)}`,
          caminho: caminhoDoExercicio(e.id, nivel),
        }))
      ),
    },
    {
      titulo: 'Aplicações do estudo',
      rotas: aplicacoes.flatMap((codigo) => [
        { rotulo: `${codigo} — percurso`, caminho: caminhoDoEstudo(codigo) },
        { rotulo: `${codigo} — conferência das máquinas`, caminho: caminhoDaConferencia(codigo) },
      ]),
    },
  ];
}

/**
 * O endereço inteiro, para colar numa mensagem: a origem e o caminho da
 * página, com a rota no hash. A consulta da página fica de fora — a rota mora
 * no hash, e não nela.
 */
export function enderecoCompleto(caminho: string, local: { origin: string; pathname: string }): string {
  return `${local.origin}${local.pathname}${caminho}`;
}
