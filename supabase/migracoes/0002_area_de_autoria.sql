-- Área de autoria dos professores (D31) e a origem do exercício nas sessões.
--
-- Roda uma vez, no editor SQL do projeto, depois da 0001 — e ANTES de a área
-- de autoria receber o primeiro exercício de verdade. Em seguida, rode
-- `npm run verificar-rls`: as verificações desta tabela estão no mesmo script
-- das sessões (D24), e nenhum exercício real entra antes de elas passarem.
--
-- Três regras, e quem as garante:
--   o professor edita só os próprios rascunhos ......... RLS
--   os alunos leem só os publicados ................... visão sem RLS, filtrada
--   ninguém publica sem ser pesquisador ............... RLS e gatilho, os dois
-- O gatilho existe porque o RLS não compara o antes com o depois: é ele que
-- diz quais transições existem e que publicado não muda.

-- ---------------------------------------------------------------- papéis ---

-- Mesmo desenho de e_pesquisador (0001): security definer para ser consultada
-- de dentro de uma política sem reentrar no RLS de `perfis`. O papel continua
-- concedido à mão, no painel do Supabase: entrar como professor não o concede
-- (D29).
create function public.e_professor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
     where id = (select auth.uid())
       and papel = 'professor'
  );
$$;

-- ------------------------------------------------------------- exercícios ---

create type public.situacao_do_exercicio as enum (
  'rascunho',     -- o professor escreve; só ele vê
  'em_revisao',   -- enviado; o professor não mexe mais, o pesquisador decide
  'publicado',    -- os alunos veem; o conteúdo não muda mais
  'retirado'      -- saiu da vitrine; continua aqui, porque há sessões nele
);

create table public.exercicios_de_professor (
  id uuid primary key default gen_random_uuid(),
  -- `restrict`, e não `cascade`: apagar a conta de um professor não pode levar
  -- junto um exercício publicado, porque há sessões apontando para ele, e sem
  -- o conteúdo a análise não sabe o que o aluno viu.
  autor_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  situacao public.situacao_do_exercicio not null default 'rascunho',
  -- O formato do conteúdo é do núcleo, como os eventos das sessões (D6):
  -- `formato` diz como lê-lo, para ele poder mudar sem quebrar os antigos.
  formato integer not null default 1,
  conteudo jsonb not null,
  -- O relatório da última verificação, para o pesquisador ver o que o
  -- professor viu. A verificação roda de novo na hora de publicar.
  verificacao jsonb,
  comentario_da_revisao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  enviado_em timestamptz,
  publicado_em timestamptz,
  -- `restrict` pelo mesmo motivo do autor, e por mais um: o gatilho abaixo
  -- restaura os carimbos a cada atualização, inclusive na que o próprio banco
  -- faria para anular esta referência — `set null` quebraria ao apagar a conta
  -- de um pesquisador que publicou. Quem publicou é registro, e fica.
  publicado_por uuid references auth.users (id) on delete restrict,
  retirado_em timestamptz
);

create index exercicios_por_autor on public.exercicios_de_professor (autor_id, atualizado_em);
create index exercicios_por_situacao on public.exercicios_de_professor (situacao);

-- O navegador não decide carimbo, autor nem transição. Tudo o que é registro
-- de quem fez o quê é escrito aqui, a partir de quem o banco sabe que é.
create function public.guardar_exercicio_de_professor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Nasce rascunho e do próprio autor, diga o que disser o navegador. A
    -- chave de serviço não tem uid, e aí o autor informado é mantido: é o
    -- caso da verificação do RLS, que cria contas e exercícios de teste.
    new.situacao := 'rascunho';
    if (select auth.uid()) is not null then
      new.autor_id := (select auth.uid());
    end if;
    new.criado_em := now();
    new.atualizado_em := now();
    new.enviado_em := null;
    new.publicado_em := null;
    new.publicado_por := null;
    new.retirado_em := null;
    return new;
  end if;

  if new.autor_id is distinct from old.autor_id then
    raise exception 'o autor de um exercício não muda';
  end if;

  -- Publicado é imutável: o id numa sessão precisa identificar exatamente o
  -- que o aluno viu. Para corrigir, cria-se um rascunho novo a partir dele.
  if old.situacao in ('publicado', 'retirado') and new.conteudo is distinct from old.conteudo then
    raise exception 'exercício publicado não muda: crie um rascunho novo a partir dele';
  end if;

  -- Os carimbos vêm do registro anterior; só a transição escreve um novo.
  new.criado_em := old.criado_em;
  new.enviado_em := old.enviado_em;
  new.publicado_em := old.publicado_em;
  new.publicado_por := old.publicado_por;
  new.retirado_em := old.retirado_em;

  -- O comentário da revisão é do pesquisador; o professor não o reescreve.
  if not public.e_pesquisador() then
    new.comentario_da_revisao := old.comentario_da_revisao;
  end if;

  if new.situacao is distinct from old.situacao then
    if not (
         (old.situacao = 'rascunho'   and new.situacao = 'em_revisao')
      or (old.situacao = 'em_revisao' and new.situacao in ('rascunho', 'publicado'))
      or (old.situacao = 'publicado'  and new.situacao = 'retirado')
    ) then
      raise exception 'transição não permitida: de % para %', old.situacao, new.situacao;
    end if;

    -- Devolver, publicar e retirar são decisões do pesquisador. O RLS já
    -- barra o professor aqui; o gatilho barra de novo, para uma política
    -- escrita errada no futuro não abrir a publicação a ninguém.
    if new.situacao in ('publicado', 'retirado')
       or (old.situacao = 'em_revisao' and new.situacao = 'rascunho') then
      if not public.e_pesquisador() then
        raise exception 'só o pesquisador publica, devolve ou retira um exercício';
      end if;
    end if;

    if new.situacao = 'em_revisao' then
      new.enviado_em := now();
    elsif new.situacao = 'publicado' then
      new.publicado_em := now();
      new.publicado_por := (select auth.uid());
    elsif new.situacao = 'retirado' then
      new.retirado_em := now();
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create trigger guardar_exercicio_de_professor
  before insert or update on public.exercicios_de_professor
  for each row execute function public.guardar_exercicio_de_professor();

