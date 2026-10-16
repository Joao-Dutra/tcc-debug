-- Área do estudo (D37): aplicações, entrada com grupo balanceado, perfil,
-- consentimento e questionário.
--
-- Roda uma vez, no editor SQL do projeto, depois da 0003. Em seguida, rode
-- `npm run verificar-rls`: as verificações desta migração estão no mesmo
-- script (D24), e nenhuma aplicação recebe participante antes de elas
-- passarem.
--
-- Quem garante o quê, depois desta migração:
--   só entra quem tem identidade, numa aplicação cadastrada e aberta .... função
--   o grupo alterna A, B, A, B na ordem de entrada, sem buraco nem
--     repetição, mesmo com entradas simultâneas ......................... função
--   entrar de novo devolve o mesmo grupo e não consome vaga ............. função
--   ninguém escolhe nem muda o próprio grupo ............................ RLS
--   sessão do estudo só de quem entrou naquela aplicação ................ RLS
--   o participante grava só a própria resposta, uma vez, e não lê
--     nenhuma — nem a própria ............................................ RLS
--   as respostas fechadas são inteiros de 1 a 5 .......................... check
--   só o pesquisador lê aplicações, participantes e respostas ........... RLS
--   conferir uma aplicação não grava nada nem consome vaga .............. função

-- ------------------------------------------------------------ aplicações ---

-- Cadastradas à mão, aqui ou no editor SQL, e não criadas pela URL: um código
-- digitado errado (aeds1-2026 / aeds-2026) partiria a alternância e o dado em
-- dois, sem ninguém perceber até a análise.
create table public.aplicacoes_do_estudo (
  codigo text primary key
    check (codigo ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(codigo) <= 60),
  -- Fechada depois da aula: quem abrir o link depois não entra, e não
  -- desequilibra os grupos de uma aplicação que já terminou.
  aberta boolean not null default true,
  -- Contador da alternância. Só entrar_no_estudo o incrementa.
  entradas integer not null default 0,
  criada_em timestamptz not null default now()
);

insert into public.aplicacoes_do_estudo (codigo) values ('piloto-nov');

-- --------------------------------------------------------- participantes ---

create type public.grupo_do_estudo as enum ('A', 'B');

-- Um participante por identidade e aplicação. A identidade é anônima e nova a
-- cada entrada no estudo (D37): o laboratório tem computadores
-- compartilhados, e reaproveitar a do navegador misturaria pessoas.
create table public.participantes_do_estudo (
  participante_id uuid not null references auth.users (id) on delete cascade,
  aplicacao text not null references public.aplicacoes_do_estudo (codigo) on delete restrict,
  ordem_de_entrada integer not null,
  grupo public.grupo_do_estudo not null,
  -- Qual texto do aviso a pessoa aceitou ao marcar "Concordo em participar".
  -- O texto vive num arquivo versionado do repositório e pode mudar; sem a
  -- versão, não se sabe depois com que termos cada um consentiu.
  versao_do_aviso integer not null check (versao_do_aviso > 0),
  -- O perfil, sem nenhum dado pessoal.
  aeds1 text not null check (aeds1 in ('ja-cursou', 'cursando', 'nao')),
  depurador text not null check (depurador in ('nunca', 'as-vezes', 'frequentemente')),
  usou_visualizacao text not null check (usou_visualizacao in ('sim', 'nao')),
  entrou_em timestamptz not null default now(),
  primary key (participante_id, aplicacao),
  unique (aplicacao, ordem_de_entrada)
);

-- Lida de dentro das políticas de sessoes e respostas. SECURITY DEFINER pelo
-- mesmo motivo de e_pesquisador (0001), e por mais um: o participante não lê
-- esta tabela, e uma função comum, rodando como ele, nunca encontraria a
-- própria linha.
create function public.participa_do_estudo(p_aplicacao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participantes_do_estudo
     where participante_id = (select auth.uid())
       and aplicacao = p_aplicacao
  );
$$;

