import { useEffect, useState } from 'react';
import { supabaseConfigurado } from '../supabase/cliente';
import { lerExerciciosPublicados } from '../supabase/exercicios-de-professor';
import type { Exercicio } from '../nucleo/tipos';

/**
 * Os exercícios de professor publicados, para a tela do aluno (D31).
 *
 * Nenhuma tela do aluno pode depender de haver banco (D21): sem chaves, a
 * leitura nem começa e a lista é vazia — a vitrine fica só com o catálogo, que
 * é o que ela era antes. A falha fica registrada no estado, e quem decide o
 * que dizer é a tela: a vitrine se cala, a abertura de um exercício explica.
 */
export type Publicados =
  | { estado: 'lendo' }
  | { estado: 'pronto'; exercicios: Exercicio[] }
  | { estado: 'falhou' };

export function useExerciciosPublicados(): Publicados {
  const [publicados, setPublicados] = useState<Publicados>(() =>
    supabaseConfigurado() ? { estado: 'lendo' } : { estado: 'pronto', exercicios: [] }
  );

  useEffect(() => {
    if (!supabaseConfigurado()) return;
    let valida = true;
    lerExerciciosPublicados()
      .then((exercicios) => valida && setPublicados({ estado: 'pronto', exercicios }))
      .catch(() => valida && setPublicados({ estado: 'falhou' }));
    return () => {
      valida = false;
    };
  }, []);

  return publicados;
}
