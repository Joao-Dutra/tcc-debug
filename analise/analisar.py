"""
Análise da coleta (fase 2 do TCC), com as regras de D52.

Lê a consolidação de D51 (analise/saida/consolidado_*.csv, gerada por
consolidar.py) e escreve:

- analise/saida/relatorio_analise.md, com as tabelas, as figuras, as
  respostas abertas na íntegra e a leitura de cada análise — fora do git;
- analise/saida/figuras/*.png — fora do git;
- analise/resultados/*.csv — só tabelas agregadas, sem id de participante,
  para o texto do TCC. Estas vão para o git.

As leituras em português simples são escritas pelo pesquisador depois de ver
os números, em analise/saida/leituras.md (uma seção "## A", "## B"...), e
entram no relatório como estão. Elas não são geradas: um parágrafo de
interpretação montado por código diria a mesma coisa de qualquer resultado.

Uso, da raiz do repositório:

    analise/.venv/Scripts/python.exe analise/analisar.py

É um estudo exploratório com n = 21. Nada aqui é teste de hipótese
confirmatório: o p-valor é reportado ao lado do tamanho de efeito e do
intervalo, e a leitura não vai além deles.
"""

from __future__ import annotations

import json
import re
import sys
import warnings
from pathlib import Path
from typing import Any, Callable

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from scipy import stats  # noqa: E402

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
SAIDA = AQUI / 'saida'
FIGURAS = SAIDA / 'figuras'
RESULTADOS = AQUI / 'resultados'

CENSURA_S = 600.0           # D52, regra 6
SEMENTE = 20261124          # D52: bootstrap
REAMOSTRAS = 10_000
COM, SEM = 'com-apoio', 'sem-apoio'
NOME_DA_CONDICAO = {COM: 'com apoio', SEM: 'sem apoio'}

# Rótulos curtos, a partir dos títulos do catálogo, na ordem do percurso.
NOME_DO_EXERCICIO = {
    'pilha-desempilhar': 'Pilha',
    'fila-atender-todos': 'Fila',
    'lista-inserir-depois': 'Lista encadeada',
    'vetor-ordenar-por-selecao': 'SelectionSort',
    'vetor-ordenar': 'BubbleSort',
}

# Bangor, Kortum e Miller (2009), média do SUS associada a cada adjetivo.
ADJETIVOS_DO_SUS = [
    ('Pior imaginável', 12.5), ('Horrível', 20.3), ('Ruim', 35.7), ('OK', 50.9),
    ('Bom', 71.4), ('Excelente', 85.5), ('Melhor imaginável', 90.9),
]

PERFIL = {
    'perfil_aeds1': ('Você já cursou AEDS 1?',
                     {'ja-cursou': 'Já cursei', 'cursando': 'Estou cursando', 'nao': 'Ainda não'}),
    'perfil_depurador': ('Com que frequência usa um depurador passo a passo?',
                         {'nunca': 'Nunca', 'as-vezes': 'Às vezes', 'frequentemente': 'Frequentemente'}),
    'perfil_visualizacao': ('Já usou ferramenta de visualização de algoritmos?',
                            {'sim': 'Sim', 'nao': 'Não'}),
}


# ---------------------------------------------------------------------------
# Leitura
# ---------------------------------------------------------------------------

def ler() -> tuple[pd.DataFrame, pd.DataFrame]:
    etapas = pd.read_csv(SAIDA / 'consolidado_etapas.csv')
    participantes = pd.read_csv(SAIDA / 'consolidado_participantes.csv')
    # Regra 5: o aquecimento fica fora de tudo.
    exercicios = etapas[etapas['etapa'].between(1, 5)].copy()
    if len(exercicios) != 105 or exercicios['participante_id'].nunique() != 21:
        sys.exit(f'Esperava 105 etapas de 21 participantes; vieram {len(exercicios)}.')
    for coluna in ('tempo_ate_localizacao', 'tempo_ate_correcao', 'tempo_ate_localizacao_implicita_aprox'):
        exercicios[f'{coluna}_s'] = exercicios[f'{coluna}_ms'] / 1000
    exercicios['sem_recarga'] = exercicios['n_pedacos'] == 1
    exercicios['localizou'] = exercicios['tempo_ate_localizacao_s'].notna()
    exercicios['corrigido'] = exercicios['desfecho'] == 'corrigido'
    # Regra 6: quem não corrigiu fica censurado em 600 s.
    exercicios['tempo_correcao_censurado_s'] = np.where(
        exercicios['corrigido'], exercicios['tempo_ate_correcao_s'], CENSURA_S
    )
    exercicios['intervalo_loc_corr_s'] = exercicios['tempo_ate_correcao_s'] - exercicios['tempo_ate_localizacao_s']
    exercicios['nome'] = exercicios['exercicio_id'].map(NOME_DO_EXERCICIO)
    return exercicios, participantes


