"""
Consolidação dos dados da coleta (fase de análise do TCC).

Junta as sessões do banco com as que ficaram só no aparelho, e monta UMA linha
por participante × etapa a partir dos pedaços que a recarga da página criou.

Por que há pedaços: no percurso do estudo, recarregar a página no meio de um
exercício abre uma sessão nova, com id novo e `t` recomeçando do zero, e a
anterior fica arquivada sem `encerramento` (desfecho "sem-encerramento"). O
prazo da etapa, por outro lado, é de relógio de parede e não recomeça. As
regras daqui estão em docs/decisoes.md (D51).

Uso, da raiz do repositório:

    analise/.venv/Scripts/python.exe analise/consolidar.py

Lê analise/dados/ e escreve analise/saida/. As duas pastas estão fora do git:
o repositório é público e os dados são por participante. Só este código é
versionado.

O plano do percurso e o catálogo são lidos do próprio código da ferramenta
(src/estudo/percurso.ts e src/exercicios/), e não copiados aqui: se as duas
cópias divergissem, a conferência do apoio passaria contra o plano errado.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

import pandas as pd

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent

APLICACAO = 'aeds-2026'
VERSAO_ESPERADA = 16
# Folga na conferência do prazo: o cronômetro da tela dispara por setTimeout,
# e o retrato do encerramento sai alguns milissegundos depois do prazo.
TOLERANCIA_DO_PRAZO_MS = 5_000
ESPERADO = {'participantes': 21, 'A': 12, 'B': 9}

Evento = dict[str, Any]
Sessao = dict[str, Any]


# ---------------------------------------------------------------------------
# Plano e catálogo, lidos do código da ferramenta
# ---------------------------------------------------------------------------

def ler_plano() -> tuple[list[dict[str, Any]], int]:
    """As etapas de src/estudo/percurso.ts: exercício, aquecimento e apoio por grupo."""
    texto = (RAIZ / 'src/estudo/percurso.ts').read_text(encoding='utf-8')
    minutos = re.search(r'LIMITE_POR_EXERCICIO_MS = (\d+) \* 60_000', texto)
    if not minutos:
        sys.exit('Não achei LIMITE_POR_EXERCICIO_MS em percurso.ts.')
    limite_ms = int(minutos.group(1)) * 60_000
    apoios = {
        nome: {'A': a, 'B': b}
        for nome, a, b in re.findall(
            r"const (\w+) = \{ A: '([\w-]+)', B: '([\w-]+)' \} as const;", texto
        )
    }
    bloco = texto.split('export const ETAPAS', 1)[1].split('];', 1)[0]
    etapas = [
        {'exercicio_id': ex, 'aquecimento': aq == 'true', 'apoio': apoios[ap]}
        for ex, aq, ap in re.findall(
            r"\{ exercicioId: '([\w-]+)', aquecimento: (true|false), limiteMs: [\w_]+, apoio: (\w+) \}",
            bloco,
        )
    ]
    if len(etapas) != 6:
        sys.exit(f'Esperava 6 etapas em percurso.ts e achei {len(etapas)}.')
    return etapas, limite_ms


def ler_exercicio(exercicio_id: str) -> dict[str, Any]:
    """O código inicial e as linhas do defeito, do arquivo do catálogo."""
    texto = (RAIZ / 'src/exercicios' / f'{exercicio_id}.ts').read_text(encoding='utf-8')
    texto = texto.replace('\r\n', '\n')
    codigo = re.search(r'codigoComDefeito:\s*`([^`]*)`', texto)
    linha = re.search(r'linhaDoDefeito:\s*(\d+)', texto)
    if not codigo or not linha:
        sys.exit(f'Não consegui ler o exercício {exercicio_id}.')
    aceitas = re.search(r'linhasAceitas:\s*\[([\d,\s]+)\]', texto)
    linhas = [int(n) for n in aceitas.group(1).split(',')] if aceitas else [int(linha.group(1))]
    return {'codigo': codigo.group(1), 'linhas_do_defeito': linhas}


# ---------------------------------------------------------------------------
# Resumo de uma sessão — a mesma regra de src/nucleo/metricas.ts
# ---------------------------------------------------------------------------
# Reimplementado, e não lido do `resumo` gravado, pelo mesmo motivo do CSV da
# ferramenta (D6): o log é a fonte. A conferência 5 compara este resumo com o
# CSV em todas as sessões do banco, e é ela que garante que as regras batem.

def do_estudante(eventos: list[Evento]) -> list[Evento]:
    return [e for e in eventos if e['tipo'] == 'execucao' and e['origem'] == 'estudante']


def gestos(eventos: list[Evento]) -> list[Evento]:
    return [e for e in eventos if e['tipo'] == 'navegacao' and e['gesto'] != 'parou']


def chaves_dos_passos_visitados(eventos: list[Evento]) -> set[tuple[int, int]]:
    """Pares (execução exibida, passo), como `passosDistintosVisitados`."""
    chegadas = sorted(
        (
            (posicao, e['tResultado'])
            for posicao, e in enumerate(eventos)
            if e['tipo'] == 'execucao' and isinstance(e.get('tResultado'), (int, float))
        ),
        key=lambda c: c[1],
    )

    def exibida_em(t: float, anterior: bool) -> int:
        ate = [c for c in chegadas if c[1] <= t]
        quantas = 2 if anterior else 1
        return ate[-quantas][0] if len(ate) >= quantas else -1

    visitados: set[tuple[int, int]] = set()
    for e in eventos:
        if e['tipo'] != 'navegacao':
            continue
        execucao = exibida_em(e['t'], e['gesto'] == 'parou' and e.get('motivo') == 'nova-execucao')
        if e['gesto'] in ('avancar', 'voltar', 'arrastar'):
            visitados.add((execucao, e['para']))
        elif e['gesto'] in ('pausar', 'parou'):
            for p in range(min(e['de'], e['para']), max(e['de'], e['para']) + 1):
                visitados.add((execucao, p))
    return visitados


def primeiro_t(eventos: list[Evento], condicao: Callable[[Evento], bool]) -> float | None:
    """O `t` do primeiro evento do log que satisfaz a condição, na ordem do log."""
    return next((e['t'] for e in eventos if condicao(e)), None)


def eh_correcao(e: Evento) -> bool:
    return e['tipo'] == 'execucao' and e['origem'] == 'estudante' and e['todosPassaram']


def eh_localizacao_correta(e: Evento) -> bool:
    return e['tipo'] == 'localizacao' and e['correta']


def eh_execucao_do_estudante(e: Evento) -> bool:
    return e['tipo'] == 'execucao' and e['origem'] == 'estudante'


def eh_gesto(e: Evento) -> bool:
    return e['tipo'] == 'navegacao' and e['gesto'] != 'parou'


def resumir(eventos: list[Evento]) -> dict[str, Any]:
    estudante = do_estudante(eventos)
    g = gestos(eventos)
    return {
        'tempo_ate_primeira_execucao_ms': primeiro_t(eventos, eh_execucao_do_estudante),
        'tempo_ate_localizacao_ms': primeiro_t(eventos, eh_localizacao_correta),
        'tempo_ate_correcao_ms': primeiro_t(eventos, eh_correcao),
        'execucoes': len(estudante),
        'execucoes_com_erro': sum(1 for e in estudante if e['erro'] is not None),
        'dicas_reveladas': sum(1 for e in eventos if e['tipo'] == 'dica'),
        'edicoes': sum(1 for e in eventos if e['tipo'] == 'edicao'),
        'localizacoes_tentadas': sum(1 for e in eventos if e['tipo'] == 'localizacao'),
        'corrigido': any(e['todosPassaram'] for e in estudante),
        'navegacoes': len(g),
        'passos_distintos_visitados': len(chaves_dos_passos_visitados(eventos)),
        'retrocessos': sum(
            1 for e in g if e['gesto'] == 'voltar' or (e['gesto'] == 'arrastar' and e['para'] < e['de'])
        ),
        'tempo_ate_primeira_navegacao_ms': primeiro_t(eventos, eh_gesto),
    }


def desfecho(eventos: list[Evento]) -> str:
    """`desfechoNoEstudo`: corrigir vale mais que o gesto do fim."""
    if any(eh_correcao(e) for e in eventos):
        return 'corrigido'
    encerramento = next((e for e in eventos if e['tipo'] == 'encerramento'), None)
    if encerramento is None:
        return 'sem-encerramento'
    return 'desistencia' if encerramento['motivo'] == 'seguir' else 'tempo-esgotado'


def duracao_ativa(sessao: Sessao, limiar_ms: int = 5 * 60_000) -> float:
    """`duracaoAtivaMs` (D26): a duração sem os silêncios maiores que cinco minutos."""
    instantes = sorted(e['t'] for e in sessao['eventos'])
    marcos = [0, *instantes, max(sessao['duracaoTotalMs'], instantes[-1] if instantes else 0)]
    return sum(b - a for a, b in zip(marcos, marcos[1:]) if b - a <= limiar_ms)


# ---------------------------------------------------------------------------
# Localização implícita (medida secundária, aproximada)
# ---------------------------------------------------------------------------

def sem_espacos(linha: str) -> str:
    # Indentação e espaços internos não contam: `topo=topo+1` e
    # `topo = topo + 1` são a mesma linha para quem está caçando o defeito.
    return re.sub(r'\s+', '', linha)


def mexeu_no_defeito(codigo: str, inicial: list[str], indices_do_defeito: list[int]) -> bool:
    """
    Se o texto de alguma linha do defeito deixou de existir no código editado.

    A comparação é por conteúdo, alinhando o código editado ao inicial: quem
    insere linhas acima do defeito desloca a numeração, mas não mexeu nele.
    Uma troca de ordem entre as duas linhas aceitas desfaz o casamento de uma
    delas, e conta como mexer.
    """
    novo = [sem_espacos(l) for l in codigo.split('\n')]
    casadas: set[int] = set()
    for bloco in difflib.SequenceMatcher(None, inicial, novo, autojunk=False).get_matching_blocks():
        casadas.update(range(bloco.a, bloco.a + bloco.size))
    return any(i not in casadas for i in indices_do_defeito)


# ---------------------------------------------------------------------------
# Leitura e junção
# ---------------------------------------------------------------------------

def da_aplicacao(sessoes: list[Sessao]) -> list[Sessao]:
    return [s for s in sessoes if (s.get('estudo') or {}).get('aplicacao') == APLICACAO]


def juntar_fontes(dados: Path) -> tuple[list[Sessao], dict[str, Any]]:
    banco = da_aplicacao(json.loads((dados / 'metricas-banco.json').read_text(encoding='utf-8'))['sessoes'])
    por_id: dict[str, Sessao] = {}
    for s in banco:
        por_id[s['id']] = {**s, '_fonte': 'banco'}
    info: dict[str, Any] = {'banco': len(banco), 'aparelhos': {}}

    for arquivo in sorted(dados.glob('metricas-aparelho-*.json')):
        todas = json.loads(arquivo.read_text(encoding='utf-8'))['sessoes']
        do_estudo = da_aplicacao(todas)
        novas = iguais = diferentes = 0
        for s in do_estudo:
            ja = por_id.get(s['id'])
            if ja is None:
                por_id[s['id']] = {**s, '_fonte': 'aparelho'}
                novas += 1
                continue
            copia = {k: v for k, v in ja.items() if k != '_fonte'}
            if json.dumps(copia, sort_keys=True) == json.dumps(s, sort_keys=True):
                iguais += 1
            else:
                # O arquivamento regrava a sessão pelo id a cada retrato; a
                # cópia com mais eventos é o retrato mais tardio.
                diferentes += 1
                if len(s['eventos']) > len(ja['eventos']):
                    por_id[s['id']] = {**s, '_fonte': 'aparelho'}
        info['aparelhos'][arquivo.name] = {
            'no_arquivo': len(todas),
            'da_aplicacao': len(do_estudo),
            'novas': novas,
            'ja_no_banco_iguais': iguais,
            'ja_no_banco_diferentes': diferentes,
        }
    info['total'] = len(por_id)
    return list(por_id.values()), info


def ler_csv(dados: Path) -> pd.DataFrame:
    csv = pd.read_csv(dados / f'estudo-{APLICACAO}.csv', keep_default_na=True)
    return csv[csv['aplicacao'] == APLICACAO]


COLUNAS_DO_PARTICIPANTE_NO_CSV = (
    ['participante_id', 'grupo', 'ordem_de_entrada', 'perfil_aeds1', 'perfil_depurador',
     'perfil_visualizacao', 'suspeito', 'motivos_de_suspeita', 'versao_do_questionario']
    + [f'sus_{i}' for i in range(1, 11)] + ['sus_escore']
    + [f'vis_{i}' for i in range(1, 7)] + [f'rec_{i}' for i in range(1, 5)]
    + ['ajudou', 'atrapalhou']
)


def participantes_do_csv(csv: pd.DataFrame) -> pd.DataFrame:
    """Uma linha por participante. Perfil e questionário se repetem no CSV, e precisam ser iguais."""
    tabela = csv[COLUNAS_DO_PARTICIPANTE_NO_CSV]
    unicas = tabela.drop_duplicates()
    if unicas['participante_id'].duplicated().any():
        sys.exit('O CSV traz perfil ou questionário diferentes para o mesmo participante.')
    return unicas.set_index('participante_id')


# ---------------------------------------------------------------------------
# Consolidação
# ---------------------------------------------------------------------------

def instante(iso: str) -> datetime:
    """O `instanteDeInicio` (ISO 8601 em UTC, com Z) como datetime com fuso."""
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def consolidar_etapa(pedacos: list[Sessao], exercicio: dict[str, Any]) -> dict[str, Any]:
    """Uma linha a partir dos pedaços de uma etapa, já em ordem de início."""
    deslocamentos: list[float] = []
    acumulado = 0.0
    for s in pedacos:
        deslocamentos.append(acumulado)
        acumulado += s['duracaoTotalMs']

    def primeiro(condicao: Callable[[Evento], bool]) -> float | None:
        # Desde o início do 1º pedaço: soma a duração dos anteriores ao t.
        for s, desloc in zip(pedacos, deslocamentos):
            t = primeiro_t(s['eventos'], condicao)
            if t is not None:
                return desloc + t
        return None

    resumos = [resumir(s['eventos']) for s in pedacos]
    desfechos = [desfecho(s['eventos']) for s in pedacos]
    encerrados = [d for d in desfechos if d != 'sem-encerramento']
    inicios = [instante(s['instanteDeInicio']) for s in pedacos]
    fim = inicios[-1] + timedelta(milliseconds=pedacos[-1]['duracaoTotalMs'])
    relogio = (fim - inicios[0]).total_seconds() * 1000

    linha: dict[str, Any] = {
        'n_pedacos': len(pedacos),
        'sessoes_ids': ';'.join(s['id'] for s in pedacos),
        'fontes': ';'.join(sorted({s['_fonte'] for s in pedacos})),
        'desfechos_dos_pedacos': ';'.join(desfechos),
        'instante_de_inicio': pedacos[0]['instanteDeInicio'],
        'duracao_total_ms': acumulado,
        'duracao_ativa_ms': sum(duracao_ativa(s) for s in pedacos),
        # Do início do 1º pedaço ao fim do último, no relógio de parede. A
        # diferença para a soma é o tempo perdido entre uma carga e outra.
        'duracao_no_relogio_ms': round(relogio),
        'lacunas_entre_pedacos_ms': round(relogio - acumulado),
        'desfecho': encerrados[-1] if encerrados else None,
        'tempo_ate_primeira_execucao_ms': primeiro(eh_execucao_do_estudante),
        'tempo_ate_localizacao_ms': primeiro(eh_localizacao_correta),
        'tempo_ate_correcao_ms': primeiro(eh_correcao),
        'tempo_ate_primeira_navegacao_ms': primeiro(eh_gesto),
    }
    for campo in ('execucoes', 'execucoes_com_erro', 'dicas_reveladas', 'edicoes',
                  'localizacoes_tentadas', 'navegacoes', 'retrocessos'):
        linha[campo] = sum(r[campo] for r in resumos)
    # A recarga volta as dicas a ocultas; quem revela a mesma de novo entra
    # duas vezes na soma. As distintas dizem quantas a pessoa chegou a ver.
    linha['dicas_distintas'] = len({e['indice'] for s in pedacos for e in s['eventos'] if e['tipo'] == 'dica'})
    # União dos pares (pedaço, execução, passo). Execuções de pedaços
    # diferentes são execuções diferentes, e a união é a soma.
    linha['passos_distintos_visitados'] = len(
        {(i, *chave) for i, s in enumerate(pedacos) for chave in chaves_dos_passos_visitados(s['eventos'])}
    )
    linha['corrigido'] = linha['desfecho'] == 'corrigido'
    linha['corrigido_em_algum_pedaco'] = any(r['corrigido'] for r in resumos)
    linha['sessao_valida'] = linha['execucoes'] > 0

    # Localização implícita: só para quem corrigiu sem apontar a linha certa.
    linha['tempo_ate_localizacao_implicita_aprox_ms'] = None
    linha['localizacao_implicita'] = None
    if linha['corrigido'] and linha['tempo_ate_localizacao_ms'] is None:
        inicial = [sem_espacos(l) for l in exercicio['codigo'].split('\n')]
        indices = [n - 1 for n in exercicio['linhas_do_defeito']]
        correcao = linha['tempo_ate_correcao_ms']

        def editou_o_defeito(e: Evento) -> bool:
            return e['tipo'] == 'edicao' and mexeu_no_defeito(e['codigo'], inicial, indices)

        t = primeiro(editou_o_defeito)
        if t is not None and t <= correcao:
            linha['tempo_ate_localizacao_implicita_aprox_ms'] = t
            linha['localizacao_implicita'] = 'aproximada'
        else:
            linha['localizacao_implicita'] = 'sem-edicao-na-linha-do-defeito'
    return linha


def montar(sessoes: list[Sessao], plano: list[dict[str, Any]], catalogo: dict[str, dict[str, Any]],
           participantes_csv: pd.DataFrame) -> pd.DataFrame:
    grupos: dict[tuple[str, int], list[Sessao]] = {}
    for s in sessoes:
        grupos.setdefault((s['participanteId'], s['estudo']['etapa']), []).append(s)

    linhas = []
    for (participante, etapa), pedacos in grupos.items():
        pedacos.sort(key=lambda s: s['instanteDeInicio'])
        grupo = participantes_csv['grupo'].get(participante) if participante in participantes_csv.index else None
        apoios = sorted({s['andaime'] for s in pedacos})
        exercicios = sorted({s['exercicioId'] for s in pedacos})
        versoes = sorted({s['versao'] for s in pedacos})
        linha = {
            'participante_id': participante,
            'grupo': grupo,
            'etapa': etapa,
            'aquecimento': plano[etapa]['aquecimento'],
            'exercicio_id': ';'.join(exercicios),
            'apoio': ';'.join(apoios),
            'versao_do_registro': ';'.join(map(str, versoes)),
            'apoio_confere_com_plano': (
                grupo is not None
                and exercicios == [plano[etapa]['exercicio_id']]
                and apoios == [plano[etapa]['apoio'][grupo]]
            ),
            **consolidar_etapa(pedacos, catalogo[plano[etapa]['exercicio_id']]),
        }
        linhas.append(linha)
    tabela = pd.DataFrame(linhas)
    ordem = participantes_csv['ordem_de_entrada'].to_dict()
    tabela['ordem_de_entrada'] = tabela['participante_id'].map(ordem)
    return tabela.sort_values(['ordem_de_entrada', 'participante_id', 'etapa']).reset_index(drop=True)


def excluir(etapas: pd.DataFrame, participantes_csv: pd.DataFrame,
            anotacoes: dict[str, str]) -> tuple[list[str], pd.DataFrame]:
    """Completo é quem tem desfecho final nas 6 etapas. O resto sai, com o motivo."""
    completos, excluidos = [], []
    for participante, dele in etapas.groupby('participante_id', sort=False):
        motivos = []
        if participante not in participantes_csv.index:
            motivos.append('sem perfil nem grupo no CSV')
        por_etapa = dele.set_index('etapa')
        for etapa in range(6):
            if etapa not in por_etapa.index:
                motivos.append(f'etapa {etapa} não aberta')
            elif pd.isna(por_etapa.loc[etapa, 'desfecho']):
                n = por_etapa.loc[etapa, 'n_pedacos']
                motivos.append(f'etapa {etapa} só com {n} pedaço(s) sem encerramento')
        if motivos:
            nota = next((texto for prefixo, texto in anotacoes.items() if participante.startswith(prefixo)), '')
            excluidos.append({
                'participante_id': participante,
                'grupo': dele['grupo'].iloc[0],
                'etapas_abertas': ','.join(map(str, sorted(dele['etapa']))),
                'pedacos': int(dele['n_pedacos'].sum()),
                'inicio': dele['instante_de_inicio'].min(),
                'motivo': '; '.join(motivos),
                'anotacao': nota,
            })
        else:
            completos.append(participante)
    return completos, pd.DataFrame(excluidos)


# ---------------------------------------------------------------------------
# Conferências
# ---------------------------------------------------------------------------

COMPARADAS_COM_O_CSV = [
    'sessao_id', 'exercicio_id', 'apoio', 'duracao_total_ms', 'duracao_ativa_ms', 'desfecho',
    'tempo_ate_primeira_execucao_ms', 'tempo_ate_localizacao_ms', 'tempo_ate_correcao_ms',
    'execucoes', 'execucoes_com_erro', 'dicas_reveladas', 'edicoes', 'localizacoes_tentadas',
    'corrigido', 'navegacoes', 'passos_distintos_visitados', 'retrocessos',
    'tempo_ate_primeira_navegacao_ms', 'apoio_confere_com_plano',
]


def iguais(a: Any, b: Any) -> bool:
    if pd.isna(a) and pd.isna(b):
        return True
    if pd.isna(a) or pd.isna(b):
        return False
    if isinstance(a, (bool,)) or isinstance(b, (bool,)):
        return bool(a) == bool(b)
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return str(a) == str(b)


def diferencas(nossa: pd.DataFrame, csv: pd.DataFrame, chave: str) -> list[str]:
    """Campo a campo, nas linhas presentes nos dois lados."""
    csv_por = csv.set_index(chave)
    problemas = []
    for _, linha in nossa.iterrows():
        if linha[chave] not in csv_por.index:
            continue
        original = csv_por.loc[linha[chave]]
        for coluna in COMPARADAS_COM_O_CSV:
            if coluna == chave or coluna not in nossa.columns:
                continue
            if not iguais(linha[coluna], original[coluna]):
                problemas.append(f'{str(linha[chave])[:8]} {coluna}: nosso={linha[coluna]!r} csv={original[coluna]!r}')
    return problemas


def conferir(sessoes: list[Sessao], etapas: pd.DataFrame, csv: pd.DataFrame,
             plano: list[dict[str, Any]], limite_ms: int, catalogo: dict[str, dict[str, Any]],
             fontes: dict[str, Any]) -> list[tuple[str, bool, str]]:
    resultado: list[tuple[str, bool, str]] = []

    def anotar(nome: str, ok: bool, detalhe: str) -> None:
        resultado.append((nome, ok, detalhe))

    # 1. Contagem
    por_grupo = etapas.drop_duplicates('participante_id')['grupo'].value_counts().to_dict()
    etapas_por = etapas.groupby('participante_id')['etapa'].apply(lambda e: sorted(e) == list(range(6)))
    anotar(
        '1. 21 participantes, 6 etapas cada, 126 linhas',
        etapas['participante_id'].nunique() == ESPERADO['participantes'] and len(etapas) == 126
        and bool(etapas_por.all()) and por_grupo.get('A') == ESPERADO['A'] and por_grupo.get('B') == ESPERADO['B'],
        f"{etapas['participante_id'].nunique()} participantes, {len(etapas)} linhas, "
        f"todos com as etapas 0–5: {bool(etapas_por.all())}; grupo A = {por_grupo.get('A')}, B = {por_grupo.get('B')}",
    )

    # 2. Apoio contra o plano, em todo pedaço
    erradas = etapas[~etapas['apoio_confere_com_plano']]
    anotar(
        '2. Apoio e exercício de cada linha batem com o plano do grupo (src/estudo/percurso.ts)',
        erradas.empty,
        'todas as 126 linhas batem; dentro de cada etapa, todos os pedaços têm o mesmo exercício e apoio'
        if erradas.empty else '; '.join(f"{r.participante_id[:8]} etapa {r.etapa}" for r in erradas.itertuples()),
    )

    # 3. Prazo
    exercicios = etapas[~etapas['aquecimento']]
    teto = limite_ms + TOLERANCIA_DO_PRAZO_MS
    acima = exercicios[exercicios['duracao_total_ms'] > teto]
    acima_relogio = exercicios[exercicios['duracao_no_relogio_ms'] > teto]
    anotar(
        f'3. Nenhuma etapa 1–5 passa de {limite_ms // 60_000} min (+{TOLERANCIA_DO_PRAZO_MS // 1000} s)',
        acima.empty,
        f"maior soma de pedaços = {exercicios['duracao_total_ms'].max():.0f} ms; "
        f"maior duração no relógio = {exercicios['duracao_no_relogio_ms'].max():.0f} ms "
        f"({len(acima_relogio)} acima do teto no relógio)"
        + ('' if acima.empty else '; acima: ' + ', '.join(f'{r.participante_id[:8]}/{r.etapa}' for r in acima.itertuples())),
    )

    # 4. Sem fragmentos, consolidado = CSV
    inteiras = etapas[etapas['n_pedacos'] == 1].copy()
    inteiras['sessao_id'] = inteiras['sessoes_ids']
    no_csv = inteiras['sessao_id'].isin(csv['sessao_id'])
    problemas = diferencas(inteiras, csv, 'sessao_id')
    anotar(
        '4. Etapas sem fragmentos batem exatamente com o CSV original',
        not problemas,
        f'{int(no_csv.sum())} etapas de um pedaço comparadas campo a campo ({len(COMPARADAS_COM_O_CSV) - 1} campos); '
        f'{int((~no_csv).sum())} não estão no CSV (vieram só do aparelho); '
        + (f'{len(problemas)} diferenças: ' + '; '.join(problemas[:10]) if problemas else 'nenhuma diferença'),
    )

    # 5. O resumo reimplementado reproduz o CSV em todas as sessões do banco
    por_sessao = pd.DataFrame([
        {
            'sessao_id': s['id'], 'exercicio_id': s['exercicioId'], 'apoio': s['andaime'],
            'duracao_total_ms': s['duracaoTotalMs'], 'duracao_ativa_ms': duracao_ativa(s),
            'desfecho': desfecho(s['eventos']), **resumir(s['eventos']),
        }
        for s in sessoes
    ])
    problemas = diferencas(por_sessao, csv, 'sessao_id')
    anotar(
        '5. (extra) O resumo recalculado aqui reproduz o CSV em todas as sessões do banco, com ou sem fragmentos',
        not problemas and int(por_sessao['sessao_id'].isin(csv['sessao_id']).sum()) == len(csv),
        f"{int(por_sessao['sessao_id'].isin(csv['sessao_id']).sum())} de {len(csv)} sessões do CSV conferidas; "
        + (f'{len(problemas)} diferenças: ' + '; '.join(problemas[:10]) if problemas else 'nenhuma diferença'),
    )

    # 6. Código inicial do catálogo = código da execução automática gravada
    divergentes = [
        s['id'][:8] for s in sessoes
        for e in s['eventos']
        if e['tipo'] == 'execucao' and e['origem'] == 'automatica'
        and e['codigo'] != catalogo[s['exercicioId']]['codigo']
    ]
    automaticas = sum(1 for s in sessoes for e in s['eventos'] if e['tipo'] == 'execucao' and e['origem'] == 'automatica')
    anotar(
        '6. (extra) O código inicial lido do catálogo é o mesmo da execução automática de cada sessão',
        not divergentes,
        f'{automaticas} execuções automáticas conferidas; divergentes: {len(divergentes)}',
    )

    # 7. Fontes, versões e ordem dos desfechos
    versoes = sorted({s['versao'] for s in sessoes})
    conflitos = etapas[etapas['corrigido_em_algum_pedaco'] & ~etapas['corrigido'] & etapas['desfecho'].notna()]
    depois_do_fim = etapas[etapas['desfechos_dos_pedacos'].str.contains(
        r'(?:corrigido|desistencia|tempo-esgotado);', regex=True)]
    aparelhos = '; '.join(f"{n}: {i['novas']} novas, {i['ja_no_banco_iguais']} já no banco e idênticas, "
                          f"{i['ja_no_banco_diferentes']} diferentes" for n, i in fontes['aparelhos'].items())
    anotar(
        '7. (extra) Junção sem duplicar, versão única e nenhum pedaço depois do fim',
        versoes == [VERSAO_ESPERADA] and conflitos.empty and depois_do_fim.empty
        and all(i['ja_no_banco_diferentes'] == 0 for i in fontes['aparelhos'].values()),
        f"banco: {fontes['banco']} sessões; {aparelhos}; total {fontes['total']}; versões {versoes}; "
        f"etapas com pedaço depois de um desfecho final: {len(depois_do_fim)}; "
        f"corrigido num pedaço e outro desfecho no fim: {len(conflitos)}",
    )
    return resultado


# ---------------------------------------------------------------------------
# Relatório
# ---------------------------------------------------------------------------

def tabela_md(cabecalho: list[str], linhas: list[list[Any]]) -> str:
    saida = ['| ' + ' | '.join(cabecalho) + ' |', '|' + '---|' * len(cabecalho)]
    saida += ['| ' + ' | '.join(str(c) for c in l) + ' |' for l in linhas]
    return '\n'.join(saida)


def segundos(ms: float | None) -> str:
    return '—' if ms is None or pd.isna(ms) else f'{ms / 1000:.0f}'


O_QUE_O_CODIGO_DIZ = """\
## 1. Os fragmentos: o que o código faz na recarga

