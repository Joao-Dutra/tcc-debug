import type { Instantaneo } from './tipos';

/**
 * Quadro-denúncia: a versão com defeito precisa divergir da correta em estado
 * observável (D16).
 *
 * Mora no núcleo, e não no teste, porque a mesma regra vale em dois lugares: no
 * teste do catálogo, que roda as versões no Worker de mentira, e na submissão
 * de um exercício de professor, que roda no Worker de verdade. Uma função só,
 * sobre as duas sequências de instantâneos, é o que garante que as duas regras
 * nunca divirjam — a verificação que pegou o defeito da pilha que ninguém tinha
 * visto é a mesma que um professor enfrenta.
 *
 * Nenhuma execução acontece aqui: quem executa entrega as sequências prontas.
 */

/**
 * O estado que a visualização recebe num quadro, em forma comparável. Só as
 * variáveis observadas, que é tudo o que o desenho recebe: uma diferença fora
 * delas não chega ao estudante.
 */
export function estadoDoQuadro(
  variaveisObservadas: string[],
  instantaneo: Pick<Instantaneo, 'variaveis'>
): string {
  return JSON.stringify(
    variaveisObservadas.map((nome) => [
      nome,
      nome in instantaneo.variaveis ? instantaneo.variaveis[nome] : '(ausente)',
    ])
  );
}

/**
 * A sequência de estados sem as repetições consecutivas. Ignora em que linha e
 * em que momento o estado muda, e fica só com quais estados ocorrem, em ordem —
 * que é o que o desenho mostra.
 */
export function trajetoria(estados: string[]): string[] {
  return estados.filter((atual, i) => i === 0 || atual !== estados[i - 1]);
}

export interface ComparacaoDasVersoes {
  quadrosDivergentes: number;
  trajetoriasIdenticas: boolean;
  /**
   * Recusada por qualquer um de dois critérios: as sequências divergem em no
   * máximo um quadro, ou as trajetórias de estados são idênticas. O segundo é o
   * que pegou a pilha: dois quadros divergentes, um por chamada, e nenhum
   * estado diferente para desenhar.
   */
  aprovada: boolean;
}

export function compararVersoes(
  variaveisObservadas: string[],
  comDefeito: Instantaneo[],
  correto: Instantaneo[]
): ComparacaoDasVersoes {
  const d = comDefeito.map((i) => estadoDoQuadro(variaveisObservadas, i));
  const c = correto.map((i) => estadoDoQuadro(variaveisObservadas, i));

  const emComum = Math.min(d.length, c.length);
  let quadrosDivergentes = Math.abs(d.length - c.length);
  for (let i = 0; i < emComum; i++) if (d[i] !== c[i]) quadrosDivergentes++;

  const td = trajetoria(d);
  const tc = trajetoria(c);
  const trajetoriasIdenticas = td.length === tc.length && td.every((e, i) => e === tc[i]);

  return {
    quadrosDivergentes,
    trajetoriasIdenticas,
    aprovada: quadrosDivergentes > 1 && !trajetoriasIdenticas,
  };
}

/**
 * Os estados que as duas versões atravessam, em ordem, antes de a trajetória
 * com defeito se separar da correta. Nenhum deles denuncia o defeito: até ali o
 * desenho é o mesmo com ou sem ele — é daqui que a miniatura da vitrine precisa
 * sair (D20).
 */
export function estadosAntesDaDivergencia(
  variaveisObservadas: string[],
  comDefeito: Instantaneo[],
  correto: Instantaneo[]
): string[] {
  const td = trajetoria(comDefeito.map((i) => estadoDoQuadro(variaveisObservadas, i)));
  const tc = trajetoria(correto.map((i) => estadoDoQuadro(variaveisObservadas, i)));
  let comum = 0;
  while (comum < td.length && comum < tc.length && td[comum] === tc[comum]) comum++;
  return tc.slice(0, comum);
}
