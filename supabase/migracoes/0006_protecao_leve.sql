-- Proteção leve contra brincadeira no laboratório (D41): limites de sessões,
-- de tamanho e de participantes, e uma isca que marca quem procura o gabarito.
--
-- Roda uma vez, no editor SQL do projeto, depois da 0005. Em seguida, rode
-- `npm run verificar-rls`: as verificações desta migração estão no mesmo
-- script (D24).
--
-- Não é defesa forte, e não pretende ser. A chave pública está no pacote, e
-- quem a extrai fala com a API como o navegador fala. O objetivo é outro: que
-- um aluno mexendo no console não atrapalhe os colegas nem suje os dados do
-- estudo. Nada aqui exclui ninguém da análise; a marca de suspeita só
-- identifica, e a decisão é de quem analisa.
--
-- Quem garante o quê, depois desta migração:
--   no máximo 40 sessões por participante em cada aplicação, e 2000 fora
--     do estudo; o que passa é descartado, e não quebra o lote ......... gatilho
--   nenhuma sessão passa de 2 MiB, nem ao ser regravada ................. gatilho
--   a aplicação não recebe mais participantes que o limite dela ........ gatilho
--   o limite se ajusta só pelo pesquisador, auditado ..................... função
--   quem pede o gabarito ou bate num limite fica marcado, e a marca vai
--     para quem chamou, e não para o dono que a linha declara ........... função
--   o participante não lê nem escreve marca nenhuma ....................... RLS
--
-- A Fase 2 do painel (os papéis, D38) passa a ser a 0007.

-- ------------------------------------------------------------ as marcas ---

-- Uma linha por pessoa e motivo, com a contagem. Quem repete a tentativa mil
-- vezes não cria mil linhas: a tabela não vira, ela mesma, o alvo do flood.
create table public.marcas_de_suspeita (
  participante_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null check (motivo in ('gabarito', 'sessoes-demais', 'sessao-grande')),
  vezes integer not null default 1,
  primeira_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  -- O detalhe da última vez: o exercício pedido, a aplicação, o tamanho.
  detalhe jsonb not null default '{}'::jsonb,
  primary key (participante_id, motivo)
);

alter table public.marcas_de_suspeita enable row level security;

-- O Supabase concede tudo em tabela nova a anon e authenticated: sem a
-- revogação, o participante apagaria a própria marca.
revoke all on public.marcas_de_suspeita from anon, authenticated;
grant select on public.marcas_de_suspeita to authenticated;

create policy "pesquisador le as marcas"
  on public.marcas_de_suspeita for select to authenticated
  using (public.e_pesquisador());

