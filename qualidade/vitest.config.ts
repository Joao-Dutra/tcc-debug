import { defineConfig } from 'vitest/config';
import configDoVite from '../vite.config';

/**
 * Suíte do Projeto Final de Qualidade de Software: unidade e integração.
 *
 * Herda a configuração do Vite do projeto (os mesmos plugins da suíte rápida)
 * e só troca o que entra. Sem `mergeConfig` de propósito: ele concatena as
 * listas, e o `include` da suíte do projeto entraria junto.
 *
 * `SUITE=completa` mede a cobertura da suíte inteira (projeto + qualidade).
 */
const completa = process.env.SUITE === 'completa';

export default defineConfig({
    ...configDoVite,
    test: {
      include: completa ? ['src/**/*.test.ts', 'qualidade/**/*.test.ts'] : ['qualidade/**/*.test.ts'],
      reporters: completa
        ? ['default']
        : ['verbose', ['junit', { outputFile: 'qualidade/resultados/vitest-junit.xml' }]],
      coverage: {
        provider: 'v8',
        // A camada lógica: o que os testes de unidade e integração alcançam.
        // Os componentes React (.tsx) são cobertos pelos testes de caixa preta.
        include: ['src/nucleo/**/*.ts', 'src/estudo/**/*.ts'],
        exclude: ['**/*.test.ts', 'src/nucleo/worker-em-teste.ts'],
        reporter: ['text', 'json-summary', 'html'],
        reportsDirectory: completa
          ? 'qualidade/resultados/cobertura-suite-completa'
          : 'qualidade/resultados/cobertura',
      },
    },
});