def itens_do_questionario() -> dict[str, str]:
    texto = (RAIZ / 'src/estudo/questionario.ts').read_text(encoding='utf-8')
    return {i.replace('-', '_'): t for i, t in re.findall(r"id: '((?:sus|vis|rec)-\d+)',\s*texto: '([^']+)'", texto)}


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def num(x: float | None, casas: int = 0) -> str:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return '—'
    return f'{x:,.{casas}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


def mediana_iqr(serie: pd.Series, casas: int = 0) -> tuple[str, dict[str, float]]:
    s = serie.dropna()
    if s.empty:
        return '—', {'n': 0, 'mediana': np.nan, 'q1': np.nan, 'q3': np.nan}
    q1, med, q3 = s.quantile([0.25, 0.5, 0.75])
    return (f'{num(med, casas)} [{num(q1, casas)}–{num(q3, casas)}] (n={len(s)})',
            {'n': len(s), 'mediana': med, 'q1': q1, 'q3': q3})


def pct(parte: int, total: int) -> str:
    return f'{num(100 * parte / total)}% ({parte}/{total})' if total else '—'


def tabela_md(df: pd.DataFrame) -> str:
    cab = list(df.columns)
    linhas = ['| ' + ' | '.join(map(str, cab)) + ' |', '|' + '---|' * len(cab)]
    for _, r in df.iterrows():
        linhas.append('| ' + ' | '.join('' if pd.isna(v) else str(v).replace('|', '\\|') for v in r) + ' |')
    return '\n'.join(linhas)


def ordem_dos_exercicios(df: pd.DataFrame) -> list[str]:
    return list(df.sort_values('etapa')['exercicio_id'].drop_duplicates())


# ---------------------------------------------------------------------------
# A. Perfil
# ---------------------------------------------------------------------------

def analise_a(participantes: pd.DataFrame) -> tuple[str, pd.DataFrame]:
    linhas = [{'pergunta': 'Participantes', 'resposta': 'total', 'n': len(participantes)}]
    for g, n in participantes['grupo'].value_counts().sort_index().items():
        linhas.append({'pergunta': 'Grupo', 'resposta': g, 'n': n})
    for coluna, (pergunta, rotulos) in PERFIL.items():
        contagem = participantes[coluna].value_counts()
        for valor, rotulo in rotulos.items():
            linhas.append({'pergunta': pergunta, 'resposta': rotulo, 'n': int(contagem.get(valor, 0))})
        faltam = participantes[coluna].isna().sum()
        if faltam:
            linhas.append({'pergunta': pergunta, 'resposta': 'sem resposta', 'n': int(faltam)})
    tabela = pd.DataFrame(linhas)
    # Cruzamento com o grupo: a distribuição do perfil nos dois grupos.
    cruz = []
    for coluna, (pergunta, rotulos) in PERFIL.items():
        for valor, rotulo in rotulos.items():
            cruz.append({'pergunta': pergunta, 'resposta': rotulo,
                         **{f'grupo {g}': int(((participantes['grupo'] == g) & (participantes[coluna] == valor)).sum())
                            for g in ('A', 'B')}})
    tabela_cruz = pd.DataFrame(cruz)
    md = tabela_md(tabela) + '\n\nPor grupo:\n\n' + tabela_md(tabela_cruz)
    tabela.to_csv(RESULTADOS / 'A_perfil.csv', index=False)
    tabela_cruz.to_csv(RESULTADOS / 'A_perfil_por_grupo.csv', index=False)
    return md, tabela


# ---------------------------------------------------------------------------
# B. Descritiva por exercício × condição
# ---------------------------------------------------------------------------

