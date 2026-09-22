import { supabase, supabaseConfigurado } from './cliente';
import { iniciarIdentidade, identidadeAtual, observarIdentidade } from './identidade';
import { ativarDestinoRemoto, sincronizarPendentes } from '../nucleo/metricas';
import type { DestinoRemoto, RegistroDeSessao } from '../nucleo/metricas';

/**
 * Gravação das sessões arquivadas no banco (D21).
 *
 * Mora fora do núcleo pelo mesmo motivo do espelho local (D15): mexe com o
 * mundo — rede, aqui — e o núcleo continua dono do formato. O espelho em
 * `localStorage` não sai de cena: ele passa a ser a camada de resiliência. Se
 * a gravação falhar, a sessão fica no aparelho e é reenviada depois.
 */

/** Uma linha de `public.sessoes`. Os nomes são os do banco, em snake_case. */
interface LinhaDeSessao {
  id: string;
  participante_id: string;
  versao: number;
  exercicio_id: string;
  andaime: string | null;
  instante_de_inicio: string;
  duracao_total_ms: number;
  eventos: RegistroDeSessao['eventos'];
  resumo: RegistroDeSessao['resumo'];
}

/**
 * A coluna `participante_id` é obrigatória, então um registro sem identidade
 * — coletado antes de D21, ou numa carga em que a entrada anônima falhou —
 * sobe sob a identidade de agora, que é a do aparelho onde ele foi coletado.
 * Isso não apaga a distinção: esses registros têm `versao` 3 ou menos, e é a
 * versão que diz, na análise, que eles não nasceram identificados.
 */
export function paraLinha(registro: RegistroDeSessao, participanteId: string): LinhaDeSessao {
  return {
    id: registro.id,
    participante_id: registro.participanteId ?? participanteId,
    versao: registro.versao,
    exercicio_id: registro.exercicioId,
    andaime: registro.andaime,
    instante_de_inicio: registro.instanteDeInicio,
    duracao_total_ms: registro.duracaoTotalMs,
    eventos: registro.eventos,
    resumo: registro.resumo,
  };
}

export function destinoSupabase(): DestinoRemoto {
  return {
    async gravar(registros) {
      const cliente = supabase();
      if (!cliente) throw new Error('banco não configurado');

      const { usuarioId } = identidadeAtual();
      // Sem identidade não há o que gravar: o RLS recusaria a linha, e insistir
      // só queimaria a rede. Fica tudo pendente, e a próxima tentativa — depois
      // que a entrada anônima concluir — leva o lote inteiro.
      if (!usuarioId) throw new Error('ainda sem identidade');

      const { error } = await cliente
        .from('sessoes')
        // Pelo id: rearquivar a mesma sessão atualiza a linha. É o que permite
        // reenviar tudo o que está no aparelho a cada carga da página sem
        // duplicar nada.
        .upsert(registros.map((r) => paraLinha(r, usuarioId)), { onConflict: 'id' });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Liga identidade e banco. Chamada de `main.tsx` sem ser esperada: nada do que
 * acontece aqui pode atrasar a primeira tela.
 */
export async function ligarPersistencia(): Promise<void> {
  if (!supabaseConfigurado()) return;

  await iniciarIdentidade();
  await ativarDestinoRemoto(destinoSupabase());

  // Duas ocasiões em que vale tentar de novo o que ficou para trás: a rede
  // voltou, ou a identidade mudou (a entrada anônima concluiu, ou a pessoa
  // vinculou uma conta).
  window.addEventListener('online', () => void sincronizarPendentes());
  observarIdentidade(() => void sincronizarPendentes());
}