-- Quem escreve é só esta função, chamada de dentro do banco.
create function public.marcar_suspeita(p_quem uuid, p_motivo text, p_detalhe jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.marcas_de_suspeita as m (participante_id, motivo, detalhe)
  values (p_quem, p_motivo, coalesce(p_detalhe, '{}'::jsonb))
  on conflict (participante_id, motivo) do update
     set vezes = m.vezes + 1,
         ultima_em = now(),
         detalhe = excluded.detalhe;
$$;

revoke execute on function public.marcar_suspeita(uuid, text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------- a isca ---

-- Nome tentador, e nada útil dentro. Não lê tabela nenhuma: não há gabarito
-- no banco para ela devolver nem por engano. Marca quem chamou e responde
-- com bom humor — a brincadeira foi vista, e a conversa acaba aí.
--
-- O visitante sem identidade recebe a mesma resposta e não é marcado: não há
-- de quem seja a marca.
create function public.obter_gabarito(p_exercicio text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null then
    perform public.marcar_suspeita(
      v_uid, 'gabarito', jsonb_build_object('exercicio', left(p_exercicio, 100)));
  end if;
  return 'Boa tentativa 😄 O gabarito não mora aqui. Volta pro exercício!';
end;
$$;

revoke execute on function public.obter_gabarito(text) from public;
grant execute on function public.obter_gabarito(text) to anon, authenticated;

-- -------------------------------------------------- limites das sessões ---

-- Por que descartar, e não recusar com erro: o navegador sobe as pendentes
-- num lote só, por upsert. Uma exceção numa linha derrubaria o lote inteiro,
-- e de novo a cada tentativa; no fim do percurso, a troca de identidade
-- espera a fila esvaziar (D37), e o participante ficaria preso em "chame o
-- pesquisador" com as sessões legítimas dele junto. Devolver `null` num
-- gatilho BEFORE descarta só aquela linha, sem erro: as outras do lote
-- gravam, e o navegador para de insistir. O descarte não é silencioso para
-- quem analisa: fica a marca.
--
-- Os limites ficam longe do uso real. O percurso tem seis etapas, e cada
-- recarga abre outra sessão (D37): 40 é mais de seis recargas por etapa. Uma
-- sessão de oito minutos digitando sem parar dá umas 240 edições com o código
-- inteiro (uma por rajada de 2 s), perto de 300 KB; 2 MiB é seis vezes isso.
-- Fora do estudo, 2000 sessões é um semestre de uso diário.
--
-- O tamanho é o da linha inteira, e não só de `eventos`: o resumo, o id e o
-- exercício também vêm do navegador, e o limite só nos eventos mudaria o
-- flood de coluna.
--
-- A chave secreta e as funções do banco não têm `auth.uid()`, e passam sem
-- limite: a limpeza e a verificação não podem esbarrar nele.
create function public.limitar_sessoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limite_no_estudo constant integer := 40;
  c_limite_fora constant integer := 2000;
  c_tamanho_maximo constant integer := 2 * 1024 * 1024;
  v_uid uuid := (select auth.uid());
  v_tamanho integer;
  v_sessoes integer;
  v_limite integer;
begin
  -- Linha em nome de outra pessoa: quem decide é o RLS, que a recusa com
  -- erro. Marcar aqui seria marcar o dono que a linha declara, e um aluno
  -- poderia incriminar outro.
  if v_uid is null or new.participante_id is distinct from v_uid then
    return new;
  end if;

  v_tamanho := octet_length(to_jsonb(new)::text);
  if v_tamanho > c_tamanho_maximo then
    perform public.marcar_suspeita(v_uid, 'sessao-grande',
      jsonb_build_object('bytes', v_tamanho, 'aplicacao', new.aplicacao));
    return null;
  end if;

  -- A contagem só vale para sessão nova. Regravar a mesma sessão — o
  -- navegador reenvia o retrato a cada mudança, e reenvia tudo a cada carga
  -- da página — chega aqui como insert, por causa do upsert, e precisa
  -- passar mesmo com o participante no limite.
  if tg_op = 'INSERT' and exists (select 1 from public.sessoes s where s.id = new.id) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.aplicacao is not distinct from old.aplicacao then
    return new;
  end if;

  -- Em fila por pessoa e aplicação: dois lotes simultâneos contariam o mesmo
  -- número e passariam os dois.
  perform pg_advisory_xact_lock(
    hashtext('sessoes:' || v_uid::text || ':' || coalesce(new.aplicacao, '')));

  select count(*) into v_sessoes
    from public.sessoes s
   where s.participante_id = v_uid
     and s.aplicacao is not distinct from new.aplicacao;

  -- Numa variável, e não no `if`: o plpgsql corta a condição do `if` no
  -- primeiro `then`, e um `case when ... then` ali dentro não compila.
  v_limite := case when new.aplicacao is null then c_limite_fora else c_limite_no_estudo end;
  if v_sessoes >= v_limite then
    perform public.marcar_suspeita(v_uid, 'sessoes-demais',
      jsonb_build_object('aplicacao', new.aplicacao, 'sessoes', v_sessoes));
    return null;
  end if;
  return new;
end;
$$;

create trigger limitar_sessoes
  before insert or update on public.sessoes
  for each row execute function public.limitar_sessoes();

revoke execute on function public.limitar_sessoes() from public, anon, authenticated;

-- ---------------------------------------------- limite de participantes ---

-- Ajustável pelo painel. 60 cabe com folga numa turma, e o pesquisador sobe
-- antes da aula se precisar. Vale para as aplicações que já existem.
alter table public.aplicacoes_do_estudo
  add column limite_de_participantes integer not null default 60
    check (limite_de_participantes between 1 and 1000);

-- A ordem de entrada já é o número da vaga: `entrar_no_estudo` incrementa o
-- contador com a linha da aplicação travada, e a ordem sai sem buraco nem
-- repetição (0004). Passou do limite, a exceção desfaz a entrada inteira,
-- incremento junto, e a vaga não se perde — o mesmo caminho do perfil fora da
-- lista.
--
-- Aqui é exceção, e não descarte: a entrada é uma chamada só, e a tela
-- precisa saber que não entrou. O participante vê o erro de entrada que já
-- existe, que pede para chamar o pesquisador.
--
-- Ninguém é marcado: bater no limite de participantes é sala cheia, e não
-- brincadeira.
create function public.limitar_participantes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite integer;
begin
  select a.limite_de_participantes into v_limite
    from public.aplicacoes_do_estudo a
   where a.codigo = new.aplicacao;
  if new.ordem_de_entrada > v_limite then
    raise exception 'a aplicação % atingiu o limite de % participantes', new.aplicacao, v_limite
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger limitar_participantes
  before insert on public.participantes_do_estudo
  for each row execute function public.limitar_participantes();

revoke execute on function public.limitar_participantes() from public, anon, authenticated;

-- No molde das funções do painel (0005): confere o papel por dentro, e
-- recusa e falha vão para a auditoria e voltam como `ok: false`.
--
-- Abaixo das entradas já feitas é recusado: o limite não tira ninguém de
-- dentro, e um número menor que o de quem já entrou só confundiria a leitura
-- do painel. Para não receber mais ninguém, fecha-se a aplicação.
create function public.definir_limite_de_participantes(p_codigo text, p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'definir-limite-de-participantes';
  v_parametros jsonb := jsonb_build_object('limite', p_limite);
  v_entradas integer;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 1000 then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'limite-invalido'));
  end if;

  -- Trava a linha, como a entrada: uma entrada simultânea espera.
  select a.entradas into v_entradas
    from public.aplicacoes_do_estudo a
   where a.codigo = p_codigo
     for update;
  if v_entradas is null then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'aplicacao-inexistente'));
  end if;
  if p_limite < v_entradas then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'abaixo-das-entradas', 'entradas', v_entradas));
  end if;

  begin
    update public.aplicacoes_do_estudo a
       set limite_de_participantes = p_limite
     where a.codigo = p_codigo;
  exception when others then
    return public.auditar(v_acao, p_codigo, v_parametros, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  return public.auditar(v_acao, p_codigo, v_parametros, 'ok',
    jsonb_build_object('limite', p_limite));
end;
$$;

revoke execute on function public.definir_limite_de_participantes(text, integer) from public, anon;
grant execute on function public.definir_limite_de_participantes(text, integer) to authenticated;

-- A lista do painel ganha o limite. O tipo de retorno muda, e o Postgres não
-- troca tipo de retorno com `create or replace`: sai e volta, com o mesmo
-- corpo da 0005 e uma coluna a mais.
drop function public.listar_aplicacoes();

create function public.listar_aplicacoes()
returns table (
  codigo text,
  aberta boolean,
  protegida boolean,
  entradas integer,
  limite_de_participantes integer,
  criada_em timestamptz,
  participantes_a bigint,
  participantes_b bigint,
  sessoes bigint,
  respostas bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.e_pesquisador() then
    raise exception 'só o pesquisador lista as aplicações' using errcode = '42501';
  end if;
  return query
    select a.codigo, a.aberta, a.protegida, a.entradas, a.limite_de_participantes, a.criada_em,
           (select count(*) from public.participantes_do_estudo p
             where p.aplicacao = a.codigo and p.grupo = 'A'),
           (select count(*) from public.participantes_do_estudo p
             where p.aplicacao = a.codigo and p.grupo = 'B'),
           (select count(*) from public.sessoes s where s.aplicacao = a.codigo),
           (select count(*) from public.respostas_do_questionario r where r.aplicacao = a.codigo)
      from public.aplicacoes_do_estudo a
     order by a.criada_em desc, a.codigo;
end;
$$;

revoke execute on function public.listar_aplicacoes() from public, anon;
grant execute on function public.listar_aplicacoes() to authenticated;
