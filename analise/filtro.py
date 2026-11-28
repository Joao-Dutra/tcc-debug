"""
Filtro de legitimidade das etapas da coleta aeds-2026 (D53).

Marca as etapas de exercício (1 a 5) dos 21 participantes pelas regras R1 a
R4 de D53 e escreve a lista em `saida/filtro_marcacoes.md`, fora do git,
porque traz ids. A análise principal (D52) não muda: o filtro serve a uma
análise de robustez, que só roda depois de o pesquisador conferir a lista.

Uso:
    python filtro.py            # passo 1: só marca
"""

from __future__ import annotations

import argparse
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

import analisar as a
import consolidar as c
from analisar import COM, NOME_DA_CONDICAO, NOME_DO_EXERCICIO, SAIDA, SEM, num

AQUI = Path(__file__).resolve().parent

# D53. Os limiares ficam aqui, com o nome da regra, para o texto citar.
R1_FRACAO_ATIVA = 0.5
R3_LIMITE_MS = 20_000
R4_DISTANCIA_MS = 15_000
R4_ABERTA_MS = 60_000
PERDAS_PARA_SAIR_DE_C = 3

DESCRICAO = {
    'R1': 'aba em segundo plano',
    'R2': 'sem engajamento',
    'R3': 'resposta pronta',
    'R4': 'cola entre vizinhos',
}


# ---------------------------------------------------------------------------
# R4 precisa do relógio de cada localização, inclusive dos excluídos
# ---------------------------------------------------------------------------

def localizacoes_no_relogio(sessoes: list[c.Sessao]) -> pd.DataFrame:
    """
    A primeira localização correta de cada participante × etapa de exercício.

    O vizinho pode ser qualquer participante da aplicação, inclusive os
    excluídos em D51: a fonte de uma cola não precisa estar na análise.
    """
    grupos: dict[tuple[str, int], list[c.Sessao]] = {}
    for s in sessoes:
        etapa = s['estudo']['etapa']
        if 1 <= etapa <= 5:
            grupos.setdefault((s['participanteId'], etapa), []).append(s)

    linhas = []
    for (participante, etapa), pedacos in grupos.items():
        pedacos.sort(key=lambda s: s['instanteDeInicio'])
        abertura = c.instante(pedacos[0]['instanteDeInicio'])
        for s in pedacos:
            t = c.primeiro_t(s['eventos'], c.eh_localizacao_correta)
            if t is None:
                continue
            momento = c.instante(s['instanteDeInicio']) + timedelta(milliseconds=t)
            linhas.append({
                'participante_id': participante,
                'etapa': etapa,
                'momento': momento,
                'aberta_ms': (momento - abertura).total_seconds() * 1000,
            })
            break
    return pd.DataFrame(linhas)


def marcar_r4(locs: pd.DataFrame, codigos: dict[str, str]) -> dict[tuple[str, int], list[str]]:
    """
    Os pares que disparam R4, como texto, por etapa marcada. `codigos` leva
    o id de cada um dos 21 ao seu Pnn; quem não está ali é dos excluídos.
    """
    def nome(pid: str) -> str:
        return f'{codigos[pid]} ({pid[:8]})' if pid in codigos else f'excluído ({pid[:8]})'

    marcas: dict[tuple[str, int], list[str]] = {}
    for etapa, da_etapa in locs.groupby('etapa'):
        linhas = da_etapa.sort_values('momento').to_dict('records')
        for i, a in enumerate(linhas):
            for b in linhas[i + 1:]:
                distancia = (b['momento'] - a['momento']).total_seconds() * 1000
                if distancia >= R4_DISTANCIA_MS:
                    break
                # A fonte de uma cola precisa ter localizado antes: só quem
                # localizou depois (b, na ordem do relógio) pode ser marcado.
                # No mesmo milissegundo não há ordem, e os dois ficam como b.
                alvos = [(b, a)] + ([(a, b)] if distancia == 0 else [])
                for alvo, outro in alvos:
                    if alvo['aberta_ms'] >= R4_ABERTA_MS or alvo['participante_id'] not in codigos:
                        continue
                    marcas.setdefault((alvo['participante_id'], int(etapa)), []).append(
                        f"localizou {num(distancia / 1000, 1)} s depois de {nome(outro['participante_id'])}; "
                        f"etapa aberta há {num(alvo['aberta_ms'] / 1000, 1)} s "
                        f"(a do vizinho, há {num(outro['aberta_ms'] / 1000)} s)"
                    )
    return marcas


# ---------------------------------------------------------------------------
# R1 a R3, a partir do consolidado
# ---------------------------------------------------------------------------

