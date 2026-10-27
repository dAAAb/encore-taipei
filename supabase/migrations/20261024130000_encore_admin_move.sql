-- Renumber a channel in one transaction. If the target number is taken, the call fails with
-- `channel_taken` unless p_occupant_to says where the current occupant goes (e.g. the mover's
-- old number for a swap), so a renumber can never silently collide.
create or replace function public.encore_admin_move(p_key text, p_id uuid, p_channel integer, p_occupant_to integer default null)
returns setof public.encore_channels
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.encore_channels;
  v_occ public.encore_channels;
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_channel is null or p_channel < 2026 then
    raise exception 'invalid_channel' using errcode = '22023';
  end if;

  select * into v_row from public.encore_channels where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.channel = p_channel then
    return next v_row;
    return;
  end if;

  select * into v_occ from public.encore_channels where channel = p_channel and id <> p_id for update;
  if found then
    if p_occupant_to is null then
      raise exception 'channel_taken' using errcode = '23505', detail = v_occ.id::text;
    end if;
    if p_occupant_to = p_channel or p_occupant_to < 2026 then
      raise exception 'invalid_occupant_channel' using errcode = '22023';
    end if;
    if exists (select 1 from public.encore_channels where channel = p_occupant_to and id not in (p_id, v_occ.id)) then
      raise exception 'occupant_channel_taken' using errcode = '23505';
    end if;
    update public.encore_channels set channel = null where id = p_id;
    update public.encore_channels set channel = p_occupant_to, updated_at = now() where id = v_occ.id returning * into v_occ;
    return next v_occ;
  end if;

  update public.encore_channels set channel = p_channel, updated_at = now() where id = p_id returning * into v_row;
  return next v_row;
end;
$function$;

revoke all on function public.encore_admin_move(text, uuid, integer, integer) from public;
grant execute on function public.encore_admin_move(text, uuid, integer, integer) to anon, authenticated;
