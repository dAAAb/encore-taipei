-- HTML stages uploaded from the submit form and pinned to IPFS through the site's Pinata account (Edge Function
-- encore-upload). Uploads happen before review so the author can preview the stage on the TV right away; uploads
-- no channel ever used are unpinned after a day, and deleting a channel unpins its upload.
-- Only the service role (the edge function) touches this table.

create table if not exists public.encore_uploads (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  bytes integer not null check (bytes > 0),
  name text check (char_length(name) <= 200),
  cid text,
  created_at timestamptz not null default now(),
  unpinned_at timestamptz
);
create index if not exists encore_uploads_ip_recent on public.encore_uploads (ip_hash, created_at desc);
create index if not exists encore_uploads_cid on public.encore_uploads (cid);
alter table public.encore_uploads enable row level security;
revoke all on public.encore_uploads from anon, authenticated;

-- Takes an upload slot or raises rate_limited: per visitor 6 an hour and 20 a day, everyone together 120 an hour.
create or replace function public.encore_upload_begin(p_ip_hash text, p_bytes integer, p_name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select count(*) from public.encore_uploads where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 6
     or (select count(*) from public.encore_uploads where ip_hash = p_ip_hash and created_at > now() - interval '1 day') >= 20
     or (select count(*) from public.encore_uploads where created_at > now() - interval '1 hour') >= 120 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.encore_uploads (ip_hash, bytes, name) values (p_ip_hash, p_bytes, left(p_name, 200)) returning id into v_id;
  return v_id;
end;
$$;

-- Pinned uploads older than a day that no channel points at and nobody re-uploaded since.
create or replace function public.encore_upload_stale(p_limit integer default 5)
returns table (cid text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct u.cid
  from public.encore_uploads u
  where u.cid is not null
    and u.unpinned_at is null
    and u.created_at < now() - interval '1 day'
    and not exists (select 1 from public.encore_uploads r where r.cid = u.cid and r.created_at >= now() - interval '1 day')
    and not exists (select 1 from public.encore_channels c where position(u.cid in c.url) > 0)
  limit greatest(1, least(p_limit, 20));
$$;

-- Whether a CID is one of ours and no channel still points at it (safe to unpin after a delete).
create or replace function public.encore_upload_orphan(p_cid text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.encore_uploads u where u.cid = p_cid and u.unpinned_at is null)
     and not exists (select 1 from public.encore_channels c where position(p_cid in c.url) > 0);
$$;

revoke all on function public.encore_upload_begin(text, integer, text) from public, anon, authenticated;
revoke all on function public.encore_upload_stale(integer) from public, anon, authenticated;
revoke all on function public.encore_upload_orphan(text) from public, anon, authenticated;

-- The admin page can now also save the Pinata key and gateway.
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
  if p_name not in ('github_token', 'pinata_jwt', 'pinata_gateway') then
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