def antes_ou_ausente(t: float, referencia: float) -> bool:
    """Se `t` (ms, ou NaN) não aconteceu antes da referência."""
    return pd.isna(t) or t >= referencia


def marcar(etapas: pd.DataFrame, r4: dict[tuple[str, int], list[str]]) -> pd.DataFrame:
    linhas = []
    for r in etapas.itertuples():
        regras: list[str] = []
        numeros: list[str] = []
        fracao = r.duracao_ativa_ms / r.duracao_total_ms
        if fracao < R1_FRACAO_ATIVA:
            regras.append('R1')
            numeros.append(f'R1: ativa {r.duracao_ativa_ms / 1000:.0f} s de {r.duracao_total_ms / 1000:.0f} s '
                           f'({100 * fracao:.0f}%)')
        if r.execucoes == 0 and r.navegacoes == 0 and r.edicoes == 0:
            regras.append('R2')
            numeros.append(f'R2: 0 execuções, 0 navegações, 0 edições em {r.duracao_total_ms / 1000:.0f} s '
                           f'(desfecho: {r.desfecho})')
        loc = r.tempo_ate_localizacao_ms
        if (pd.notna(loc) and loc < R3_LIMITE_MS
                and antes_ou_ausente(r.tempo_ate_primeira_execucao_ms, loc)
                and antes_ou_ausente(r.tempo_ate_primeira_navegacao_ms, loc)):
            regras.append('R3')
            numeros.append(f'R3: localizou em {num(loc / 1000, 1)} s, sem execução nem navegação antes')
        chave = (r.participante_id, r.etapa)
        if chave in r4:
            regras.append('R4')
            numeros.extend(f'R4: {texto}' for texto in r4[chave])
        if regras:
            linhas.append({
                'participante_id': r.participante_id,
                'P': f'P{int(r.ordem_de_entrada):02d}',
                'grupo': r.grupo,
                'etapa': r.etapa,
                'exercicio': NOME_DO_EXERCICIO[r.exercicio_id],
                'apoio': r.apoio,
                'recarga': r.n_pedacos > 1,
                'regras': '+'.join(regras),
                'numeros': '; '.join(numeros),
            })
    return pd.DataFrame(linhas, columns=['participante_id', 'P', 'grupo', 'etapa', 'exercicio', 'apoio',
                                         'recarga', 'regras', 'numeros'])


# ---------------------------------------------------------------------------
# Relatório do passo 1
# ---------------------------------------------------------------------------

def md(cab: list[str], linhas: list[list[Any]]) -> str:
    return '\n'.join(['| ' + ' | '.join(cab) + ' |', '|' + '---|' * len(cab)]
                     + ['| ' + ' | '.join(str(x) for x in l) + ' |' for l in linhas])


