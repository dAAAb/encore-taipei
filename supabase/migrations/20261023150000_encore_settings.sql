-- Server-only settings (e.g. the GitHub token that lets approvals trigger a rebuild).
-- RLS on with no policies: only the service role (edge functions) can read values.
create table if not exists public.encore_settings (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.encore_settings enable row level security;
revoke all on public.encore_settings from anon, authenticated;

create or replace function public.encore_admin_set_setting(p_key text, p_name text, p_value text)
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
  if p_name not in ('github_token') then
    raise exception 'unknown_setting';
  end if;
  if p_value is null or btrim(p_value) = '' then
    delete from public.encore_settings where name = p_name;
    return false;
  end if;
  insert into public.encore_settings (name, value, updated_at) values (p_name, btrim(p_value), now())
  on conflict (name) do update set value = excluded.value, updated_at = now();
  return true;
end;
$$;

-- Which settings exist, never their values.
create or replace function public.encore_admin_settings(p_key text)
returns table (name text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select s.name, s.updated_at from public.encore_settings s;
end;
$$;

revoke all on function public.encore_admin_set_setting(text, text, text) from public;
revoke all on function public.encore_admin_settings(text) from public;
grant execute on function public.encore_admin_set_setting(text, text, text) to anon, authenticated;
grant execute on function public.encore_admin_settings(text) to anon, authenticated;
