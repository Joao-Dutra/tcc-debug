-- Publicação pelo próprio professor e interruptor da coleta (D33).
--
-- Roda uma vez, no editor SQL do projeto, depois da 0002. Em seguida, rode
-- `npm run verificar-rls`: as verificações desta migração estão no mesmo
-- script (D24), e nada de professor é publicado antes de elas passarem.
--
-- A revisão do pesquisador deixa de ser etapa: o autor verifica, vê como o
-- aluno veria e publica. Quem garante o quê, depois desta migração:
--   o professor edita e publica só o próprio exercício ......... RLS e gatilho
--   só publica o que traz o relatório aprovado ................. gatilho
--   o autor retira o próprio; o pesquisador retira qualquer um .. RLS e gatilho
--   o pesquisador não publica nem edita o de ninguém ............ RLS e gatilho
--   publicado não muda; retirado não volta ...................... gatilho
--   só o pesquisador mexe no interruptor ........................ RLS
--   com o interruptor ligado, nenhum proposto chega ao aluno ..... a visão
--
-- O controle humano que sobra no caminho de um exercício é a concessão do
-- papel de professor, à mão (D29). A retirada pelo pesquisador não é etapa: é
-- freio de emergência, para tirar do ar um exercício com erro ou conteúdo
-- inadequado sem depender do autor nem do painel do Supabase.

-- --------------------------------------------- o que estava em revisão ---

-- A revisão deixa de existir. O que esperava nela volta a ser rascunho do
-- autor, que o verifica e publica ele mesmo. O gatilho da 0002 recusaria a
-- volta — era decisão do pesquisador —, então fica desligado só durante esta
-- atualização. O valor 'em_revisao' continua no tipo: tirar valor de um enum
-- exige recriar o tipo, e nenhuma transição leva mais a ele.
alter table public.exercicios_de_professor disable trigger guardar_exercicio_de_professor;
update public.exercicios_de_professor
   set situacao = 'rascunho', enviado_em = null, atualizado_em = now()
 where situacao = 'em_revisao';
alter table public.exercicios_de_professor enable trigger guardar_exercicio_de_professor;

-- Quem retirou: o autor, ou o pesquisador puxando o freio. `restrict` pelo
-- mesmo motivo de `publicado_por` (0002): é registro, e fica.
alter table public.exercicios_de_professor
  add column retirado_por uuid references auth.users (id) on delete restrict;

-- ------------------------------------------------------------ gatilho ---

create or replace function public.guardar_exercicio_de_professor()
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
    new.retirado_por := null;
    return new;
  end if;

  if new.autor_id is distinct from old.autor_id then
    raise exception 'o autor de um exercício não muda';
  end if;

  -- Publicado é imutável: o id numa sessão precisa identificar exatamente o
  -- que o aluno viu. Agora também o formato e o relatório com que ele foi
  -- publicado. Para corrigir, cria-se um rascunho novo a partir dele.
  if old.situacao in ('publicado', 'retirado')
     and (new.conteudo, new.formato, new.verificacao)
         is distinct from (old.conteudo, old.formato, old.verificacao) then
    raise exception 'exercício publicado não muda: crie um rascunho novo a partir dele';
  end if;

  -- Os carimbos vêm do registro anterior; só a transição escreve um novo.
  new.criado_em := old.criado_em;
  new.enviado_em := old.enviado_em;
  new.publicado_em := old.publicado_em;
  new.publicado_por := old.publicado_por;
  new.retirado_em := old.retirado_em;
  new.retirado_por := old.retirado_por;
  -- Ninguém mais escreve comentário de revisão; o que existe fica como registro.
  new.comentario_da_revisao := old.comentario_da_revisao;

  if new.situacao is distinct from old.situacao then
    if not (
         (old.situacao = 'rascunho'  and new.situacao = 'publicado')
      or (old.situacao = 'publicado' and new.situacao = 'retirado')
    ) then
      raise exception 'transição não permitida: de % para %', old.situacao, new.situacao;
    end if;

    -- O RLS já barra quem não pode; o gatilho barra de novo, para uma
    -- política escrita errada no futuro não abrir a porta a ninguém.
    if new.situacao = 'publicado' then
      if (select auth.uid()) is distinct from old.autor_id or not public.e_professor() then
        raise exception 'só o autor, com o papel de professor, publica o próprio exercício';
      end if;
      -- Guarda contra defeito da interface, e não contra quem forja: o
      -- relatório vem do navegador. A decisão de publicar, na tela, é da
      -- verificação refeita na hora, e nunca do relatório gravado.
      if coalesce((new.verificacao ->> 'aprovado')::boolean, false) is not true then
        raise exception 'publicar exige a verificação aprovada';
      end if;
      new.publicado_em := now();
      new.publicado_por := (select auth.uid());
    else
      if (select auth.uid()) is distinct from old.autor_id and not public.e_pesquisador() then
        raise exception 'só o autor ou o pesquisador retira um exercício';
      end if;
      new.retirado_em := now();
      new.retirado_por := (select auth.uid());
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- RLS ---

