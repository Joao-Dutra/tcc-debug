-- Painel de controle do pesquisador, Fase 1 (D38): aplicações protegidas,
-- limpeza de aplicação de teste, auditoria, e o interruptor da coleta e o
-- freio de emergência como funções.
--
-- Roda uma vez, no editor SQL do projeto, depois da 0004. Em seguida, rode
-- `npm run verificar-rls`: as verificações desta migração estão no mesmo
-- script (D24), e o painel não é usado antes de elas passarem.
--
-- Até aqui, criar, abrir e fechar uma aplicação eram SQL à mão. O painel
-- troca isso por funções, e cada uma confere o papel por dentro: a tela
-- esconder o botão não protege nada, porque a chave pública está no pacote e
-- qualquer um chama a API sem tela nenhuma.
--
-- Quem garante o quê, depois desta migração:
--   toda ação do painel confere o papel de pesquisador por dentro ..... função
--   toda ação que altera, e toda recusa e falha dela, fica registrada .. função
--   a auditoria não se altera nem se apaga, nem pela chave secreta ..... gatilho
--   o dado de aplicação protegida não se apaga, por caminho nenhum ..... gatilho
--   proteger não se desfaz, nem pela chave secreta ..................... gatilho
--   limpar exige o código digitado e a aplicação fechada ............... função
--   limpar não apaga usuário nem perfil ................................ função
--   o interruptor e o freio só pela função, e não pela tabela .......... grant e RLS

-- ------------------------------------------------------------ auditoria ---

create table public.auditoria_do_pesquisador (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  -- Sem chave estrangeira, de propósito: o registro precisa sobreviver à conta
  -- que agiu. Com `cascade`, apagar a conta apagaria o rastro do que ela fez.
  quem uuid,
  acao text not null,
  -- O código da aplicação, o id do exercício: texto, porque o alvo muda de
  -- tipo de uma ação para outra.
  alvo text,
  parametros jsonb not null default '{}'::jsonb,
  resultado text not null check (resultado in ('ok', 'recusada', 'falhou')),
  -- O motivo da recusa, o erro da falha, as contagens da limpeza.
  detalhe jsonb not null default '{}'::jsonb
);

create index auditoria_por_instante on public.auditoria_do_pesquisador (em desc);

-- Só cresce. Uma auditoria que quem age pode editar não audita nada: o
-- gatilho vale também para a chave secreta, que passa por cima do RLS.
create function public.auditoria_so_cresce()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'a auditoria do pesquisador não se altera nem se apaga';
end;
$$;

create trigger auditoria_so_cresce
  before update or delete on public.auditoria_do_pesquisador
  for each row execute function public.auditoria_so_cresce();

create trigger auditoria_nao_se_esvazia
  before truncate on public.auditoria_do_pesquisador
  for each statement execute function public.auditoria_so_cresce();

alter table public.auditoria_do_pesquisador enable row level security;

revoke all on public.auditoria_do_pesquisador from anon, authenticated;
grant select on public.auditoria_do_pesquisador to authenticated;

create policy "pesquisador le a auditoria"
  on public.auditoria_do_pesquisador for select to authenticated
  using (public.e_pesquisador());

-- Sem insert pelo navegador: quem escreve é `auditar`, chamada só de dentro
-- das funções abaixo.

