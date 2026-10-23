-- Swap the caller's admin key for a fresh one; the old link stops working immediately.
create or replace function public.encore_admin_rotate(p_key text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old text := encode(extensions.digest(p_key, 'sha256'), 'hex');
  v_new text := 'enc_' || translate(encode(extensions.gen_random_bytes(30), 'base64'), '+/', '-_');
  v_label text;
begin
  if not public.encore_is_admin(p_key) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.encore_admin_keys where key_hash = v_old returning label into v_label;
  insert into public.encore_admin_keys (key_hash, label)
  values (encode(extensions.digest(v_new, 'sha256'), 'hex'), coalesce(v_label, 'admin'));
  return v_new;
end;
$$;

revoke all on function public.encore_admin_rotate(text) from public;
grant execute on function public.encore_admin_rotate(text) to anon, authenticated;