def relatorio_marcacoes(etapas: pd.DataFrame, marcadas: pd.DataFrame) -> str:
    total_por_cond = etapas['apoio'].value_counts()
    partes = [
        '# Filtro de legitimidade — etapas marcadas (D53, passo 1)',
        '',
        'Só marcação. Nenhuma análise foi rodada com o filtro. Fora do git: traz ids.',
        '',
        f'Etapas avaliadas: {len(etapas)} (21 participantes × etapas 1 a 5). '
        f'Marcadas por alguma regra: **{len(marcadas)}**.',
        '',
        '## Todas as etapas marcadas',
        '',
    ]
    if marcadas.empty:
        partes.append('Nenhuma.')
    else:
        ordenadas = marcadas.sort_values(['P', 'etapa'])
        partes.append(md(
            ['Participante', 'Grupo', 'Etapa', 'Exercício', 'Condição', 'Recarga', 'Regra(s)', 'O que disparou'],
            [[f"{r.P} ({r.participante_id[:8]})", r.grupo, r.etapa, r.exercicio, NOME_DA_CONDICAO[r.apoio],
              'sim' if r.recarga else 'não', r.regras, r.numeros] for r in ordenadas.itertuples()],
        ))

    partes += ['', '## Quantas por regra e por condição', '',
               'Uma etapa marcada por duas regras conta em cada uma delas; a linha "alguma" conta a etapa uma vez.',
               '']
    linhas = []
    for regra in ['R1', 'R2', 'R3', 'R4']:
        com_regra = marcadas[marcadas['regras'].str.contains(regra)] if not marcadas.empty else marcadas
        linhas.append([f'{regra} ({DESCRICAO[regra]})']
                      + [len(com_regra[com_regra['apoio'] == a]) if not com_regra.empty else 0 for a in total_por_cond.index]
                      + [len(com_regra)])
    linhas.append(['**alguma**']
                  + [f'**{len(marcadas[marcadas["apoio"] == a]) if not marcadas.empty else 0}** de {total_por_cond[a]}'
                     for a in total_por_cond.index]
                  + [f'**{len(marcadas)}** de {len(etapas)}'])
    partes.append(md(['Regra'] + [NOME_DA_CONDICAO[a] for a in total_por_cond.index] + ['total'], linhas))

    partes += ['', '## Por participante', '']
    if marcadas.empty:
        partes.append('Ninguém perde etapa.')
    else:
        por = marcadas.groupby(['P', 'participante_id', 'grupo']).agg(
            perdidas=('etapa', 'size'),
            com=('apoio', lambda a: int((a == COM).sum())),
            etapas=('etapa', lambda e: ', '.join(map(str, sorted(e)))),
        ).reset_index().sort_values(['perdidas', 'P'], ascending=[False, True])
        partes.append(md(['Participante', 'Grupo', 'Etapas perdidas', 'Quais', 'Com apoio / sem apoio', 'Análise C filtrada'],
                         [[f'{r.P} ({r.participante_id[:8]})', r.grupo, r.perdidas, r.etapas,
                           f'{r.com} / {r.perdidas - r.com}',
                           '**sai** (3 ou mais)' if r.perdidas >= PERDAS_PARA_SAIR_DE_C else 'fica']
                          for r in por.itertuples()]))
        saem = por[por['perdidas'] >= PERDAS_PARA_SAIR_DE_C]
        partes += ['', f'**Saem da análise C filtrada:** '
                   + (', '.join(f'{r.P} ({r.participante_id[:8]})' for r in saem.itertuples()) if len(saem) else 'ninguém')
                   + '.']
        # Quem fica, mas sem nenhuma etapa numa das condições, também não forma par.
        restantes = etapas.merge(marcadas[['participante_id', 'etapa']], how='left', indicator=True)
        restantes = restantes[restantes['_merge'] == 'left_only']
        sem_par = [p for p, d in restantes.groupby('participante_id') if d['apoio'].nunique() < 2
                   and p not in set(saem['participante_id'])]
        if sem_par:
            partes.append(f'Ficam, mas sem etapa numa das condições, e por isso sem par: {", ".join(x[:8] for x in sem_par)}.')

    partes += ['', '## R5', '',
               f'R5 (palpites atravessando recarga) é a regra 2 de D52 e não tira etapa: a localização '
               f'já usa só as etapas sem recarga. São {int((etapas["n_pedacos"] > 1).sum())} etapas com recarga, '
               'que ficam na correção e saem só da localização principal, como antes.']
    return '\n'.join(partes) + '\n'


# ---------------------------------------------------------------------------
# Passo 2: B1, B2, C e D, todos × filtrado
# ---------------------------------------------------------------------------

def frac(parte: int, total: int) -> str:
    return f'{parte}/{total} ({num(100 * parte / total)}%)' if total else '—'


def mediana(serie: pd.Series) -> str:
    s = serie.dropna()
    return f'{num(s.median())} (n={len(s)})' if len(s) else '—'


def linhas_b(ex: pd.DataFrame) -> list[dict[str, Any]]:
    """B1 (desfecho, todas as etapas do conjunto) e B2 (localização, só sem recarga), por exercício × condição."""
    linhas = []
    grupos = [(NOME_DO_EXERCICIO[e], ex[ex['exercicio_id'] == e]) for e in a.ordem_dos_exercicios(ex)]
    for nome, dele in [('Todos os exercícios', ex)] + grupos:
        for cond in (COM, SEM):
            df = dele[dele['apoio'] == cond]
            loc = df[df['sem_recarga']]
            linhas.append({
                'exercício': nome, 'condição': NOME_DA_CONDICAO[cond],
                'B1 corrigidas': frac(int(df['corrigido'].sum()), len(df)),
                'B1 desistência': frac(int((df['desfecho'] == 'desistencia').sum()), len(df)),
                'B1 tempo esgotado': frac(int((df['desfecho'] == 'tempo-esgotado').sum()), len(df)),
                'B1 corrigir, s, mediana': mediana(df.loc[df['corrigido'], 'tempo_ate_correcao_s']),
                'B2 localizaram (sem recarga)': frac(int(loc['localizou'].sum()), len(loc)),
                'B2 localizar, s, mediana': mediana(loc['tempo_ate_localizacao_s']),
                'B2 localizar→corrigir, s, mediana': mediana(loc['intervalo_loc_corr_s']),
            })
    return linhas