-- Grava a linha e devolve o que a função do painel responde ao navegador:
-- `ok`, e o detalhe junto — o motivo da recusa, as contagens.
--
-- A recusa é linha gravada e resposta, e não exceção: uma exceção desfaria a
-- transação inteira, e o insert da auditoria com ela. Quem tentou e foi
-- recusado não deixaria rastro.
create function public.auditar(
  p_acao text,
  p_alvo text,
  p_parametros jsonb,
  p_resultado text,
  p_detalhe jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auditoria_do_pesquisador (quem, acao, alvo, parametros, resultado, detalhe)
  values (
    (select auth.uid()), p_acao, p_alvo,
    coalesce(p_parametros, '{}'::jsonb), p_resultado, coalesce(p_detalhe, '{}'::jsonb)
  );
  return jsonb_build_object('ok', p_resultado = 'ok') || coalesce(p_detalhe, '{}'::jsonb);
end;
$$;

-- Ninguém de fora chama: com ela aberta, qualquer conta forjaria auditoria.
-- O Supabase concede execução a anon e authenticated em toda função nova, e
-- por isso a revogação nomeia os dois.
revoke execute on function public.auditar(text, text, jsonb, text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------ aplicação protegida ---

-- Nasce protegida: a aplicação da coleta real é a que não pode ser esquecida
-- desprotegida, e a de teste se declara como tal ao ser criada. O lado
-- seguro é o padrão, como no interruptor (0003).
alter table public.aplicacoes_do_estudo
  add column protegida boolean not null default true;

-- As que já existem: o piloto continua de teste até acontecer — o
-- pesquisador o protege pelo painel depois —, e as sobras de uma verificação
-- derrubada no meio (D24) precisam poder sair. Isto roda uma vez, aqui, antes
-- do gatilho abaixo existir: depois dele, nada desprotege.
update public.aplicacoes_do_estudo
   set protegida = false
 where codigo = 'piloto-nov' or codigo like 'verificacao-rls-%';

-- Proteger não se desfaz. Sem função de desproteger e com este gatilho, nem
-- uma sessão de pesquisador comprometida nem a chave secreta tiram a proteção
-- de uma coleta para depois limpá-la. Um engano se desfaz só desligando o
-- gatilho no editor SQL, que é ato deliberado de quem é dono do banco.
create function public.guardar_protecao_da_aplicacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.protegida and not new.protegida then
    raise exception 'a aplicação % é protegida, e a proteção não se desfaz', old.codigo;
  end if;
  return new;
end;
$$;

create trigger guardar_protecao_da_aplicacao
  before update of protegida on public.aplicacoes_do_estudo
  for each row execute function public.guardar_protecao_da_aplicacao();

-- O dado de uma aplicação protegida não se apaga nem muda de aplicação, venha
-- de onde vier: uma função com defeito, a chave secreta, a cascata de um
-- usuário anônimo apagado no painel do Supabase. A limpeza já recusa a
-- protegida por conta própria; isto é a segunda tranca, para a primeira não
-- ser a única.
--
-- Mudar de aplicação também é barrado: levar a sessão para fora da protegida
-- e apagá-la depois seria o mesmo apagar, em dois passos.
--
-- A linha da aplicação protegida vazia continua podendo sair: sem dado, não
-- há o que proteger, e a verificação do RLS precisa remover a dela.
create function public.guardar_dado_de_aplicacao_protegida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.aplicacao is not null
     and (tg_op = 'DELETE' or new.aplicacao is distinct from old.aplicacao)
     and exists (
       select 1 from public.aplicacoes_do_estudo a
        where a.codigo = old.aplicacao and a.protegida
     ) then
    raise exception 'a aplicação % é protegida: o dado dela não se apaga nem muda de aplicação',
      old.aplicacao;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger guardar_dado_de_aplicacao_protegida
  before delete or update of aplicacao on public.sessoes
  for each row execute function public.guardar_dado_de_aplicacao_protegida();

create trigger guardar_dado_de_aplicacao_protegida
  before delete or update of aplicacao on public.participantes_do_estudo
  for each row execute function public.guardar_dado_de_aplicacao_protegida();

create trigger guardar_dado_de_aplicacao_protegida
  before delete or update of aplicacao on public.respostas_do_questionario
  for each row execute function public.guardar_dado_de_aplicacao_protegida();

-- --------------------------------------------------- funções do painel ---

-- Todas são SECURITY DEFINER: escrevem em tabelas em que o navegador não tem
-- escrita nenhuma (0004) e gravam a auditoria, que também não tem. A primeira
-- coisa que cada uma faz é conferir o papel; recusa e falha vão para a
-- auditoria e voltam como `ok: false`, com o motivo.
--
-- A falha no meio do trabalho é pega por um bloco com `exception`, que no
-- plpgsql é uma subtransação: ela desfaz só o trabalho, e o tratador ainda
-- grava a falha. Sem isso, a falha abortaria a transação e levaria a linha de
-- auditoria junto.

-- A lista do painel, com as contagens. Leitura não muda nada e não vai para a
-- auditoria. SECURITY INVOKER: quem lê é o próprio pesquisador, pelas
-- políticas de leitura da 0004, e uma leitura não precisa de mais poder que
-- isso. A conferência do papel por dentro dá a recusa explícita, e não uma
-- lista vazia que pareceria banco sem aplicação.
create function public.listar_aplicacoes()
returns table (
  codigo text,
  aberta boolean,
  protegida boolean,
  entradas integer,
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
    select a.codigo, a.aberta, a.protegida, a.entradas, a.criada_em,
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

-- Cria uma aplicação. O código segue a regra do `check` da 0004, conferida
-- aqui antes para a recusa vir com motivo, e não como erro de restrição.
-- Protegida, a menos que o pesquisador diga que é de teste.
create function public.criar_aplicacao(p_codigo text, p_teste boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'criar-aplicacao';
  v_parametros jsonb := jsonb_build_object('teste', coalesce(p_teste, false));
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;
  if p_codigo is null
     or p_codigo !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(p_codigo) > 60 then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'codigo-invalido'));
  end if;
  if exists (select 1 from public.aplicacoes_do_estudo a where a.codigo = p_codigo) then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'codigo-existente'));
  end if;

  begin
    insert into public.aplicacoes_do_estudo (codigo, protegida)
    values (p_codigo, not coalesce(p_teste, false));
  exception
    -- Duas criações do mesmo código ao mesmo tempo: a segunda chega aqui.
    when unique_violation then
      return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
        jsonb_build_object('motivo', 'codigo-existente'));
    when others then
      return public.auditar(v_acao, p_codigo, v_parametros, 'falhou',
        jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  return public.auditar(v_acao, p_codigo, v_parametros, 'ok',
    jsonb_build_object('protegida', not coalesce(p_teste, false)));
end;
$$;

-- Abre ou fecha. Vale também para a protegida: fechar depois da aula é o uso
-- normal dela, e não perde dado nenhum.
create function public.definir_aplicacao_aberta(p_codigo text, p_aberta boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'definir-aplicacao-aberta';
  v_parametros jsonb := jsonb_build_object('aberta', p_aberta);
  v_achou boolean;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;
  if p_aberta is null then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'parametro-invalido'));
  end if;

  begin
    update public.aplicacoes_do_estudo a set aberta = p_aberta where a.codigo = p_codigo;
    v_achou := found;
  exception when others then
    return public.auditar(v_acao, p_codigo, v_parametros, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  if not v_achou then
    return public.auditar(v_acao, p_codigo, v_parametros, 'recusada',
      jsonb_build_object('motivo', 'aplicacao-inexistente'));
  end if;
  return public.auditar(v_acao, p_codigo, v_parametros, 'ok',
    jsonb_build_object('aberta', p_aberta));
end;
$$;

-- Protege, num sentido só: não existe função de desproteger, e o gatilho
-- acima recusa a volta por qualquer caminho.
create function public.proteger_aplicacao(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'proteger-aplicacao';
  v_protegida boolean;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;

  select a.protegida into v_protegida
    from public.aplicacoes_do_estudo a
   where a.codigo = p_codigo
     for update;
  if v_protegida is null then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'aplicacao-inexistente'));
  end if;
  if v_protegida then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'ok',
      jsonb_build_object('ja_estava', true));
  end if;

  begin
    update public.aplicacoes_do_estudo a set protegida = true where a.codigo = p_codigo;
  exception when others then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'ok',
    jsonb_build_object('ja_estava', false));