def descrever(df: pd.DataFrame, loc: pd.DataFrame) -> tuple[dict[str, str], dict[str, Any]]:
    """Uma linha da descritiva. `loc` é o recorte para as medidas de localização (regra 2)."""
    n = len(df)
    texto: dict[str, str] = {
        'n': str(n),
        '% corrigido': pct(int(df['corrigido'].sum()), n),
        '% desistência': pct(int((df['desfecho'] == 'desistencia').sum()), n),
        '% tempo esgotado': pct(int((df['desfecho'] == 'tempo-esgotado').sum()), n),
    }
    numeros: dict[str, Any] = {
        'n': n, 'corrigidos': int(df['corrigido'].sum()),
        'desistencias': int((df['desfecho'] == 'desistencia').sum()),
        'tempos_esgotados': int((df['desfecho'] == 'tempo-esgotado').sum()),
    }

    def medir(rotulo: str, chave: str, serie: pd.Series, casas: int = 0) -> None:
        t, v = mediana_iqr(serie, casas)
        texto[rotulo] = t
        numeros.update({f'{chave}_{k}': x for k, x in v.items()})

    medir('localizar, s (n etapas)', 'localizar_s', loc['tempo_ate_localizacao_s'])
    texto['localizaram'] = pct(int(loc['localizou'].sum()), len(loc))
    numeros.update({'loc_etapas': len(loc), 'loc_localizaram': int(loc['localizou'].sum())})
    medir('corrigir, s (entre os que corrigiram)', 'corrigir_s', df.loc[df['corrigido'], 'tempo_ate_correcao_s'])
    intervalo = loc['intervalo_loc_corr_s']
    medir('localizar→corrigir, s', 'intervalo_s', intervalo)
    negativos = int((intervalo < 0).sum())
    texto['localizar→corrigir, s'] += f'; {negativos} negativo(s)' if negativos else ''
    numeros['intervalo_negativos'] = negativos
    medir('localização implícita, s (APROXIMADA)', 'implicita_aprox_s', loc['tempo_ate_localizacao_implicita_aprox_s'])
    for coluna, rotulo in [('execucoes', 'execuções'), ('navegacoes', 'navegações'),
                           ('passos_distintos_visitados', 'passos distintos'), ('retrocessos', 'retrocessos')]:
        medir(rotulo, coluna, df[coluna])
    if set(df['apoio']) == {COM}:
        medir('dicas distintas', 'dicas_distintas', df['dicas_distintas'])
    else:
        texto['dicas distintas'] = 'não se aplica' if set(df['apoio']) == {SEM} else '—'
    return texto, numeros


def analise_b(ex: pd.DataFrame) -> tuple[str, str, int]:
    def montar(recorte_loc: Callable[[pd.DataFrame], pd.DataFrame], sufixo: str) -> tuple[pd.DataFrame, pd.DataFrame]:
        textos, numeros = [], []
        grupos = [(NOME_DO_EXERCICIO[e], ex[ex['exercicio_id'] == e]) for e in ordem_dos_exercicios(ex)]
        grupos.append(('Todos os exercícios', ex))
        for nome, dele in grupos:
            for cond in (COM, SEM):
                df = dele[dele['apoio'] == cond]
                t, v = descrever(df, recorte_loc(df))
                textos.append({'exercício': nome, 'condição': NOME_DA_CONDICAO[cond], **t})
                numeros.append({'exercicio': nome, 'condicao': NOME_DA_CONDICAO[cond], **v})
        tn = pd.DataFrame(numeros)
        tn.to_csv(RESULTADOS / f'B_descritiva_{sufixo}.csv', index=False)
        return pd.DataFrame(textos), tn

    principal, _ = montar(lambda df: df[df['sem_recarga']], 'principal')
    sensib, _ = montar(lambda df: df, 'sensibilidade')
    colunas_loc = ['exercício', 'condição', 'localizaram', 'localizar, s (n etapas)', 'localizar→corrigir, s',
                   'localização implícita, s (APROXIMADA)']
    desfecho = ['exercício', 'condição', 'n', '% corrigido', '% desistência', '% tempo esgotado',
                'corrigir, s (entre os que corrigiram)']
    processo = ['exercício', 'condição', 'execuções', 'navegações', 'passos distintos', 'retrocessos', 'dicas distintas']
    excluidas = int((~ex['sem_recarga']).sum())
    md = (
        '**B1. Desfecho e tempo até corrigir** (as 105 etapas; regra 1). Tempos em segundos: '
        'mediana [Q1–Q3] (n).\n\n' + tabela_md(principal[desfecho])
        + f'\n\n**B2. Localização — análise principal** (só etapas sem recarga; regra 2: ficam de fora '
        f'{excluidas} das 105). "Localizaram" é a localização correta explícita; o tempo é só de quem '
        'localizou. A localização implícita é **aproximada** (D51) e só existe para quem corrigiu sem '
        'apontar a linha certa.\n\n' + tabela_md(principal[colunas_loc])
        + '\n\n**B3. Localização — sensibilidade** (todas as 105 etapas).\n\n' + tabela_md(sensib[colunas_loc])
        + '\n\n**B4. Processo** (as 105 etapas). Dicas só existem com apoio (regra 4: dicas distintas).\n\n'
        + tabela_md(principal[processo])
    )
    return md, '', excluidas


# ---------------------------------------------------------------------------
# C. Comparação pareada dentro do participante
# ---------------------------------------------------------------------------

