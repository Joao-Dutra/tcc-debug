-- Esquema das sessões e dos papéis, com RLS (D21).
--
-- Roda uma vez, no editor SQL do projeto Supabase, ANTES de qualquer dado
-- real. A chave pública fica no pacote entregue ao navegador por desenho, e
-- qualquer pessoa pode extraí-la: o RLS é a única proteção efetiva do dado, e
-- tabela sem política é tabela aberta a qualquer visitante do site.

-- ---------------------------------------------------------------- papéis ---

-- O papel entra agora, antes de haver dado real, porque a área de autoria vem
-- em seguida e migrar papel depois da coleta custa mais caro. 'professor'
-- ainda não concede nada: existe para que a coluna não precise mudar depois.
create type public.papel_de_usuario as enum ('participante', 'professor', 'pesquisador');

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  papel public.papel_de_usuario not null default 'participante',
  criado_em timestamptz not null default now()
);

-- Todo usuário nasce com perfil, inclusive o anônimo: sem isto, o primeiro
-- acesso gravaria sessão sem papel e a análise teria participante sem linha.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- SECURITY DEFINER de propósito: consultada de dentro de uma política sobre
-- `perfis`, uma função comum reentraria na própria política e a consulta
-- entraria em recursão. Definer lê a tabela sem passar pelo RLS de novo.
create function public.e_pesquisador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
     where id = (select auth.uid())
       and papel = 'pesquisador'
  );
$$;

-- --------------------------------------------------------------- sessões ---

-- Espelha RegistroDeSessao do núcleo. O id é o mesmo gerado no navegador, e é
-- chave primária: reenviar a mesma sessão atualiza a linha em vez de duplicá-la
-- — é o que permite reenviar tudo o que está no aparelho sem medo.
create table public.sessoes (
  -- `text`, e não `uuid`: o núcleo tem um gerador reserva para navegador sem
  -- `crypto.randomUUID`, que produz id fora do formato, e as sessões já
  -- guardadas no aparelho desde D15 sobem com o id que têm. Tipo estrito aqui
  -- recusaria justamente os registros que não podem ser perdidos.
  id text primary key,
  participante_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  versao integer not null,
  exercicio_id text not null,
  andaime text,
  instante_de_inicio timestamptz not null,
  duracao_total_ms integer not null,
  -- O log de eventos inteiro (D6), incluindo o código escrito pelo
  -- participante. Guardado como jsonb, e não desmontado em tabelas: o formato
  -- é do núcleo, e `versao` é o que diz como lê-lo.
  eventos jsonb not null,
  resumo jsonb not null,
  recebido_em timestamptz not null default now()
);

create index sessoes_por_participante
  on public.sessoes (participante_id, instante_de_inicio);

-- ------------------------------------------------------------------ RLS ----

alter table public.perfis enable row level security;
alter table public.sessoes enable row level security;

-- Visitante sem sessão de autenticação não tem o que fazer aqui. O anônimo do
-- primeiro acesso NÃO é este papel: ele autentica de verdade e entra como
-- `authenticated`, com uid próprio.
revoke all on public.perfis from anon;
revoke all on public.sessoes from anon;

-- perfis ---------------------------------------------------------------------

create policy "perfil proprio visivel"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()));

create policy "pesquisador ve todos os perfis"
  on public.perfis for select to authenticated
  using (public.e_pesquisador());

-- Sem política de insert, update ou delete em `perfis`, e é deliberado: com
-- update liberado, um participante se promoveria a pesquisador e passaria a
-- ler as sessões da turma inteira. Papel se concede à mão, no painel do
-- Supabase. O insert é do gatilho, que roda como definer e não passa por aqui.

-- sessoes --------------------------------------------------------------------

create policy "sessao propria visivel"
  on public.sessoes for select to authenticated
  using (participante_id = (select auth.uid()));

create policy "pesquisador ve todas as sessoes"
  on public.sessoes for select to authenticated
  using (public.e_pesquisador());

create policy "gravar sessao propria"
  on public.sessoes for insert to authenticated
  with check (participante_id = (select auth.uid()));

-- Reenvio e rearquivamento da mesma sessão (o retrato muda enquanto o
-- estudante trabalha). O `with check` repetido impede passar a sessão para
-- outro dono na atualização.
create policy "atualizar sessao propria"
  on public.sessoes for update to authenticated
  using (participante_id = (select auth.uid()))
  with check (participante_id = (select auth.uid()));

-- Sem política de delete: dado de pesquisa não se apaga pelo navegador. O
-- botão de limpar do painel (D15) continua limpando só o aparelho.
