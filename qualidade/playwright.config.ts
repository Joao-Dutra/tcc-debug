import { defineConfig } from '@playwright/test';

/**
 * Testes de caixa preta na interface — Projeto Final de Qualidade de Software.
 *
 * Os testes só conhecem o que o estudante vê: endereço, botões, textos e o
 * desenho. Não importam nenhum módulo do núcleo para decidir o resultado, só
 * para saber a entrada (o código correto de um exercício, como um professor
 * saberia).
 *
 * O navegador é o instalado na máquina, como na suíte e2e do projeto (D20).
 * O padrão é o Edge; `CANAL=chrome npm run qualidade:caixa-preta` usa o Chrome.
 * A porta é própria (5197), para não disputar com o `npm run dev` nem com a
 * suíte e2e. As chaves do Supabase vão vazias: nenhum teste grava no banco do
 * estudo (D22).
 */
const ORIGEM = 'http://localhost:5197';

export default defineConfig({
  testDir: './caixa-preta',
  outputDir: './resultados/playwright-artefatos',
  reporter: [
    ['list'],
    ['html', { outputFolder: './resultados/playwright-relatorio', open: 'never' }],
    ['json', { outputFile: './resultados/playwright-resultados.json' }],
  ],
  use: {
    channel: process.env.CANAL ?? 'msedge',
    baseURL: ORIGEM,
    viewport: { width: 1366, height: 820 },
    screenshot: 'on',
    // Um aparelho que já viu o tutorial (D32): ele abriria na frente da tela.
    storageState: {
      cookies: [],
      origins: [{ origin: ORIGEM, localStorage: [{ name: 'depurar:tutorial-visto', value: 'e2e' }] }],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5197 --strictPort',
    url: ORIGEM,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
