import type { Page } from '@playwright/test';
import { ITENS_DAS_ESCALAS } from '../src/estudo/questionario';

/**
 * O questionário do estudo respondido como o participante responde, para os
 * dois projetos, com e sem banco. Fora de um `.spec.ts`: importar de um spec
 * registraria os testes dele de novo no outro.
 */

/** Marca cada afirmação com o valor que a função der, e envia. */
export async function responderQuestionario(page: Page, valor: (indice: number) => number = () => 4) {
  for (const [indice, item] of ITENS_DAS_ESCALAS.entries()) {
    await page.getByRole('group', { name: item.texto }).locator(`input[value="${valor(indice)}"]`).check();
  }
  await page.getByRole('button', { name: 'Enviar respostas' }).click();
}
