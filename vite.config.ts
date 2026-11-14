/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { EXERCICIOS_DE_EXEMPLO } from './src/exercicios/exemplos-publicos.ts'
import { aparecemNoPacote, exercicioDoCaminho, tirarCodigoCorreto } from './src/exercicios/sem-gabarito.ts'

/**
 * O código correto dos exercícios fica fora do que vai ao navegador (D41),
 * menos o dos exemplos do formulário do professor, que estão fora do percurso
 * do estudo.
 *
 * Vale no build e no servidor de desenvolvimento, para os testes de ponta a
 * ponta rodarem sobre o mesmo pacote que o participante recebe. Não vale na
 * suíte rápida (modo `test`), que confere o catálogo inteiro e precisa das
 * duas versões.
 *
 * No fim do build, confere o próprio pacote: se algum código correto retirado
 * ainda estiver lá — copiado em outro módulo, por exemplo —, o build para.
 */
function semGabarito(): Plugin {
  const retirados = new Map<string, string>()
  return {
    name: 'depurar:sem-gabarito',
    enforce: 'pre',
    apply: (_config, { mode }) => mode !== 'test',
    transform(fonte, caminho) {
      const id = exercicioDoCaminho(caminho)
      if (!id) return null
      const r = tirarCodigoCorreto(fonte, id, EXERCICIOS_DE_EXEMPLO)
      if (r.retirado === null) return null
      retirados.set(id, r.retirado)
      return { code: r.fonte, map: null }
    },
    generateBundle(_opcoes, pacote) {
      const texto = Object.values(pacote)
        .map((parte) => (parte.type === 'chunk' ? parte.code : String(parte.source)))
        .join('\n')
      for (const [id, codigo] of retirados) {
        if (aparecemNoPacote(texto, codigo)) {
          this.error(`o código correto de ${id} continua no pacote (D41)`)
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), semGabarito()],
  // Os testes de ponta a ponta de e2e/ são do Playwright (`npm run e2e`), e
  // não do vitest: rodá-los aqui abriria navegador no meio da suíte rápida.
  test: { include: ['src/**/*.test.ts'] },
})