-- ------------------------------------------------------------------ RLS ----

alter table public.exercicios_de_professor enable row level security;

-- O visitante sem sessão não tem nada a fazer na tabela. O que é público — os
-- publicados, sem o código correto — sai pela visão, mais abaixo.
revoke all on public.exercicios_de_professor from anon;

create policy "autor ve os proprios exercicios"
  on public.exercicios_de_professor for select to authenticated
  using (autor_id = (select auth.uid()));

create policy "pesquisador ve todos os exercicios"
  on public.exercicios_de_professor for select to authenticated
  using (public.e_pesquisador());

create policy "professor cria o proprio rascunho"
  on public.exercicios_de_professor for insert to authenticated
  with check (
    public.e_professor()
    and autor_id = (select auth.uid())
    and situacao = 'rascunho'
  );

-- O professor mexe só enquanto é rascunho, e o máximo que ele faz com a
-- situação é enviar para revisão. Depois disso, a linha sai do alcance dele.
create policy "professor edita e envia o proprio rascunho"
  on public.exercicios_de_professor for update to authenticated
  using (
    public.e_professor()
    and autor_id = (select auth.uid())
    and situacao = 'rascunho'
  )
  with check (
    autor_id = (select auth.uid())
    and situacao in ('rascunho', 'em_revisao')
  );

create policy "pesquisador revisa, publica, devolve e retira"
  on public.exercicios_de_professor for update to authenticated
  using (public.e_pesquisador())
  with check (public.e_pesquisador());

-- Rascunho não tem sessão nenhuma, e pode sumir. Publicado e retirado não se
-- apagam: não há política de delete para eles, nem para o pesquisador.
create policy "professor apaga o proprio rascunho"
  on public.exercicios_de_professor for delete to authenticated
  using (
    public.e_professor()
    and autor_id = (select auth.uid())
    and situacao = 'rascunho'
  );

-- ---------------------------------------------------------- publicados ---

-- A leitura dos alunos — e de qualquer visitante: o conteúdo publicado é
-- público. É uma visão com os privilégios de quem a criou, e não de quem a
-- consulta, de propósito: ela passa por cima do RLS da tabela para entregar
-- só o que filtra aqui — os publicados, e sem `codigoCorreto`, de que o aluno
-- não precisa e que entregaria a correção a quem abrisse as ferramentas de
-- desenvolvedor. A linha do defeito continua indo junto, porque o veredito
-- da localização é dado no navegador; é a mesma limitação do catálogo (D7).
create view public.exercicios_publicados
  with (security_invoker = false)
as
  select id, formato, conteudo - 'codigoCorreto' as conteudo, publicado_em
    from public.exercicios_de_professor
   where situacao = 'publicado';

grant select on public.exercicios_publicados to anon, authenticated;

-- ---------------------------------------------------------------- sessões ---

-- A análise do estudo separa as sessões em exercícios de professor das do
-- catálogo (D31). Explícito, e não deduzido do formato do id: um campo com
-- nome não se confunde com convenção.
alter table public.sessoes
  add column origem_do_exercicio text not null default 'catalogo'
  check (origem_do_exercicio in ('catalogo', 'professor'));
