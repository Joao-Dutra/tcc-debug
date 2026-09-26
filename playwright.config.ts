import { defineConfig } from '@playwright/test';

/**
 * Testes de ponta a ponta (D20).
 *
 * Existem para o que só um navegador responde: se o clique no filtro faz o que
 * promete, se a preferência de movimento reduzido chega ao desenho e se a
 * página cabe na largura de um celular. O vitest continua com o resto — ele não
 * tem cascata de CSS nem layout, e nenhuma das três perguntas se responde sem
 * os dois.
 *
 * Usa o Edge já instalado na máquina (`channel: 'msedge'`), e não um navegador
 * baixado pelo Playwright: a mesma razão de D13 vale aqui, o ambiente do
 * trabalho não deve depender de download em tempo de execução.
 */
export default defineConfig({
  testDir: './e2e',
  use: { channel: 'msedge' },
  projects: [
    {
      name: 'sem-banco',
      testIgnore: /propostos\.spec\.ts/,
      use: { baseURL: 'http://localhost:5199' },
    },
    {
      // O caminho com banco, sem banco de verdade: o servidor aponta para um
      // endereço que não existe, e o teste responde a cada pedido (D31).
      name: 'banco-falso',
      testMatch: /propostos\.spec\.ts/,
      use: { baseURL: 'http://localhost:5198' },
    },
  ],
  webServer: [
    {
      // A porta é própria para não disputar com o servidor de desenvolvimento
      // aberto à mão em 5173.
      command: 'npm run dev -- --port 5199 --strictPort',
      url: 'http://localhost:5199',
      reuseExistingServer: true,
      timeout: 60_000,
      // Chaves do Supabase vazias de propósito (D22). Com o `.env` preenchido,
      // cada execução da suíte criaria usuários anônimos e gravaria sessões de
      // mentira no banco do estudo, misturadas às dos participantes. Variável
      // que já existe no ambiente vence o `.env` no Vite, e vazia desliga o banco.
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    },
    {
      // Endereço `.invalid`, que nunca resolve (RFC 2606): mesmo que um pedido
      // escapasse do teste, não chegaria a banco nenhum — muito menos ao do
      // estudo. A chave é de mentira pelo mesmo motivo.
      command: 'npm run dev -- --port 5198 --strictPort',
      url: 'http://localhost:5198',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_SUPABASE_URL: 'http://supabase-falso.invalid',
        VITE_SUPABASE_ANON_KEY: 'chave-de-mentira',
      },
    },
  ],
});