-- A única porta de entrada no estudo, e a única que escreve o grupo.
--
-- Alternância, e não sorteio: com turmas de vinte ou trinta, um sorteio
-- desequilibra os grupos com frequência, e a alternância na ordem de entrada
-- os mantém com no máximo um de diferença.
--
-- Atômica: o update trava a linha da aplicação até o fim da transação, e
-- entradas simultâneas saem em fila, cada uma com o seu número. Ímpar é A,
-- par é B. Qualquer falha depois do update — um valor de perfil fora da
-- lista — desfaz o incremento junto, e a vaga não se perde.
--
-- Idempotente: quem repete a chamada, porque a resposta se perdeu na rede,
-- recebe o mesmo grupo e não consome outra vaga. O perfil da segunda chamada
-- é ignorado: o que vale é o que entrou com a vaga.
create function public.entrar_no_estudo(
  p_aplicacao text,
  p_versao_do_aviso integer,
  p_aeds1 text,
  p_depurador text,
  p_usou_visualizacao text
)
returns table (grupo public.grupo_do_estudo, ordem_de_entrada integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_ordem integer;
begin
  if v_uid is null then
    raise exception 'entrar no estudo exige identidade';
  end if;

  return query
    select p.grupo, p.ordem_de_entrada
      from public.participantes_do_estudo p
     where p.participante_id = v_uid and p.aplicacao = p_aplicacao;
  if found then
    return;
  end if;

  update public.aplicacoes_do_estudo a
     set entradas = a.entradas + 1
   where a.codigo = p_aplicacao and a.aberta
  returning a.entradas into v_ordem;
  if v_ordem is null then
    raise exception 'aplicação % inexistente ou encerrada', p_aplicacao;
  end if;

  return query
    insert into public.participantes_do_estudo as p
      (participante_id, aplicacao, ordem_de_entrada, grupo, versao_do_aviso,
       aeds1, depurador, usou_visualizacao)
    values
      (v_uid, p_aplicacao, v_ordem,
       (case when v_ordem % 2 = 1 then 'A' else 'B' end)::public.grupo_do_estudo,
       p_versao_do_aviso, p_aeds1, p_depurador, p_usou_visualizacao)
    returning p.grupo, p.ordem_de_entrada;
end;
$$;

-- Para a conferência das máquinas antes da aula (D37): diz se o código existe
-- e está aberto, sem gravar nada e sem consumir vaga. Aberta ao visitante sem
-- identidade, porque a conferência testa a leitura do banco antes de testar a
-- criação da identidade. Revela só o estado do código que a pessoa já tem.
create function public.situacao_da_aplicacao(p_codigo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when a.aberta then 'aberta' else 'encerrada' end
       from public.aplicacoes_do_estudo a
      where a.codigo = p_codigo),
    'inexistente'
  );
$$;

revoke execute on function public.entrar_no_estudo(text, integer, text, text, text) from public, anon;
grant execute on function public.entrar_no_estudo(text, integer, text, text, text) to authenticated;
revoke execute on function public.participa_do_estudo(text) from public, anon;
grant execute on function public.participa_do_estudo(text) to authenticated;
revoke execute on function public.situacao_da_aplicacao(text) from public;
grant execute on function public.situacao_da_aplicacao(text) to anon, authenticated;

-- --------------------------------------------------------------- sessões ---

-- `aplicacao` em coluna, e não só dentro de `estudo`: é por ela que o RLS
-- confere a participação e que o painel filtra. `estudo` guarda o resto da
-- marca da sessão — a etapa e se é o aquecimento —, no formato do núcleo.
-- O grupo não vai na sessão: a fonte dele é participantes_do_estudo, que só o
-- banco escreve.
alter table public.sessoes
  add column aplicacao text references public.aplicacoes_do_estudo (codigo) on delete restrict,
  add column estudo jsonb check (estudo is null or jsonb_typeof(estudo) = 'object');

create index sessoes_por_aplicacao
  on public.sessoes (aplicacao, instante_de_inicio)
  where aplicacao is not null;

