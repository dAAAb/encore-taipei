-- Rooftop chat for the Encore Tower. Writes only through encore_chat_post (length + rate limits);
-- reads only through encore_chat_recent; admins can hide messages.
create table if not exists public.encore_chat (
  id bigint generated always as identity primary key,
  name text not null,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists encore_chat_recent_idx on public.encore_chat (created_at desc);
alter table public.encore_chat enable row level security;
revoke all on public.encore_chat from anon, authenticated;

create or replace function public.encore_chat_recent(p_limit integer default 40)
returns table (id bigint, name text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.body, c.created_at
  from public.encore_chat c
  where not c.hidden
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

create or replace function public.encore_chat_post(p_name text, p_body text)
returns table (id bigint, name text, body text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_name text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 20);
  v_body text := left(regexp_replace(btrim(coalesce(p_body, '')), '\s+', ' ', 'g'), 140);
begin
  if v_body = '' then
    raise exception 'empty';
  end if;
  if v_name = '' then
    v_name := '市民';
  end if;
  if (select count(*) from public.encore_chat c where c.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from public.encore_chat c where c.body = v_body and c.name = v_name and c.created_at > now() - interval '10 minutes') then
    raise exception 'duplicate';
  end if;
  return query
    insert into public.encore_chat (name, body) values (v_name, v_body)
    returning encore_chat.id, encore_chat.name, encore_chat.body, encore_chat.created_at;
end;
$$;

create or replace function public.encore_admin_chat(p_key text)
returns setof public.encore_chat
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from public.encore_chat order by created_at desc limit 200;
end;
$$;

create or replace function public.encore_admin_chat_hide(p_key text, p_id bigint, p_hidden boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.encore_chat set hidden = p_hidden where id = p_id;
  return p_hidden;
end;
$$;

revoke all on function public.encore_chat_recent(integer) from public;
revoke all on function public.encore_chat_post(text, text) from public;
revoke all on function public.encore_admin_chat(text) from public;
revoke all on function public.encore_admin_chat_hide(text, bigint, boolean) from public;
grant execute on function public.encore_chat_recent(integer) to anon, authenticated;
grant execute on function public.encore_chat_post(text, text) to anon, authenticated;
grant execute on function public.encore_admin_chat(text) to anon, authenticated;
grant execute on function public.encore_admin_chat_hide(text, bigint, boolean) to anon, authenticated;
