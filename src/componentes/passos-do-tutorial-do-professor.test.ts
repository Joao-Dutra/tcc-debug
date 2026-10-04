import { describe, expect, it } from 'vitest';
import { PASSOS_DO_TUTORIAL_DO_PROFESSOR } from './passos-do-tutorial-do-professor';

/**
 * O tutorial do professor (D33): os passos de criar a primeira atividade, na
 * ordem em que o trabalho acontece no editor.
 */

describe('o tutorial do professor', () => {
  it('percorre o caminho inteiro, em ordem', () => {
    const titulos = PASSOS_DO_TUTORIAL_DO_PROFESSOR.map((p) => p.titulo);
    const ordem = [
      /estrutura.*nomes/i,
      /código correto/i,
      /defeito.*única linha/i,
      /casos de teste/i,
      /três dicas/i,
      /^Verificar$/,
      /como o aluno veria/i,
      /^Publicar$/,
    ];
    expect(titulos).toHaveLength(ordem.length);
    titulos.forEach((titulo, i) => expect(titulo).toMatch(ordem[i]));
  });

  // Sem revisão humana, a verificação é a única porta (D33): o tutorial diz o
  // que ela não julga, e o que fica por conta do professor.
  it('diz que a verificação não julga o texto das dicas', () => {
    const dicas = PASSOS_DO_TUTORIAL_DO_PROFESSOR.find((p) => /dicas/.test(p.titulo));
    expect(dicas?.texto).toMatch(/verificação não julga/);
  });

  it('avisa que a seção pode estar oculta aos alunos durante a coleta', () => {
    const publicar = PASSOS_DO_TUTORIAL_DO_PROFESSOR.at(-1);
    expect(publicar?.texto).toMatch(/oculta aos alunos/);
  });
});