def wilcoxon_pareado(com: np.ndarray, sem: np.ndarray, rng: np.random.Generator) -> dict[str, Any]:
    d = com - sem
    nao_zero = d[d != 0]
    resultado: dict[str, Any] = {
        'pares': len(d), 'pares_sem_empate_zero': len(nao_zero),
        'mediana_com': float(np.median(com)), 'mediana_sem': float(np.median(sem)),
        'diferenca_de_medianas': float(np.median(com) - np.median(sem)),
        'mediana_das_diferencas': float(np.median(d)),
    }
    # Bootstrap reamostrando participantes: o par vai junto.
    idx = rng.integers(0, len(d), size=(REAMOSTRAS, len(d)))
    difs = np.median(com[idx], axis=1) - np.median(sem[idx], axis=1)
    resultado['ic95_inf'], resultado['ic95_sup'] = (float(x) for x in np.percentile(difs, [2.5, 97.5]))
    if len(nao_zero) == 0:
        resultado.update({'W': np.nan, 'p': np.nan, 'metodo': 'todas as diferenças são zero', 'rank_biserial': np.nan})
        return resultado
    postos = stats.rankdata(np.abs(nao_zero))
    w_mais, w_menos = postos[nao_zero > 0].sum(), postos[nao_zero < 0].sum()
    # Exato só sem empates entre os |d| e com n ≤ 50, como o automático do scipy.
    empates = len(np.unique(np.abs(nao_zero))) < len(nao_zero)
    metodo = 'exact' if len(nao_zero) <= 50 and not empates else 'approx'
    teste = stats.wilcoxon(nao_zero, zero_method='wilcox', method=metodo, alternative='two-sided')
    resultado.update({
        'W': float(teste.statistic), 'p': float(teste.pvalue),
        'metodo': 'exato' if metodo == 'exact' else 'aproximação normal (há empates)',
        'W_mais': float(w_mais), 'W_menos': float(w_menos),
        'rank_biserial': float((w_mais - w_menos) / (w_mais + w_menos)),
    })
    return resultado


def medias_por_participante(ex: pd.DataFrame, coluna: str, recorte: pd.Series | None = None) -> pd.DataFrame:
    df = ex if recorte is None else ex[recorte]
    medias = df.groupby(['participante_id', 'apoio'])[coluna].mean().unstack('apoio')
    return medias.dropna(subset=[COM, SEM])


