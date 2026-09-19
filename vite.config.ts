/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Os testes de ponta a ponta de e2e/ são do Playwright (`npm run e2e`), e
  // não do vitest: rodá-los aqui abriria navegador no meio da suíte rápida.
  test: { include: ['src/**/*.test.ts'] },
})
