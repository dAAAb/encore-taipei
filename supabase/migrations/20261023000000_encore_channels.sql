-- Encore TV: citizen-built 台北安可 stages, one TV channel each.
-- Clients never touch the tables directly; everything goes through the encore_* functions below,
-- which keep contact details private and gate moderation behind a hashed admin key.

create table if not exists public.encore_channels (
  id uuid primary key default gen_random_uuid(),
  channel integer unique check (channel between 2026 and 99999),
  status text not null default 'pending' check (status in ('pending', 'live', 'hidden')),
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (char_length(url) between 1 and 500),
  author text not null check (char_length(author) between 1 and 60),
  author_url text check (char_length(author_url) <= 300),
  message text check (char_length(message) <= 1000),
  prompt text check (char_length(prompt) <= 12000),
  tools text check (char_length(tools) <= 300),
  contact text check (char_length(contact) <= 200),
  og_image text check (char_length(og_image) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.encore_channels enable row level security;

create table if not exists public.encore_admin_keys (
  key_hash text primary key,
  label text,
  created_at timestamptz not null default now()
);

alter table public.encore_admin_keys enable row level security;

create or replace function public.encore_is_admin(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_key is not null
     and char_length(p_key) >= 24
     and exists (
       select 1 from public.encore_admin_keys k
       where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
     );
$$;

create or replace function public.encore_public_channels()
returns table (
  id uuid, channel integer, title text, url text, author text, author_url text,
  message text, prompt text, tools text, og_image text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.channel, c.title, c.url, c.author, c.author_url, c.message, c.prompt, c.tools, c.og_image, c.created_at
  from public.encore_channels c
  where c.status = 'live' and c.channel is not null
  order by c.channel;
$$;

create or replace function public.encore_submit(
  p_title text, p_url text, p_author text,
  p_author_url text default null, p_message text default null, p_prompt text default null,
  p_tools text default null, p_contact text default null, p_og_image text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_recent integer;
begin
  if p_url is null or p_url !~* '^https://[^\s/$.?#][^\s]*$' then
    raise exception 'invalid_url' using errcode = '22023';
  end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_author), '') is null then
    raise exception 'missing_fields' using errcode = '22023';
  end if;
  if p_author_url is not null and p_author_url <> '' and p_author_url !~* '^https?://' then
    raise exception 'invalid_author_url' using errcode = '22023';
  end if;

  select count(*) into v_recent
  from public.encore_channels
  where created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if exists (select 1 from public.encore_channels where url = btrim(p_url) and status <> 'hidden') then
    raise exception 'duplicate_url' using errcode = '23505';
  end if;

  insert into public.encore_channels (title, url, author, author_url, message, prompt, tools, contact, og_image)
  values (
    btrim(p_title), btrim(p_url), btrim(p_author),
    nullif(btrim(p_author_url), ''), nullif(btrim(p_message), ''), nullif(p_prompt, ''),
    nullif(btrim(p_tools), ''), nullif(btrim(p_contact), ''), nullif(btrim(p_og_image), '')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

create or replace function public.encore_admin_list(p_key text)
returns setof public.encore_channels
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select * from public.encore_channels
    order by (status = 'pending') desc, channel nulls last, created_at desc;
end;
$$;

create or replace function public.encore_admin_update(
  p_key text, p_id uuid, p_status text default null, p_channel integer default null,
  p_title text default null, p_author text default null, p_message text default null
)
returns public.encore_channels
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.encore_channels;
  v_channel integer;
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.encore_channels where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_channel := coalesce(p_channel, v_row.channel);
  if coalesce(p_status, v_row.status) = 'live' and v_channel is null then
    select greatest(coalesce(max(channel), 2025), 2025) + 1 into v_channel from public.encore_channels;
  end if;

  update public.encore_channels
  set status = coalesce(p_status, status),
      channel = v_channel,
      title = coalesce(nullif(btrim(p_title), ''), title),
      author = coalesce(nullif(btrim(p_author), ''), author),
      message = coalesce(p_message, message),
      updated_at = now(),
      reviewed_at = case when p_status is not null then now() else reviewed_at end
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.encore_admin_delete(p_key text, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.encore_channels where id = p_id;
end;
$$;

revoke all on function public.encore_is_admin(text) from public, anon, authenticated;
grant execute on function public.encore_public_channels() to anon, authenticated;
grant execute on function public.encore_submit(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.encore_admin_list(text) to anon, authenticated;
grant execute on function public.encore_admin_update(text, uuid, text, integer, text, text, text) to anon, authenticated;
grant execute on function public.encore_admin_delete(text, uuid) to anon, authenticated;

insert into public.encore_channels (channel, status, title, url, author, author_url, message, tools, reviewed_at)
values
  (2026, 'live', '台北安可之夜', 'club/', 'dAAAb', 'https://github.com/dAAAb/encore-taipei',
   '2033 年的台北 AI 園區夜店，蔣萬安在台上旋轉跳舞，群眾喊出四年政績。第一台，也是一切的開始。',
   'Cursor · Claude Opus 5.5 · three.js', now()),
  (2027, 'live', '2033 台北來生夜店 AFTERLIFE', 'https://daaab.github.io/taipei-punk-2033/', 'dAAAb',
   'https://github.com/dAAAb/taipei-punk-2033', 'Colorfigures 3D 風格的另一座 2033 台北來生夜店，同一首台北安可，不同的舞台。', null, now())
on conflict (channel) do nothing;