def analise_c(ex: pd.DataFrame) -> tuple[str, pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(SEMENTE)
    medidas = [
        ('Proporção de etapas corrigidas', 'corrigido', None, 'proporção'),
        ('Tempo até corrigir, censurado em 600 s', 'tempo_correcao_censurado_s', None, 's'),
        ('Tempo até localizar — principal (sem recarga)', 'tempo_ate_localizacao_s', ex['sem_recarga'], 's'),
        ('Tempo até localizar — sensibilidade (todas)', 'tempo_ate_localizacao_s', None, 's'),
        ('Proporção com localização explícita — principal (sem recarga)', 'localizou', ex['sem_recarga'], 'proporção'),
        ('Proporção com localização explícita — sensibilidade (todas)', 'localizou', None, 'proporção'),
    ]
    linhas = []
    pares_tempo_corr = None
    for nome, coluna, recorte, unidade in medidas:
        m = medias_por_participante(ex, coluna, recorte)
        r = wilcoxon_pareado(m[COM].to_numpy(float), m[SEM].to_numpy(float), rng)
        linhas.append({'medida': nome, 'unidade': unidade, **r})
        if coluna == 'tempo_correcao_censurado_s':
            pares_tempo_corr = m
    tabela = pd.DataFrame(linhas)
    tabela.to_csv(RESULTADOS / 'C_comparacao_pareada.csv', index=False)

    casas = lambda u: 2 if u == 'proporção' else 0  # noqa: E731
    exibida = pd.DataFrame([{
        'medida': r.medida,
        'pares (sem zero)': f'{r.pares} ({r.pares_sem_empate_zero})',
        'mediana com': num(r.mediana_com, casas(r.unidade)),
        'mediana sem': num(r.mediana_sem, casas(r.unidade)),
        'diferença de medianas [IC 95% bootstrap]':
            f'{num(r.diferenca_de_medianas, casas(r.unidade))} '
            f'[{num(r.ic95_inf, casas(r.unidade))}; {num(r.ic95_sup, casas(r.unidade))}]',
        'W': num(r.W, 1), 'p': num(r.p, 3), 'r rank-biserial': num(r.rank_biserial, 2), 'método': r.metodo,
    } for r in tabela.itertuples()])
    md = ('Para cada participante, a média das etapas com apoio e a das etapas sem apoio; o teste é sobre a '
          'diferença (com − sem). Diferença positiva: maior com apoio. Wilcoxon pareado bicaudal, pares com '
          f'diferença zero descartados; IC 95% percentil, {num(REAMOSTRAS)} reamostras de participantes, semente '
          f'{SEMENTE}. Nas medidas de tempo de localização, a etapa sem localização explícita não entra na '
          'média (D52), e entra no par só quem tem ao menos uma em cada condição.\n\n'
          + tabela_md(exibida))
    return md, tabela, pares_tempo_corr


# ---------------------------------------------------------------------------
# D. Modelo misto (complemento)
# ---------------------------------------------------------------------------

def analise_d(ex: pd.DataFrame) -> str:
    contagem = []
    for e in ordem_dos_exercicios(ex):
        dele = ex[ex['exercicio_id'] == e]
        linha = {'exercício': NOME_DO_EXERCICIO[e]}
        for cond in (COM, SEM):
            df = dele[dele['apoio'] == cond]
            linha[f'corrigidas {NOME_DA_CONDICAO[cond]}'] = f"{int(df['corrigido'].sum())}/{len(df)}"
        linha['corrigidas no total'] = f"{int(dele['corrigido'].sum())}/{len(dele)}"
        contagem.append(linha)
    tabela = pd.DataFrame(contagem)
    tabela.to_csv(RESULTADOS / 'D_corrigido_por_exercicio_e_apoio.csv', index=False)

    separados = [NOME_DO_EXERCICIO[e] for e in ordem_dos_exercicios(ex)
                 if ex.loc[ex['exercicio_id'] == e, 'corrigido'].nunique() < 2]
    partes = ['Tabela de corrigido por exercício × apoio (sempre reportada):\n', tabela_md(tabela), '']

    from statsmodels.genmod.bayes_mixed_glm import BinomialBayesMixedGLM

    dados = ex.assign(y=ex['corrigido'].astype(int),
                      apoio_sem=(ex['apoio'] == SEM).astype(int))
    ajustes: dict[str, Any] = {}
    avisos: list[str] = []
    for nome in ('map', 'vb'):
        modelo = BinomialBayesMixedGLM.from_formula(
            "y ~ apoio_sem + C(exercicio_id, Treatment('pilha-desempilhar'))",
            {'participante': '0 + C(participante_id)'}, dados)
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter('always')
            res = modelo.fit_map() if nome == 'map' else modelo.fit_vb()
            avisos += [f'{nome}: {x.message}' for x in w]
        i = list(modelo.exog_names).index('apoio_sem')
        ajustes[nome] = {'coef': float(res.fe_mean[i]), 'sd': float(res.fe_sd[i]),
                         'sd_participante': float(np.exp(res.vcp_mean[0]))}
    a, b = ajustes['map']['coef'], ajustes['vb']['coef']
    concorda = np.sign(a) == np.sign(b) and 0.8 <= (a / b if b else np.inf) <= 1.25
    estavel = concorda and not separados and not avisos

    linhas_modelo = pd.DataFrame([{
        'ajuste': k, 'coef. sem apoio (log-odds)': num(v['coef'], 2), 'EP aprox.': num(v['sd'], 2),
        'OR sem/com': num(np.exp(v['coef']), 2),
        'OR IC 95% aprox.': f"{num(np.exp(v['coef'] - 1.96 * v['sd']), 2)}–{num(np.exp(v['coef'] + 1.96 * v['sd']), 2)}",
        'DP do participante': num(v['sd_participante'], 2),
    } for k, v in ajustes.items()])
    criterio = (f"Critério de estabilidade (D52): sinal igual e razão MAP/VB entre 0,8 e 1,25 "
                f"(razão = {num(a / b if b else np.nan, 2)}); nenhum exercício com desfecho único "
                f"({', '.join(separados) if separados else 'nenhum'}); avisos do ajuste: "
                f"{'; '.join(sorted(set(avisos))) if avisos else 'nenhum'}.")
    if estavel:
        partes += ['Modelo `corrigido ~ apoio + exercício + (1|participante)`, `BinomialBayesMixedGLM` '
                   '(statsmodels). Referência: com apoio e Pilha. OR < 1: menos chance de corrigir sem apoio.\n',
                   tabela_md(linhas_modelo), '', criterio + ' **Estável: reportado.**']
        linhas_modelo.to_csv(RESULTADOS / 'D_modelo_misto.csv', index=False)
    else:
        partes += [criterio + ' **Não estável: o modelo não é reportado como resultado**, e a tabela acima '
                   'fica no lugar dele. Os ajustes, só para registro:\n', tabela_md(linhas_modelo)]
    return '\n'.join(partes)


# ---------------------------------------------------------------------------
# E. Questionário
# ---------------------------------------------------------------------------

def faixa_do_sus(media: float) -> str:
    abaixo = [a for a in ADJETIVOS_DO_SUS if a[1] <= media]
    acima = [a for a in ADJETIVOS_DO_SUS if a[1] > media]
    if not abaixo:
        return f'abaixo da média de "{acima[0][0]}" ({num(acima[0][1], 1)})'
    if not acima:
        return f'acima da média de "{abaixo[-1][0]}" ({num(abaixo[-1][1], 1)})'
    return (f'entre as médias de "{abaixo[-1][0]}" ({num(abaixo[-1][1], 1)}) e '
            f'"{acima[0][0]}" ({num(acima[0][1], 1)})')


def analise_e(p: pd.DataFrame, textos: dict[str, str]) -> tuple[str, pd.Series]:
    sus = p['sus_escore'].dropna()
    resumo = pd.DataFrame([{
        'n': len(sus), 'média': num(sus.mean(), 1), 'DP': num(sus.std(ddof=1), 1), 'mediana': num(sus.median(), 1),
        'mín–máx': f'{num(sus.min(), 1)}–{num(sus.max(), 1)}', 'faixa adjetiva (Bangor et al., 2009)': faixa_do_sus(sus.mean()),
    }])
    pd.DataFrame([{'n': len(sus), 'media': sus.mean(), 'dp': sus.std(ddof=1), 'mediana': sus.median(),
                   'min': sus.min(), 'max': sus.max(), 'faixa_adjetiva': faixa_do_sus(sus.mean())}]
                 ).to_csv(RESULTADOS / 'E_sus.csv', index=False)

    versoes = p['versao_do_questionario'].astype('Int64').value_counts().to_dict()
    itens = []
    for prefixo, quantos in (('vis', 6), ('rec', 4)):
        for i in range(1, quantos + 1):
            col = f'{prefixo}_{i}'
            v = p[col]
            linha = {'item': col.replace('_', '-'), 'texto': textos[col]}
            for nota in range(1, 6):
                linha[str(nota)] = int((v == nota).sum())
            # Na versão 2, vazio nos recursos é "Não usei" (D42).
            linha['não usei'] = int(v.isna().sum()) if prefixo == 'rec' else '—'
            linha['mediana'] = num(v.median(), 1)
            linha['n com nota'] = int(v.notna().sum())
            itens.append(linha)
    tabela_itens = pd.DataFrame(itens)
    tabela_itens.to_csv(RESULTADOS / 'E_itens_vis_rec.csv', index=False)

    sus_itens = pd.DataFrame([{
        'item': f'sus-{i}', 'texto': textos[f'sus_{i}'],
        **{str(n): int((p[f'sus_{i}'] == n).sum()) for n in range(1, 6)},
        'mediana': num(p[f'sus_{i}'].median(), 1),
    } for i in range(1, 11)])
    sus_itens.to_csv(RESULTADOS / 'E_itens_sus.csv', index=False)

    md = (f"Versões do questionário: {', '.join(f'v{k}: {v}' for k, v in versoes.items())}. "
          'Escala de 1 (Discordo fortemente) a 5 (Concordo fortemente).\n\n'
          '**E1. SUS**\n\n' + tabela_md(resumo)
          + '\n\nMédias por adjetivo em Bangor et al. (2009): '
          + '; '.join(f'{a} {num(v, 1)}' for a, v in ADJETIVOS_DO_SUS) + '.\n\n'
          '**E2. Itens do SUS** (contagem de cada nota; os pares são invertidos no escore)\n\n' + tabela_md(sus_itens)
          + '\n\n**E3. Visualização (vis) e recursos (rec)** (contagem de cada nota)\n\n' + tabela_md(tabela_itens))
    return md, sus


def respostas_abertas(p: pd.DataFrame) -> str:
    """
    As citações editadas de D53, e nunca o texto bruto. A edição vive com os
    dados (`dados/respostas_editadas.json`, fora do git), porque é texto dos
    participantes; falta de edição para uma resposta para o script, em vez
    de deixar o texto bruto vazar para o relatório.
    """
    editadas = json.loads((AQUI / 'dados' / 'respostas_editadas.json').read_text(encoding='utf-8'))
    partes = [
        'Citações editadas (D53): fica só o conteúdo sobre a ferramenta. Trechos retirados aparecem '
        'como "[…]", nomes de terceiros como "[nome]". Parte das respostas veio em tom de brincadeira '
        'ou com declarações pessoais dirigidas ao pesquisador, o que é registrado como limitação '
        '(desejabilidade social) e não é citado.\n',
    ]
    for campo, pergunta in (('ajudou', 'O que foi mais útil na ferramenta, e por quê?'),
                            ('atrapalhou', 'O que atrapalhou ou faltou?')):
        dele = p.sort_values('ordem_de_entrada')
        respondidas = dele[dele[campo].notna()]
        partes.append(f'**"{pergunta}"** — {len(respondidas)} de {len(p)} responderam.\n')
        for r in respondidas.itertuples():
            codigo = f'P{int(r.ordem_de_entrada):02d}'
            texto = editadas.get(codigo, {}).get(campo)
            if texto is None:
                sys.exit(f'Falta a citação editada de {codigo} ({campo}) em dados/respostas_editadas.json.')
            nota = editadas[codigo].get(f'nota_{campo}')
            partes.append(f'- **{codigo}** (grupo {r.grupo}): {texto}' + (f' *Nota: {nota}*' if nota else ''))
        partes.append('')
    return '\n'.join(partes)


# ---------------------------------------------------------------------------
# F. Figuras
# ---------------------------------------------------------------------------

def estilo() -> None:
    plt.rcParams.update({
        'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False,
        'axes.edgecolor': '#444444', 'axes.linewidth': 0.8, 'xtick.color': '#333333', 'ytick.color': '#333333',
        'axes.grid': True, 'axes.grid.axis': 'y', 'grid.color': '#dddddd', 'grid.linewidth': 0.6,
        'axes.axisbelow': True, 'savefig.dpi': 200, 'savefig.bbox': 'tight', 'figure.facecolor': 'white',
    })


# Preto e branco: com apoio é cinza escuro sólido; sem apoio é branco com hachura.
ESTILO_DA_CONDICAO = {
    COM: {'facecolor': '#555555', 'edgecolor': 'black', 'hatch': ''},
    SEM: {'facecolor': 'white', 'edgecolor': 'black', 'hatch': '///'},
}


def figura_corrigido(ex: pd.DataFrame) -> str:
    ordem = ordem_dos_exercicios(ex)
    fig, ax = plt.subplots(figsize=(7.5, 4.0))
    largura = 0.38
    for k, cond in enumerate((COM, SEM)):
        for i, e in enumerate(ordem):
            df = ex[(ex['exercicio_id'] == e) & (ex['apoio'] == cond)]
            valor = 100 * df['corrigido'].mean()
            x = i + (k - 0.5) * largura
            ax.bar(x, valor, width=largura - 0.04, linewidth=0.8,
                   label=NOME_DA_CONDICAO[cond] if i == 0 else None, **ESTILO_DA_CONDICAO[cond])
            ax.text(x, valor + 1.5, f"{num(valor)}%\n{int(df['corrigido'].sum())}/{len(df)}",
                    ha='center', va='bottom', fontsize=8)
    # Número da etapa em cima, nome embaixo: "Lista encadeada" não cabe numa linha só.
    ax.set_xticks(range(len(ordem)), [f'Etapa {i + 1}\n{NOME_DO_EXERCICIO[e]}' for i, e in enumerate(ordem)])
    ax.set_ylim(0, 118)
    ax.set_yticks(range(0, 101, 20))
    ax.set_ylabel('Etapas corrigidas (%)')
    ax.set_title('Etapas corrigidas por exercício e condição', loc='left', fontsize=11)
    ax.legend(frameon=False, ncols=2, loc='upper left', bbox_to_anchor=(0, 1.02))
    caminho = FIGURAS / 'F1_corrigido_por_exercicio.png'
    fig.savefig(caminho)
    plt.close(fig)
    return caminho.name


def figura_pareada(pares: pd.DataFrame) -> str:
    fig, ax = plt.subplots(figsize=(4.8, 4.4))
    com, sem = pares[COM].to_numpy(), pares[SEM].to_numpy()
    for a, b in zip(com, sem):
        ax.plot([1, 2], [a, b], color='#9a9a9a', linewidth=0.9, zorder=1)
    ax.scatter(np.ones_like(com), com, s=22, color='black', zorder=3)
    ax.scatter(np.full_like(sem, 2), sem, s=22, facecolor='white', edgecolor='black', zorder=3)
    caixas = ax.boxplot([com, sem], positions=[1, 2], widths=0.35, patch_artist=True, showfliers=False,
                        medianprops={'color': 'black', 'linewidth': 1.6}, zorder=2)
    for caixa in caixas['boxes']:
        caixa.set(facecolor='none', edgecolor='black', linewidth=0.9)
    ax.axhline(CENSURA_S, color='black', linestyle=':', linewidth=0.9)
    ax.text(0.55, CENSURA_S + 8, 'censura: não corrigiu (600 s)', va='bottom', fontsize=8)
    ax.set_xticks([1, 2], ['com apoio', 'sem apoio'])
    ax.set_xlim(0.5, 2.5)
    ax.set_ylim(0, 660)
    ax.set_ylabel('Média do tempo até corrigir (s)')
    ax.set_title(f'Tempo até corrigir, por participante (n = {len(pares)})', loc='left', fontsize=11)
    caminho = FIGURAS / 'F2_tempo_ate_corrigir_pareado.png'
    fig.savefig(caminho)
    plt.close(fig)
    return caminho.name


def figura_sus(sus: pd.Series) -> str:
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    # O SUS vai em passos de 2,5; caixas de 5 pontos, e o eixo começa em 50
    # porque nenhum escore ficou abaixo disso (o título diz o intervalo todo).
    bordas = np.arange(50, 101, 5)
    ax.hist(sus, bins=bordas, facecolor='#777777', edgecolor='white', linewidth=1.5)
    ax.axvline(sus.mean(), color='black', linewidth=1.2)
    ax.text(sus.mean() - 1, ax.get_ylim()[1] * 0.95, f'média {num(sus.mean(), 1)}', ha='right', va='top', fontsize=8)
    if sus.min() < 50:
        sys.exit('Há escore SUS abaixo de 50: refazer o eixo da figura F3.')
    ax.set_xlim(50, 100)
    ax.set_xticks(bordas)
    ax.yaxis.get_major_locator().set_params(integer=True)
    ax.set_xlabel('Escore SUS')
    ax.set_ylabel('Participantes')
    ax.set_title(f'Distribuição do SUS (n = {len(sus)}; eixo a partir de 50)', loc='left', fontsize=11)
    caminho = FIGURAS / 'F3_sus.png'
    fig.savefig(caminho)
    plt.close(fig)
    return caminho.name


# ---------------------------------------------------------------------------
# Relatório
# ---------------------------------------------------------------------------

def leituras() -> dict[str, str]:
    caminho = SAIDA / 'leituras.md'
    if not caminho.exists():
        return {}
    blocos = re.split(r'^## ', caminho.read_text(encoding='utf-8'), flags=re.M)
    return {b.split('\n', 1)[0].strip(): b.split('\n', 1)[1].strip() for b in blocos if b.strip() and '\n' in b}


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    for pasta in (FIGURAS, RESULTADOS):
        pasta.mkdir(parents=True, exist_ok=True)
    estilo()
    ex, p = ler()
    textos = itens_do_questionario()
    lido = leituras()

    def leitura(secao: str) -> str:
        return '**Leitura.** ' + lido.get(secao, '_(pendente)_')

    md_a, _ = analise_a(p)
    md_b, _, excluidas = analise_b(ex)
    md_c, _, pares = analise_c(ex)
    md_d = analise_d(ex)
    md_e, sus = analise_e(p, textos)
    f1, f2, f3 = figura_corrigido(ex), figura_pareada(pares), figura_sus(sus)

    relatorio = f"""# Análise da coleta aeds-2026

Gerado por `analise/analisar.py`, com as regras de D52 (registradas antes dos resultados). Estudo
exploratório, n = 21. Contém respostas abertas na íntegra: fica fora do git.

Recortes: 105 etapas de exercício (1 a 5) de 21 participantes; o aquecimento fica fora (regra 5).
Localização: principal só nas {105 - excluidas} etapas sem recarga, sensibilidade nas 105 (regra 2).
Tempos de quem não corrigiu censurados em 600 s na comparação pareada (regra 6).

**Limitação do registro (regra 3).** O intervalo de 10 s entre tentativas de localização (D25) vale
dentro de uma sessão, e a recarga abre uma sessão nova. Nas etapas com recarga, houve tentativas
julgadas a menos de 10 s uma da outra no relógio (8 pares, em 2 participantes; relatório da
consolidação). É um fato do registro, sem juízo sobre a intenção, e é a razão de a análise principal
da localização ficar só nas etapas sem recarga.

## A. Perfil da amostra

{md_a}

{leitura('A')}

## B. Descritiva por exercício × condição

{md_b}

{leitura('B')}

## C. Comparação dentro do participante (principal)

{md_c}

![Tempo até corrigir, pareado](figuras/{f2})

{leitura('C')}

## D. Complemento: corrigido ~ apoio + exercício + (1|participante)

{md_d}

{leitura('D')}

## E. Questionário

{md_e}

![Distribuição do SUS](figuras/{f3})

{leitura('E')}

### Respostas abertas, na íntegra

{respostas_abertas(p)}
### Agrupamento por tema — PROPOSTA, para validar

{lido.get('E-temas', '_(pendente)_')}

## F. Figuras

![Etapas corrigidas por exercício e condição](figuras/{f1})

![Tempo até corrigir, pareado](figuras/{f2})

![Distribuição do SUS](figuras/{f3})

{leitura('F')}
"""
    (SAIDA / 'relatorio_analise.md').write_text(relatorio, encoding='utf-8')
    print(f'Relatório: {SAIDA / "relatorio_analise.md"}')
    print(f'Tabelas agregadas: {RESULTADOS}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
