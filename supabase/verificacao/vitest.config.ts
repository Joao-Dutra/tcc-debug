/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

/**
 * Configuração só da verificação do RLS (D24), separada da suíte comum.
 *
 * A suíte comum (`npx vitest run`) roda sem rede e sem banco, a cada mudança.
 * Esta precisa do projeto Supabase de verdade e da chave secreta, e cria e
 * remove contas nele: não pode rodar sem alguém pedir. Por isso tem arquivo
 * próprio, e a suíte comum nem enxerga `supabase/verificacao/`.
 */
const raiz = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  // Só as duas chaves públicas vêm do `.env`. A secreta vem do ambiente do
  // shell e de mais lugar nenhum: se alguém a tiver posto no `.env` contra o
  // que o `.env.example` pede, ela continua não sendo lida daqui.
  const env = loadEnv(mode, raiz, 'VITE_SUPABASE_');
  return {
    root: raiz,
    test: {
      include: ['supabase/verificacao/**/*.verificacao.ts'],
      env: {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL ?? '',
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      // Cada verificação é uma ida e volta à rede do projeto.
      testTimeout: 30_000,
      hookTimeout: 120_000,
    },
  };
});