Leitura do código congelado da coleta, sem alteração.

**A sessão.** Recarregar a página no meio de um exercício do percurso **abre
uma sessão nova** para a mesma etapa. O percurso fica guardado na aba
(`sessionStorage`, `src/componentes/percurso-guardado.ts`), e a carga volta à
mesma etapa; a tela do exercício é montada com `key={`estudo:${etapa}`}`
(`src/componentes/AreaDoEstudo.tsx`), e `useMetricas` cria a sessão uma vez
por montagem, com id novo (`src/componentes/usar-metricas.ts`). A sessão
anterior é arquivada no `pagehide` como estava — sem o evento
`encerramento`, que só o botão de seguir e o prazo gravam —, e por isso sai
com desfecho `sem-encerramento` (a não ser que já tivesse uma execução que
passou em todos os casos, e então sai `corrigido`). Nada é retomado: o editor
volta ao `codigoComDefeito` (`src/componentes/TelaExercicio.tsx`), as dicas
voltam a ocultas, as marcas de localização somem e a execução automática
roda de novo. O intervalo de 10 s entre tentativas de localização (D25) é
da sessão, e também recomeça.

**O prazo.** É de relógio de parede e **não recomeça**. `abrirEtapa`
(`src/estudo/percurso.ts`) grava `prazos[etapa] = agora + 10 min` na
primeira abertura e nunca o refaz; a recarga lê o prazo guardado, e o
cronômetro da nova tela dispara em `prazo - Date.now()`
(`src/componentes/TelaExercicio.tsx`). Se a recarga acontece depois do
prazo, a etapa vai direto à tela de tempo esgotado, sem abrir sessão. Não é,
portanto, "por etapa somando os pedaços": são 10 minutos corridos desde a
primeira abertura, e o tempo perdido entre um pedaço e outro (a recarga, o
login anônimo, a tela voltando) também é descontado do estudante. A soma dos
pedaços fica sempre abaixo dos 10 minutos.