end;
$$;

-- Limpa uma aplicação de teste: as respostas, as sessões e os participantes
-- dela, e o contador da alternância volta a zero — tudo ou nada.
--
-- O que não toca: `auth.users`, `perfis` e a linha da aplicação. As
-- identidades anônimas do teste ficam sem dado, o que é inofensivo; apagá-las
-- levaria por cascata as sessões delas fora do estudo, que não são desta
-- aplicação.
--
-- O código digitado vem como parâmetro e é conferido aqui, e não só na tela:
-- um clique por engano numa chamada montada à mão não pode limpar nada.
--
-- Fechada, e não aberta: com ela aberta, alguém entrando durante a limpeza
-- ganharia uma vaga que some em seguida, e o contador voltaria a zero com
-- ele dentro.
create function public.limpar_aplicacao(p_codigo text, p_confirmacao text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'limpar-aplicacao';
  v_aplicacao record;
  v_respostas integer;
  v_sessoes integer;
  v_participantes integer;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;
  if p_confirmacao is distinct from p_codigo then
    return public.auditar(v_acao, p_codigo, jsonb_build_object('confirmacao', p_confirmacao),
      'recusada', jsonb_build_object('motivo', 'confirmacao-nao-confere'));
  end if;

  -- Trava a linha: `entrar_no_estudo` trava a mesma (0004), e uma entrada
  -- simultânea espera a limpeza terminar.
  select a.codigo, a.aberta, a.protegida, a.entradas into v_aplicacao
    from public.aplicacoes_do_estudo a
   where a.codigo = p_codigo
     for update;
  if not found then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'aplicacao-inexistente'));
  end if;
  if v_aplicacao.protegida then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'aplicacao-protegida'));
  end if;
  if v_aplicacao.aberta then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'aplicacao-aberta'));
  end if;

  begin
    -- Das folhas para o meio. As três apontam para a aplicação com
    -- `restrict`, e entre si não se referenciam: a ordem é só a da leitura.
    delete from public.respostas_do_questionario r where r.aplicacao = p_codigo;
    get diagnostics v_respostas = row_count;
    delete from public.sessoes s where s.aplicacao = p_codigo;
    get diagnostics v_sessoes = row_count;
    delete from public.participantes_do_estudo p where p.aplicacao = p_codigo;
    get diagnostics v_participantes = row_count;
    update public.aplicacoes_do_estudo a set entradas = 0 where a.codigo = p_codigo;
  exception when others then
    return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  return public.auditar(v_acao, p_codigo, '{}'::jsonb, 'ok',
    jsonb_build_object(
      'respostas', v_respostas,
      'sessoes', v_sessoes,
      'participantes', v_participantes,
      'entradas_antes', v_aplicacao.entradas
    ));