drop policy "professor edita e envia o proprio rascunho" on public.exercicios_de_professor;
drop policy "pesquisador revisa, publica, devolve e retira" on public.exercicios_de_professor;

-- O professor mexe enquanto é rascunho, e o máximo que faz com a situação é
-- publicar. Depois disso, o que resta a ele é retirar.
create policy "professor edita e publica o proprio rascunho"
  on public.exercicios_de_professor for update to authenticated
  using (
    public.e_professor()
    and autor_id = (select auth.uid())
    and situacao = 'rascunho'
  )
  with check (
    autor_id = (select auth.uid())
    and situacao in ('rascunho', 'publicado')
  );

-- Sem exigir o papel: quem o perdeu ainda consegue tirar o próprio exercício
-- da vitrine, o que só reduz exposição.
create policy "autor retira o proprio publicado"
  on public.exercicios_de_professor for update to authenticated
  using (autor_id = (select auth.uid()) and situacao = 'publicado')
  with check (autor_id = (select auth.uid()) and situacao = 'retirado');

-- O freio de emergência: qualquer publicado, e só para retirado. O pesquisador
-- continua sem publicar e sem editar exercício de ninguém.
create policy "pesquisador retira qualquer publicado"
  on public.exercicios_de_professor for update to authenticated
  using (public.e_pesquisador() and situacao = 'publicado')
  with check (public.e_pesquisador() and situacao = 'retirado');

-- Políticas permissivas se somam — os USING entre si, os WITH CHECK entre si
-- —, e combinações cruzadas como rascunho → retirado passam pelo RLS. É o
-- gatilho que as recusa, e é por isso que ele repete as regras. Continuam da
-- 0002: o autor e o pesquisador leem, o professor cria e apaga o rascunho.

-- ------------------------------------------------ interruptor da coleta ---

-- Com qualquer professor publicando, o que a vitrine mostra deixa de estar na
-- mão do pesquisador. Durante a coleta, os participantes precisam ver sempre a
-- mesma vitrine (roadmap, congelamento): o interruptor oculta a seção dos
-- propostos inteira, pelo banco.
create table public.coleta (
  -- Uma linha só: a chave só aceita verdadeiro.
  unica boolean primary key default true check (unica),
  -- Nasce oculto: a coleta vem aí, e é o lado seguro.
  propostos_ocultos boolean not null default true,
  alterado_em timestamptz not null default now(),
  alterado_por uuid references auth.users (id) on delete set null
);

insert into public.coleta default values;

create function public.carimbar_coleta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.unica := true;
  new.alterado_em := now();
  new.alterado_por := (select auth.uid());
  return new;
end;
$$;

create trigger carimbar_coleta
  before update on public.coleta
  for each row execute function public.carimbar_coleta();

alter table public.coleta enable row level security;

-- Ler o estado não revela nada, e a área do professor precisa dele para avisar
-- que a seção está oculta. Mudar, só a coluna do interruptor, e só pesquisador.
revoke all on public.coleta from anon, authenticated;
grant select on public.coleta to anon, authenticated;
grant update (propostos_ocultos) on public.coleta to authenticated;

create policy "todos leem o estado da coleta"
  on public.coleta for select to anon, authenticated
  using (true);

create policy "so o pesquisador mexe no interruptor"
  on public.coleta for update to authenticated
  using (public.e_pesquisador())
  with check (public.e_pesquisador());

-- Sem política de insert nem de delete: a linha é esta, e ninguém a cria nem a
-- apaga pelo navegador.

-- ---------------------------------------------------------- publicados ---

-- O interruptor vale aqui, no banco, e não na tela: ligado, a visão não
-- devolve nada, nem a quem abre o link direto de um proposto. Sem a linha da
-- coleta, o subselect dá nulo e a visão também não devolve nada — o lado
-- seguro. A pré-visualização do autor lê a própria linha na tabela, e não a
-- visão: ele vê o exercício como o aluno veria mesmo com a seção oculta.
create or replace view public.exercicios_publicados
  with (security_invoker = false)
as
  select e.id, e.formato, e.conteudo - 'codigoCorreto' as conteudo, e.publicado_em
    from public.exercicios_de_professor e
   where e.situacao = 'publicado'
     and not (select c.propostos_ocultos from public.coleta c);
