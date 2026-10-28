-- Rooftop chat goes through review: a new message is stored as not yet approved and only approved, unhidden
-- messages are public. The poster keeps seeing their own message in their browser while it waits.
-- Messages already showing stay public.
alter table public.encore_chat add column if not exists approved boolean not null default false;
update public.encore_chat set approved = true where not hidden and not approved;
create index if not exists encore_chat_public_idx on public.encore_chat (created_at desc) where approved and not hidden;

create or replace function public.encore_chat_recent(p_limit integer default 40)
returns table (id bigint, name text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.body, c.created_at
  from public.encore_chat c
  where c.approved and not c.hidden
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

-- encore_admin_chat returns setof encore_chat, so it now includes `approved`; recreate it so the row type is current.
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
  return query
    select * from public.encore_chat
    order by (not approved and not hidden) desc, created_at desc
    limit 300;
end;
$$;

-- Approve (makes public, un-hides) or hide one or many messages; returns how many changed.
create or replace function public.encore_admin_chat_review(p_key text, p_ids bigint[], p_approved boolean)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.encore_chat
  set approved = p_approved, hidden = not p_approved
  where id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.encore_admin_chat_review(text, bigint[], boolean) from public;
grant execute on function public.encore_admin_chat_review(text, bigint[], boolean) to anon, authenticated;