end;
$$;

-- -------------------------------------------- o interruptor e o freio ---

-- O interruptor da coleta (0003) era um update direto na tabela, sem rastro
-- de quem ligou e desligou fora do último carimbo. Agora é função, auditada.
-- O gatilho `carimbar_coleta` continua carimbando: dentro da função,
-- `auth.uid()` ainda é quem chamou.
create function public.definir_propostos_ocultos(p_ocultos boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'definir-propostos-ocultos';
  v_parametros jsonb := jsonb_build_object('propostos_ocultos', p_ocultos);
  v_achou boolean;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, 'coleta', v_parametros, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;
  if p_ocultos is null then
    return public.auditar(v_acao, 'coleta', v_parametros, 'recusada',
      jsonb_build_object('motivo', 'parametro-invalido'));
  end if;

  begin
    update public.coleta c set propostos_ocultos = p_ocultos where c.unica;
    v_achou := found;
  exception when others then
    return public.auditar(v_acao, 'coleta', v_parametros, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  if not v_achou then
    return public.auditar(v_acao, 'coleta', v_parametros, 'recusada',
      jsonb_build_object('motivo', 'sem-linha-da-coleta'));
  end if;
  return public.auditar(v_acao, 'coleta', v_parametros, 'ok',
    jsonb_build_object('propostos_ocultos', p_ocultos));
end;
$$;

-- O freio de emergência (D33): o pesquisador retira qualquer publicado. Era
-- uma política de update; agora é função, auditada. O gatilho da 0003
-- continua valendo por baixo — só a transição publicado → retirado, e o
-- carimbo de quem retirou.
--
-- O autor continua retirando o próprio pela tabela, como antes: não é ação
-- do pesquisador, e a política dele não muda.
create function public.retirar_publicado(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'retirar-publicado';
  v_achou boolean;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_id::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;

  begin
    update public.exercicios_de_professor e
       set situacao = 'retirado'
     where e.id = p_id and e.situacao = 'publicado';
    v_achou := found;
  exception when others then
    return public.auditar(v_acao, p_id::text, '{}'::jsonb, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  if not v_achou then
    return public.auditar(v_acao, p_id::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'nao-publicado'));
  end if;
  return public.auditar(v_acao, p_id::text, '{}'::jsonb, 'ok', '{}'::jsonb);
end;
$$;

-- Os caminhos antigos fecham: com eles abertos, o pesquisador ainda mudaria
-- o interruptor e retiraria publicados sem passar pela auditoria.
drop policy "so o pesquisador mexe no interruptor" on public.coleta;
revoke update (propostos_ocultos) on public.coleta from authenticated;
revoke update on public.coleta from authenticated;

drop policy "pesquisador retira qualquer publicado" on public.exercicios_de_professor;

-- ------------------------------------------------------------- execução ---

-- Abertas a todo autenticado, e não só ao pesquisador: o papel não é grant,
-- é linha em `perfis`, e quem confere é a função. Assim a recusa do
-- participante e a do professor também ficam na auditoria. O visitante sem
-- identidade nem chega a chamar.
revoke execute on function public.listar_aplicacoes() from public, anon;
grant execute on function public.listar_aplicacoes() to authenticated;
revoke execute on function public.criar_aplicacao(text, boolean) from public, anon;
grant execute on function public.criar_aplicacao(text, boolean) to authenticated;
revoke execute on function public.definir_aplicacao_aberta(text, boolean) from public, anon;
grant execute on function public.definir_aplicacao_aberta(text, boolean) to authenticated;
revoke execute on function public.proteger_aplicacao(text) from public, anon;
grant execute on function public.proteger_aplicacao(text) to authenticated;
revoke execute on function public.limpar_aplicacao(text, text) from public, anon;
grant execute on function public.limpar_aplicacao(text, text) to authenticated;
revoke execute on function public.definir_propostos_ocultos(boolean) from public, anon;
grant execute on function public.definir_propostos_ocultos(boolean) to authenticated;
revoke execute on function public.retirar_publicado(uuid) from public, anon;
grant execute on function public.retirar_publicado(uuid) to authenticated;

-- Os gatilhos não são chamáveis pela API, mas o Supabase concede execução em
-- toda função nova; fechar não custa nada.
revoke execute on function public.auditoria_so_cresce() from public, anon, authenticated;
revoke execute on function public.guardar_protecao_da_aplicacao() from public, anon, authenticated;
revoke execute on function public.guardar_dado_de_aplicacao_protegida() from public, anon, authenticated;

-- A Fase 2 (0006) acrescenta os papéis pelo painel: listar as contas com
-- e-mail, conceder e retirar professor, conceder pesquisador e retirar o de
-- outra conta, com o e-mail digitado; retirar o próprio é sempre recusado.