-- As mesmas políticas da 0001, com uma condição a mais: sessão marcada com
-- uma aplicação só de quem entrou nela. Sem aplicação, nada muda.
drop policy "gravar sessao propria" on public.sessoes;
create policy "gravar sessao propria"
  on public.sessoes for insert to authenticated
  with check (
    participante_id = (select auth.uid())
    and (aplicacao is null or public.participa_do_estudo(aplicacao))
  );

drop policy "atualizar sessao propria" on public.sessoes;
create policy "atualizar sessao propria"
  on public.sessoes for update to authenticated
  using (participante_id = (select auth.uid()))
  with check (
    participante_id = (select auth.uid())
    and (aplicacao is null or public.participa_do_estudo(aplicacao))
  );

-- ------------------------------------------------------------ questionário ---

create table public.respostas_do_questionario (
  participante_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  aplicacao text not null references public.aplicacoes_do_estudo (codigo) on delete restrict,
  -- Quais itens existem, e com que texto, é a versão que diz: o questionário
  -- vive num arquivo versionado do repositório.
  versao_do_questionario integer not null check (versao_do_questionario > 0),
  -- { "sus-1": 4, ..., "vis-6": 5 }: inteiros de 1 a 5.
  escalas jsonb not null check (
    jsonb_typeof(escalas) = 'object'
    and not jsonb_path_exists(
      escalas,
      '$.* ? (@.type() != "number" || @ < 1 || @ > 5 || @.floor() != @)'
    )
  ),
  o_que_ajudou text check (char_length(o_que_ajudou) <= 2000),
  o_que_atrapalhou text check (char_length(o_que_atrapalhou) <= 2000),
  respondido_em timestamptz not null default now(),
  -- Uma resposta por participante e aplicação. O reenvio de quem perdeu a
  -- resposta na rede vira conflito, e o navegador lê o conflito como "já
  -- gravada" — sem precisar ler nada.
  primary key (participante_id, aplicacao)
);

-- ------------------------------------------------------------------- RLS ---

alter table public.aplicacoes_do_estudo enable row level security;
alter table public.participantes_do_estudo enable row level security;
alter table public.respostas_do_questionario enable row level security;

revoke all on public.aplicacoes_do_estudo from anon, authenticated;
revoke all on public.participantes_do_estudo from anon, authenticated;
revoke all on public.respostas_do_questionario from anon, authenticated;

-- Leitura concedida a todo autenticado, mas a política só deixa passar o
-- pesquisador. Os outros recebem lista vazia.
grant select on public.aplicacoes_do_estudo to authenticated;
grant select on public.participantes_do_estudo to authenticated;
grant select on public.respostas_do_questionario to authenticated;

-- Inserção por coluna: participante_id e respondido_em vêm sempre do banco.
-- Quem tenta escrever um dos dois é recusado antes mesmo da política.
grant insert (aplicacao, versao_do_questionario, escalas, o_que_ajudou, o_que_atrapalhou)
  on public.respostas_do_questionario to authenticated;

create policy "pesquisador ve as aplicacoes"
  on public.aplicacoes_do_estudo for select to authenticated
  using (public.e_pesquisador());

create policy "pesquisador ve os participantes"
  on public.participantes_do_estudo for select to authenticated
  using (public.e_pesquisador());

create policy "pesquisador le as respostas"
  on public.respostas_do_questionario for select to authenticated
  using (public.e_pesquisador());

-- O navegador grava com insert simples, sem pedir a linha de volta: o
-- participante não tem leitura, e um `select` depois do insert seria recusado.
create policy "participante grava a propria resposta"
  on public.respostas_do_questionario for insert to authenticated
  with check (
    participante_id = (select auth.uid())
    and public.participa_do_estudo(aplicacao)
  );

-- Sem insert direto em participantes_do_estudo: o grupo só nasce dentro de
-- entrar_no_estudo. Sem update nem delete em nenhuma das três tabelas:
-- participação e resposta não se desfazem pelo navegador, e abrir ou fechar
-- uma aplicação é feito à mão, no editor SQL, como a concessão de papel.
