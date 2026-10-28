-- Scripts that rotate through many addresses (cloud NAT pools) slip past the per-source limits, so the same
-- nickname is limited too: 5 per minute, 30 per hour.
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
     or (select count(*) from public.encore_chat c where c.ip_hash = v_ip and c.created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.encore_chat c where c.name = v_name and c.created_at > now() - interval '1 minute') >= 5
     or (select count(*) from public.encore_chat c where c.name = v_name and c.created_at > now() - interval '1 hour') >= 30 then
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
