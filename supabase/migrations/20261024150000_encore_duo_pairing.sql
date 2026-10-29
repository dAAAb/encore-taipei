-- Pairing codes for the creative two-phone Duo: a phone opened with ?duo=tv asks for a 6-digit code for its
-- realtime room; a phone opened with ?duo=remote trades the code for the room. The QR code on the
-- TV carries the room itself, so codes are only the typed fallback: short-lived, single-use, and
-- both calls are throttled site-wide so the 10^6 code space cannot be walked.
create table if not exists public.encore_duo_codes (
  code text primary key check (code ~ '^[0-9]{6}$'),
  room text not null check (room ~ '^[A-Za-z0-9]{16,40}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes'
);
create index if not exists encore_duo_codes_room_idx on public.encore_duo_codes (room);
alter table public.encore_duo_codes enable row level security;

create table if not exists public.encore_duo_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
create index if not exists encore_duo_attempts_at_idx on public.encore_duo_attempts (at);
alter table public.encore_duo_attempts enable row level security;

create or replace function public.encore_duo_code(p_room text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text;
  v_expires timestamptz;
  v_try integer := 0;
begin
  if p_room is null or p_room !~ '^[A-Za-z0-9]{16,40}$' then
    raise exception 'invalid_room' using errcode = '22023';
  end if;

  delete from public.encore_duo_codes where expires_at < now();

  select code, expires_at into v_code, v_expires
  from public.encore_duo_codes
  where room = p_room and expires_at > now() + interval '30 seconds'
  order by expires_at desc
  limit 1;
  if found then
    return jsonb_build_object('code', v_code, 'expires_at', v_expires);
  end if;

  if (select count(*) from public.encore_duo_codes where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  loop
    v_try := v_try + 1;
    v_code := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
    begin
      insert into public.encore_duo_codes (code, room) values (v_code, p_room)
      returning expires_at into v_expires;
      exit;
    exception when unique_violation then
      if v_try >= 8 then
        raise exception 'busy' using errcode = '54000';
      end if;
    end;
  end loop;

  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$function$;

create or replace function public.encore_duo_claim(p_code text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_room text;
begin
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  delete from public.encore_duo_attempts where at < now() - interval '10 minutes';
  if (select count(*) from public.encore_duo_attempts where at > now() - interval '1 minute') >= 60 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.encore_duo_attempts default values;

  -- A miss returns null instead of raising, so the attempt row above is committed and counted.
  delete from public.encore_duo_codes
  where code = p_code and expires_at > now()
  returning room into v_room;
  return v_room;
end;
$function$;

revoke all on function public.encore_duo_code(text) from public;
revoke all on function public.encore_duo_claim(text) from public;
grant execute on function public.encore_duo_code(text) to anon, authenticated;
grant execute on function public.encore_duo_claim(text) to anon, authenticated;