MEDIDAS_C = [
    ('Proporção de etapas corrigidas', 'corrigido', False, 'proporção'),
    ('Tempo até corrigir, censurado em 600 s', 'tempo_correcao_censurado_s', False, 's'),
    ('Tempo até localizar — principal (sem recarga)', 'tempo_ate_localizacao_s', True, 's'),
    ('Tempo até localizar — sensibilidade (todas)', 'tempo_ate_localizacao_s', False, 's'),
    ('Proporção com localização explícita — principal (sem recarga)', 'localizou', True, 'proporção'),
    ('Proporção com localização explícita — sensibilidade (todas)', 'localizou', False, 'proporção'),
]


def resultados_c(ex: pd.DataFrame) -> pd.DataFrame:
    """A análise C de D52, na mesma ordem de medidas e com a mesma semente."""
    rng = np.random.default_rng(a.SEMENTE)
    linhas = []
    for nome, coluna, so_sem_recarga, unidade in MEDIDAS_C:
        m = a.medias_por_participante(ex, coluna, ex['sem_recarga'] if so_sem_recarga else None)
        linhas.append({'medida': nome, 'unidade': unidade,
                       **a.wilcoxon_pareado(m[COM].to_numpy(float), m[SEM].to_numpy(float), rng)})
    return pd.DataFrame(linhas)


def texto_c(r: Any) -> dict[str, str]:
    casas = 2 if r.unidade == 'proporção' else 0
    return {
        'pares (sem zero)': f'{r.pares} ({r.pares_sem_empate_zero})',
        'com / sem': f'{num(r.mediana_com, casas)} / {num(r.mediana_sem, casas)}',
        'dif. [IC 95%]': f'{num(r.diferenca_de_medianas, casas)} [{num(r.ic95_inf, casas)}; {num(r.ic95_sup, casas)}]',
        'p': num(r.p, 3), 'r': num(r.rank_biserial, 2),
    }


def contagem_d(ex: pd.DataFrame) -> dict[tuple[str, str], str]:
    saida = {}
    for e in a.ordem_dos_exercicios(ex):
        dele = ex[ex['exercicio_id'] == e]
        for cond in (COM, SEM):
            df = dele[dele['apoio'] == cond]
            saida[(NOME_DO_EXERCICIO[e], NOME_DA_CONDICAO[cond])] = f"{int(df['corrigido'].sum())}/{len(df)}"
    return saida


