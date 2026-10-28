-- Rooftop chat abuse protection. The poster's address comes from Cloudflare's cf-connecting-ip, which clients
-- cannot forge (x-forwarded-for can be prefixed), and is stored only as a salted hash.
-- Limits per source: 1 message per 5 s, 5 per minute, 30 per hour; everyone together 30 per minute; at most
-- 300 messages waiting for review. Names and messages lose invisible / direction-override characters, and
-- nobody can post as the site. Admins can block a source for a while: its messages are accepted on screen
-- (the poster still sees them in their own browser) but never stored.
alter table public.encore_chat add column if not exists ip_hash text;
create index if not exists encore_chat_ip_idx on public.encore_chat (ip_hash, created_at desc);

create table if not exists public.encore_chat_blocks (
  ip_hash text primary key,
  until timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.encore_chat_blocks enable row level security;
revoke all on public.encore_chat_blocks from anon, authenticated;

insert into public.encore_settings (name, value)
values ('chat_salt', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

create or replace function public.encore_client_hash()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(
    coalesce((select value from public.encore_settings where name = 'chat_salt'), '') || ':' ||
    coalesce(
      nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
      nullif(btrim(regexp_replace(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), '^.*,', '')), ''),
      'unknown'
    ), 'sha256'), 'hex');
$$;
revoke all on function public.encore_client_hash() from public, anon, authenticated;

create or replace function public.encore_chat_post(p_name text, p_body text)
returns table (id bigint, name text, body text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- control characters, zero-width and bidi override characters, then collapse whitespace
  v_strip text := '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]';
  v_name text := left(btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), v_strip, '', 'g'), '\s+', ' ', 'g')), 20);
  v_body text := left(btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), v_strip, '', 'g'), '\s+', ' ', 'g')), 140);
  v_ip text := public.encore_client_hash();
begin
  if v_body = '' then
    raise exception 'empty';
  end if;
  if v_name = '' then
    v_name := '市民';
  end if;
  if v_name ~* '(管理員|管理者|站長|官方|版主|客服|系統|admin|moderator|official)' then
    raise exception 'reserved_name';
  end if;

  if exists (select 1 from public.encore_chat_blocks b where b.ip_hash = v_ip and b.until > now()) then
    return query select (-(extract(epoch from clock_timestamp()) * 1000)::bigint), v_name, v_body, now();
    return;
  end if;

  if exists (select 1 from public.encore_chat c where c.ip_hash = v_ip and c.created_at > now() - interval '5 seconds') then
    raise exception 'too_fast';
  end if;
  if (select count(*) from public.encore_chat c where c.ip_hash = v_ip and c.created_at > now() - interval '1 minute') >= 5
     or (select count(*) from public.encore_chat c where c.ip_hash = v_ip and c.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'slow_down';
  end if;
  if (select count(*) from public.encore_chat c where c.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  if (select count(*) from public.encore_chat c where not c.approved and not c.hidden) >= 300 then
    raise exception 'rate_limited';
  end if;
  if exists (
    select 1 from public.encore_chat c
    where c.body = v_body and (c.name = v_name or c.ip_hash = v_ip) and c.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate';
  end if;

  return query
    insert into public.encore_chat (name, body, ip_hash) values (v_name, v_body, v_ip)
    returning encore_chat.id, encore_chat.name, encore_chat.body, encore_chat.created_at;
end;
$$;

-- Admin: block the source of one message for p_hours (1–720) and hide everything it still has waiting.
create or replace function public.encore_admin_chat_block(p_key text, p_id bigint, p_hours integer default 24)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ip text;
  v_count integer;
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select c.ip_hash into v_ip from public.encore_chat c where c.id = p_id;
  if v_ip is null then
    raise exception 'no_source';
  end if;
  insert into public.encore_chat_blocks (ip_hash, until, reason)
  values (v_ip, now() + make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720)), 'admin')
  on conflict (ip_hash) do update set until = excluded.until;
  update public.encore_chat set hidden = true, approved = false
  where ip_hash = v_ip and not approved;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.encore_admin_chat_block(text, bigint, integer) from public;
grant execute on function public.encore_admin_chat_block(text, bigint, integer) to anon, authenticated;
drop function if exists public.encore_tmp_headers();