**O tempo de cada pedaço.** Começa do zero. `criarSessao`
(`src/nucleo/metricas.ts`) toma `performance.now()` na criação como
referência, e todo `t` é relativo a ela; `duracaoTotalMs` é o `t` do último
retrato. A única âncora absoluta é `instanteDeInicio`, em relógio de parede.
"""


def relatorio(etapas: pd.DataFrame, todas: pd.DataFrame, excluidos: pd.DataFrame,
              conferencias: list[tuple[str, bool, str]], sessoes: list[Sessao]) -> str:
    partes = [f'# Consolidação da coleta {APLICACAO}\n',
              'Gerado por `analise/consolidar.py`. Contém dados por participante: fica fora do git.\n',
              O_QUE_O_CODIGO_DIZ]

    # Pedaços por etapa
    partes.append('## 2. Pedaços por etapa (21 participantes incluídos)\n')
    linhas = []
    for etapa, dela in etapas.groupby('etapa'):
        dist = dela['n_pedacos'].value_counts().sort_index()
        linhas.append([
            f'{etapa}' + (' (aquecimento)' if etapa == 0 else ''),
            int(dela['n_pedacos'].sum()),
            int((dela['n_pedacos'] > 1).sum()),
            ', '.join(f'{n} pedaço(s): {q}' for n, q in dist.items()),
        ])
    linhas.append(['**total**', int(etapas['n_pedacos'].sum()), int((etapas['n_pedacos'] > 1).sum()), ''])
    partes.append(tabela_md(['etapa', 'sessões (pedaços)', 'etapas com recarga', 'distribuição'], linhas))
    recarregaram = etapas[etapas['n_pedacos'] > 1]['participante_id'].nunique()
    partes.append(f'\n{recarregaram} dos 21 participantes recarregaram em ao menos uma etapa. '
                  f'Nos 4 excluídos havia mais {int(todas[~todas.participante_id.isin(etapas.participante_id)]["n_pedacos"].sum())} sessões.\n')

    # Cada etapa fragmentada
    partes.append('### Etapas fragmentadas\n')
    por_id = {s['id']: s for s in sessoes}
    linhas = []
    for r in etapas[etapas['n_pedacos'] > 1].itertuples():
        pedacos = [por_id[i] for i in r.sessoes_ids.split(';')]
        linhas.append([
            r.participante_id[:8], r.grupo, r.etapa, r.n_pedacos,
            ' + '.join(segundos(s['duracaoTotalMs']) for s in pedacos),
            segundos(r.duracao_total_ms), segundos(r.lacunas_entre_pedacos_ms),
            r.desfechos_dos_pedacos.replace('sem-encerramento', 's').replace(';', ' → '),
            r.desfecho,
            ' \\| '.join(
                ','.join(f"{e['linha']}{'✓' if e['correta'] else '✗'}" for e in s['eventos'] if e['tipo'] == 'localizacao')
                or '·'
                for s in pedacos
            ),
        ])
    partes.append(tabela_md(['participante', 'grupo', 'etapa', 'pedaços', 'duração de cada (s)',
                             'soma (s)', 'lacunas (s)', 'desfechos dos pedaços', 'desfecho final',
                             'linhas apontadas em cada pedaço'], linhas))
    partes.append('\n"s" = sem-encerramento. Lacunas = relógio de parede entre o fim de um pedaço e o '
                  'início do seguinte, somadas: tempo do prazo que não está em nenhum pedaço. Nas linhas '
                  'apontadas, ✓/✗ é o veredito, os pedaços são separados por barra e "·" é pedaço sem palpite.\n')

    # O que havia nos pedaços sem encerramento
    partes.append('### O que havia nos pedaços sem encerramento\n')
    fragmentos = [por_id[i] for r in etapas.itertuples() for i in r.sessoes_ids.split(';')
                  if desfecho(por_id[i]['eventos']) == 'sem-encerramento']
    curtos = [s for s in fragmentos if s['duracaoTotalMs'] < 30_000]

    def conta(lista: list[Sessao], tipo: str) -> int:
        return sum(1 for s in lista for e in s['eventos'] if e['tipo'] == tipo)

    def com(lista: list[Sessao], tipo: str) -> int:
        return sum(1 for s in lista if any(e['tipo'] == tipo for e in s['eventos']))

    linhas = [
        [nome, len(l), f"{sum(s['duracaoTotalMs'] for s in l) / 1000:.0f}",
         conta(l, 'edicao'), conta([*l], 'execucao') - sum(1 for s in l for e in s['eventos']
                                                            if e['tipo'] == 'execucao' and e['origem'] == 'automatica'),
         conta(l, 'localizacao'), conta(l, 'localizacao-no-intervalo'), com(l, 'localizacao')]
        for nome, l in [('todos', fragmentos), ('com menos de 30 s', curtos)]
    ]
    partes.append(tabela_md(['pedaços sem encerramento', 'n', 'duração somada (s)', 'edições',
                             'execuções do estudante', 'localizações julgadas',
                             'cliques no intervalo', 'pedaços com localização'], linhas))

    # Localizações atravessando a recarga
    atravessadas = []
    for r in etapas[etapas['n_pedacos'] > 1].itertuples():
        julgadas = sorted(
            instante(por_id[i]['instanteDeInicio']) + timedelta(milliseconds=e['t'])
            for i in r.sessoes_ids.split(';') for e in por_id[i]['eventos'] if e['tipo'] == 'localizacao'
        )
        for i, (a, b) in enumerate(zip(julgadas, julgadas[1:])):
            if (b - a) < timedelta(seconds=10):
                atravessadas.append((r.participante_id[:8], r.etapa))
    quem = sorted({p for p, _ in atravessadas})
    partes.append(
        f'\nDuas tentativas de localização julgadas a menos de 10 s uma da outra (no relógio de parede, '
        f'o que só é possível atravessando uma recarga, já que D25 impõe o intervalo dentro da sessão): '
        f'**{len(atravessadas)}** pares, em {len({x for x in atravessadas})} etapas de {len(quem)} participante(s)'
        + (f' ({", ".join(quem)})' if quem else '') + '. É um fato do registro, não um juízo sobre a '
        'intenção: fica anotado para a análise decidir como tratar a localização nessas etapas.\n'
    )

    # Localização implícita
    implicita = etapas[etapas['localizacao_implicita'].notna()]
    partes.append('## 3. Localização implícita (medida secundária, aproximada)\n')
    partes.append(
        f"Etapas corrigidas sem apontar a linha certa: **{len(implicita)}**. Com edição que mexeu no texto da "
        f"linha do defeito antes da correção: {int((implicita['localizacao_implicita'] == 'aproximada').sum())}; "
        f"sem essa edição: {int((implicita['localizacao_implicita'] != 'aproximada').sum())}. "
        'O instante é o da edição registrada, que fecha a rajada de digitação depois de 2 s de silêncio '
        '(ou antes de uma execução): erra para mais em até alguns segundos.\n'
    )

    # Exclusões
    partes.append('## 4. Participantes excluídos\n')
    partes.append(tabela_md(
        ['participante', 'grupo', 'etapas abertas', 'sessões', 'início', 'motivo', 'anotação'],
        [[r.participante_id[:8], r.grupo if isinstance(r.grupo, str) else '—', r.etapas_abertas, r.pedacos,
          r.inicio, r.motivo, r.anotacao or '—'] for r in excluidos.itertuples()],
    ))

    # Conferências
    partes.append('\n## 5. Conferências automáticas\n')
    for nome, ok, detalhe in conferencias:
        partes.append(f"- {'✅' if ok else '❌'} **{nome}** — {detalhe}")
    return '\n'.join(partes) + '\n'


# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--dados', type=Path, default=AQUI / 'dados')
    parser.add_argument('--saida', type=Path, default=AQUI / 'saida')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    args.saida.mkdir(parents=True, exist_ok=True)

    plano, limite_ms = ler_plano()
    catalogo = {e['exercicio_id']: ler_exercicio(e['exercicio_id']) for e in plano}
    sessoes, fontes = juntar_fontes(args.dados)
    csv = ler_csv(args.dados)
    participantes_csv = participantes_do_csv(csv)
    # Anotações por participante, para a tabela de exclusão. Ficam com os
    # dados, e não aqui: o código é público.
    caminho = args.dados / 'anotacoes.json'
    anotacoes = json.loads(caminho.read_text(encoding='utf-8')) if caminho.exists() else {}

    todas = montar(sessoes, plano, catalogo, participantes_csv)
    completos, excluidos = excluir(todas, participantes_csv, anotacoes)
    etapas = todas[todas['participante_id'].isin(completos)].reset_index(drop=True)

    resumo_pedacos = etapas.groupby('participante_id').agg(
        sessoes_no_percurso=('n_pedacos', 'sum'),
        etapas_com_recarga=('n_pedacos', lambda n: int((n > 1).sum())),
    )
    participantes = (participantes_csv.loc[completos].join(resumo_pedacos)
                     .reset_index().sort_values('ordem_de_entrada'))

    conferencias = conferir(sessoes, etapas, csv, plano, limite_ms, catalogo, fontes)

    colunas = ['participante_id', 'grupo', 'ordem_de_entrada', 'etapa', 'aquecimento', 'exercicio_id',
               'apoio', 'apoio_confere_com_plano', 'versao_do_registro', 'n_pedacos', 'sessoes_ids',
               'fontes', 'desfechos_dos_pedacos', 'instante_de_inicio', 'duracao_total_ms',
               'duracao_ativa_ms', 'duracao_no_relogio_ms', 'lacunas_entre_pedacos_ms', 'desfecho',
               'corrigido', 'sessao_valida', 'tempo_ate_primeira_execucao_ms', 'tempo_ate_localizacao_ms',
               'tempo_ate_correcao_ms', 'tempo_ate_localizacao_implicita_aprox_ms', 'localizacao_implicita',
               'execucoes', 'execucoes_com_erro', 'dicas_reveladas', 'dicas_distintas', 'edicoes',
               'localizacoes_tentadas', 'navegacoes', 'passos_distintos_visitados', 'retrocessos',
               'tempo_ate_primeira_navegacao_ms']
    inteiros = [c for c in colunas if c.endswith('_ms')]
    saida_etapas = etapas[colunas].copy()
    saida_etapas[inteiros] = saida_etapas[inteiros].round().astype('Int64')

    saida_etapas.to_csv(args.saida / 'consolidado_etapas.csv', index=False, lineterminator='\n')
    participantes.to_csv(args.saida / 'consolidado_participantes.csv', index=False, lineterminator='\n')
    excluidos.to_csv(args.saida / 'excluidos.csv', index=False, lineterminator='\n')
    texto = relatorio(etapas, todas, excluidos, conferencias, sessoes)
    (args.saida / 'relatorio_consolidacao.md').write_text(texto, encoding='utf-8')

    for nome, ok, detalhe in conferencias:
        print(f"[{'OK' if ok else 'FALHOU'}] {nome}\n       {detalhe}")
    print(f'\nSaídas em {args.saida}')
    return 0 if all(ok for _, ok, _ in conferencias) else 1


if __name__ == '__main__':
    sys.exit(main())