def analisar_filtrado(etapas_todas: pd.DataFrame, marcadas: pd.DataFrame) -> str:
    ex, _ = a.ler()
    chave = ex.set_index(['participante_id', 'etapa']).index
    marcada = chave.isin(marcadas.set_index(['participante_id', 'etapa']).index)
    filtrado = ex[~marcada].copy()
    perdas = marcadas.groupby('participante_id').size()
    saem_de_c = set(perdas[perdas >= PERDAS_PARA_SAIR_DE_C].index)
    filtrado_c = filtrado[~filtrado['participante_id'].isin(saem_de_c)]

    # B
    tb_todos, tb_filt = linhas_b(ex), linhas_b(filtrado)
    colunas_b = [k for k in tb_todos[0] if k not in ('exercício', 'condição')]
    b = pd.DataFrame([{'exercício': t['exercício'], 'condição': t['condição'],
                       **{f'{k} — todos': t[k] for k in colunas_b},
                       **{f'{k} — filtrado': f[k] for k in colunas_b}}
                      for t, f in zip(tb_todos, tb_filt)])
    b = b[['exercício', 'condição'] + [f'{k} — {q}' for k in colunas_b for q in ('todos', 'filtrado')]]
    b.to_csv(a.RESULTADOS / 'R_robustez_B.csv', index=False)

    # C, com conferência de que "todos" reproduz a análise principal
    c_todos, c_filt = resultados_c(ex), resultados_c(filtrado_c)
    principal = pd.read_csv(a.RESULTADOS / 'C_comparacao_pareada.csv')
    if not np.allclose(principal['p'], c_todos['p'], equal_nan=True) or \
            not np.allclose(principal['ic95_inf'], c_todos['ic95_inf'], equal_nan=True):
        sys.exit('A coluna "todos" da análise C não reproduz C_comparacao_pareada.csv.')
    c = pd.DataFrame([{'medida': t.medida,
                       **{f'{k} — todos': v for k, v in texto_c(t).items()},
                       **{f'{k} — filtrado': v for k, v in texto_c(f).items()}}
                      for t, f in zip(c_todos.itertuples(), c_filt.itertuples())])
    c = c[['medida'] + [f'{k} — {q}' for k in texto_c(c_todos.iloc[0]) for q in ('todos', 'filtrado')]]
    pd.concat([c_todos.assign(conjunto='todos'), c_filt.assign(conjunto='filtrado')]).to_csv(
        a.RESULTADOS / 'R_robustez_C.csv', index=False)

    # D
    d_todos, d_filt = contagem_d(ex), contagem_d(filtrado)
    m_todos, m_filt = a.modelo_misto(ex), a.modelo_misto(filtrado)
    d = pd.DataFrame([{'exercício': e, 'condição': cond, 'corrigidas — todos': v, 'corrigidas — filtrado': d_filt[(e, cond)]}
                      for (e, cond), v in d_todos.items()])
    d.to_csv(a.RESULTADOS / 'R_robustez_D.csv', index=False)

    def modelo(m: dict[str, Any]) -> str:
        avisos = '; '.join(sorted(set(m['avisos']))) or 'nenhum'
        return (f"razão MAP/VB = {num(m['razao'], 2)}; separação: {', '.join(m['separados']) or 'nenhuma'}; "
                f"avisos: {avisos} → **{'estável' if m['estavel'] else 'não estável, não reportado'}**")

    perdidas_por_cond = marcadas['apoio'].value_counts()
    partes = [
        '# Análise de robustez — todos × filtrado (D53)',
        '',
        f'**Todos:** as 105 etapas dos 21 participantes (análise principal, D52). '
        f'**Filtrado:** sem as {len(marcadas)} etapas marcadas por R1 a R4 '
        f'({perdidas_por_cond.get(COM, 0)} com apoio, {perdidas_por_cond.get(SEM, 0)} sem apoio), '
        f'ficando {len(filtrado)}. Saem da análise C filtrada: '
        f'{len(saem_de_c) or "ninguém"} (3 ou mais etapas perdidas). R5 é a regra 2 de D52: a localização '
        'principal usa só as etapas sem recarga nos dois conjuntos.',
        '',
        '## B1 e B2 — descritiva',
        '',
        'Tempos em segundos, mediana (n). B1 usa todas as etapas do conjunto; B2, só as sem recarga.',
        '',
        a.tabela_md(b),
        '',
        '## C — comparação pareada',
        '',
        'Mesmos testes, bootstrap e semente de D52. "com / sem" são as medianas das médias por participante; '
        'dif. é com − sem.',
        '',
        a.tabela_md(c),
        '',
        '## D — corrigido por exercício × apoio, e o modelo misto',
        '',
        a.tabela_md(d),
        '',
        f'- Modelo, todos: {modelo(m_todos)}.',
        f'- Modelo, filtrado: {modelo(m_filt)}.',
        '',
    ]
    return '\n'.join(partes)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--analisar', action='store_true',
                        help='passo 2: roda B1, B2, C e D no conjunto filtrado (depois da conferência da lista)')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')

    etapas = pd.read_csv(SAIDA / 'consolidado_etapas.csv')
    etapas = etapas[etapas['etapa'].between(1, 5)].reset_index(drop=True)
    if len(etapas) != 105:
        sys.exit(f'Esperava 105 etapas; vieram {len(etapas)}.')

    sessoes, _ = c.juntar_fontes(AQUI / 'dados')
    locs = localizacoes_no_relogio(sessoes)
    # Conferência: para os 21, a localização do relógio é a mesma do consolidado.
    dos_21 = locs.merge(etapas[['participante_id', 'etapa', 'tempo_ate_localizacao_ms']], how='right')
    faltando = dos_21['momento'].isna() != dos_21['tempo_ate_localizacao_ms'].isna()
    if faltando.any():
        sys.exit('A localização no relógio não bate com o consolidado.')

    codigos = {pid: f'P{int(o):02d}' for pid, o in
               etapas.groupby('participante_id')['ordem_de_entrada'].first().items()}
    r4 = marcar_r4(locs, codigos)
    marcadas = marcar(etapas, r4)
    (SAIDA / 'filtro_marcacoes.md').write_text(relatorio_marcacoes(etapas, marcadas), encoding='utf-8')
    print(f'{len(marcadas)} etapas marcadas. Lista em {SAIDA / "filtro_marcacoes.md"}')
    if args.analisar:
        (SAIDA / 'relatorio_robustez.md').write_text(analisar_filtrado(etapas, marcadas), encoding='utf-8')
        print(f'Robustez em {SAIDA / "relatorio_robustez.md"}; tabelas R_robustez_* em {a.RESULTADOS}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
