/**
 * O perfil curto da entrada no estudo (D37), sem nenhum dado pessoal: três
 * perguntas de múltipla escolha, gravadas com a participação.
 *
 * Os valores são os que o banco aceita (0004, os `check` de
 * participantes_do_estudo). Um valor a mais aqui, sem a migração, faria a
 * entrada ser recusada na hora — e o teste do perfil compara as duas listas.
 */

export interface PerguntaDoPerfil<Campo extends string, Valor extends string> {
  campo: Campo;
  pergunta: string;
  opcoes: readonly { valor: Valor; rotulo: string }[];
}

export const PERGUNTAS_DO_PERFIL = [
  {
    campo: 'aeds1',
    pergunta: 'Você já cursou Algoritmos e Estruturas de Dados I (AEDS 1)?',
    opcoes: [
      { valor: 'ja-cursou', rotulo: 'Já cursei' },
      { valor: 'cursando', rotulo: 'Estou cursando' },
      { valor: 'nao', rotulo: 'Ainda não' },
    ],
  },
  {
    campo: 'depurador',
    pergunta: 'Com que frequência você usa um depurador passo a passo quando programa?',
    opcoes: [
      { valor: 'nunca', rotulo: 'Nunca' },
      { valor: 'as-vezes', rotulo: 'Às vezes' },
      { valor: 'frequentemente', rotulo: 'Frequentemente' },
    ],
  },
  {
    campo: 'usouVisualizacao',
    pergunta: 'Você já usou alguma ferramenta de visualização de algoritmos?',
    opcoes: [
      { valor: 'sim', rotulo: 'Sim' },
      { valor: 'nao', rotulo: 'Não' },
    ],
  },
] as const;

type Pergunta = (typeof PERGUNTAS_DO_PERFIL)[number];

/** As respostas, com o tipo de cada campo tirado das opções acima. */
export type PerfilDoParticipante = {
  [P in Pergunta as P['campo']]: P['opcoes'][number]['valor'];
};

/** As respostas até aqui; o perfil só vai ao banco completo. */
export type PerfilEmAndamento = Partial<PerfilDoParticipante>;

export function perfilCompleto(perfil: PerfilEmAndamento): perfil is PerfilDoParticipante {
  return PERGUNTAS_DO_PERFIL.every((p) => perfil[p.campo] !== undefined);
}
