-- A aprovação de professores pelo painel de controle (D45).
--
-- Roda uma vez, no editor SQL do projeto Supabase, depois da 0006. SÓ
-- ACRESCENTA: três funções novas. Nenhuma tabela, política, gatilho ou função
-- existente muda, e nenhum dado é tocado.
--
-- Até aqui o papel de professor era dado à mão, com um `update` em `perfis`
-- no editor SQL (D29). O professor criava a conta, via "aguardando
-- liberação", e ficava esperando o pesquisador abrir o banco. Agora o
-- pesquisador vê quem se cadastrou e aprova pelo painel.
--
-- As regras, e onde cada uma é cobrada:
--
--   só o pesquisador lista, concede e revoga .............. dentro de cada função
--   só o papel "professor" entra e sai por aqui ........... os dois `update`
--   ninguém vira pesquisador por estas funções ............ não há parâmetro de papel
--   ninguém deixa de ser pesquisador por estas funções .... a recusa `e-pesquisador`
--   o pesquisador não mexe na própria conta ............... a recusa `a-propria-conta`
--   conta anônima nunca vira professor .................... a recusa `conta-anonima`
--   cada concessão e revogação fica na auditoria .......... `auditar`, da 0005
--
-- O papel de pesquisador continua sendo dado SÓ por SQL manual: nenhuma
-- função desta migração escreve 'pesquisador' em lugar nenhum.

-- ------------------------------------------------------------ a listagem ---

-- As contas que alguém criou de verdade — por Google ou por e-mail e senha —,
-- com o papel de cada uma. As contas anônimas dos estudantes ficam de fora:
-- são milhares, não pedem papel, e listá-las aqui exporia o id de cada
-- participante numa tela que não precisa dele.
--
-- SECURITY DEFINER porque o e-mail e o nome moram em `auth.users`, que
-- nenhuma conta do navegador lê. A função confere o papel de quem chama antes
-- de ler qualquer coisa, e devolve só as cinco colunas abaixo.
--
-- O nome vem do que o Google entrega no cadastro; quem entrou por e-mail e
-- senha não tem, e a coluna volta nula.
create function public.listar_cadastros_de_professor()
returns table (
  id uuid,
  email text,
  nome text,
  cadastrado_em timestamptz,
  papel public.papel_de_usuario
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.e_pesquisador() then
    raise exception 'só o pesquisador lista os cadastros' using errcode = '42501';
  end if;
  return query
    select u.id,
           u.email::text,
           nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                                 u.raw_user_meta_data ->> 'name', '')), ''),
           u.created_at,
           p.papel
      from auth.users u
      join public.perfis p on p.id = u.id
     where u.is_anonymous is not true
       and u.email is not null
     order by u.created_at desc, u.id;
end;
$$;

revoke execute on function public.listar_cadastros_de_professor() from public, anon;
grant execute on function public.listar_cadastros_de_professor() to authenticated;

-- ----------------------------------------------------------- a concessão ---

-- Dá o papel de professor a uma conta que ainda é participante.
--
-- Como nas funções da 0005, a recusa é linha de auditoria e resposta
-- (`ok: false`, com o motivo), e não exceção: uma exceção desfaria a linha da
-- auditoria junto, e quem tentou sem poder não deixaria rastro.
--
-- O `update` leva o papel atual na condição. É ela, e não a leitura de antes,
-- que garante que a função só transforma participante em professor: se o
-- papel mudar entre a leitura e a escrita, nada é escrito.
create function public.conceder_papel_de_professor(p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'conceder-papel-de-professor';
  v_email text;
  v_anonima boolean;
  v_papel public.papel_de_usuario;
  v_mudou boolean;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;
  if p_usuario is null then
    return public.auditar(v_acao, null, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'parametro-invalido'));
  end if;

  select u.email::text, coalesce(u.is_anonymous, false), p.papel
    into v_email, v_anonima, v_papel
    from auth.users u
    join public.perfis p on p.id = u.id
   where u.id = p_usuario;

  if not found then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'conta-inexistente'));
  end if;
  if v_anonima or v_email is null then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'conta-anonima'));
  end if;
  if v_papel = 'pesquisador' then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'e-pesquisador', 'email', v_email));
  end if;
  if v_papel = 'professor' then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'ja-e-professor', 'email', v_email));
  end if;

  begin
    update public.perfis p
       set papel = 'professor'
     where p.id = p_usuario and p.papel = 'participante';
    v_mudou := found;
  exception when others then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  if not v_mudou then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'papel-mudou', 'email', v_email));
  end if;
  return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'ok',
    jsonb_build_object('email', v_email, 'papel', 'professor'));
end;
$$;

revoke execute on function public.conceder_papel_de_professor(uuid) from public, anon;
grant execute on function public.conceder_papel_de_professor(uuid) to authenticated;

-- ----------------------------------------------------------- a revogação ---

-- Tira o papel de professor: a conta volta a participante.
--
-- A própria conta de quem chama é recusada antes de qualquer leitura. Quem
-- chama é pesquisador, e esta função nunca tiraria esse papel — mas a recusa
-- não depende disso: se um dia um papel acumular com outro, a regra de não
-- mexer no próprio acesso já está escrita.
--
-- O que a revogação não toca: os exercícios que o professor já escreveu. Os
-- publicados continuam publicados, e quem os retira é o freio do painel
-- (`retirar_publicado`, 0005). Sem o papel, a conta deixa de escrever e de
-- publicar, porque as políticas da 0002 conferem `e_professor()` a cada
-- escrita.
create function public.revogar_papel_de_professor(p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao constant text := 'revogar-papel-de-professor';
  v_email text;
  v_papel public.papel_de_usuario;
  v_mudou boolean;
begin
  if not public.e_pesquisador() then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'so-pesquisador'));
  end if;
  if p_usuario is null then
    return public.auditar(v_acao, null, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'parametro-invalido'));
  end if;
  if p_usuario = (select auth.uid()) then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'a-propria-conta'));
  end if;

  select u.email::text, p.papel
    into v_email, v_papel
    from auth.users u
    join public.perfis p on p.id = u.id
   where u.id = p_usuario;

  if not found then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'conta-inexistente'));
  end if;
  if v_papel = 'pesquisador' then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'e-pesquisador', 'email', v_email));
  end if;
  if v_papel <> 'professor' then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'nao-e-professor', 'email', v_email));
  end if;

  begin
    update public.perfis p
       set papel = 'participante'
     where p.id = p_usuario and p.papel = 'professor';
    v_mudou := found;
  exception when others then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'falhou',
      jsonb_build_object('erro', sqlerrm, 'estado', sqlstate));
  end;

  if not v_mudou then
    return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'recusada',
      jsonb_build_object('motivo', 'papel-mudou', 'email', v_email));
  end if;
  return public.auditar(v_acao, p_usuario::text, '{}'::jsonb, 'ok',
    jsonb_build_object('email', v_email, 'papel', 'participante'));
end;
$$;

revoke execute on function public.revogar_papel_de_professor(uuid) from public, anon;
grant execute on function public.revogar_papel_de_professor(uuid) to authenticated;
