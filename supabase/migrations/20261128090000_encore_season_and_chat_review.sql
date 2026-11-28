-- Seasons and a calmer rooftop chat.
--
-- Two public switches live in encore_settings: `season` ('2099' or 'backrooms') picks the look of the TV room and
-- the tower, and `roof_chat` ('open' or 'closed') opens or rests the rooftop chat. Admins flip them from the admin
-- page; the site reads them through encore_public_settings(), which exposes only these two names.
--
-- The review queue no longer jams: only messages from the last 24 hours count toward the 300 waiting limit, and
-- anything still waiting after 3 days is put away. Every 10 minutes a conservative pass approves plain, friendly
-- lines from sources with no hidden messages; everything else keeps waiting for a person.

alter table public.encore_chat add column if not exists review_note text;

create or replace function public.encore_public_settings()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'season', coalesce((select value from public.encore_settings where name = 'season'), '2099'),
    'roof_chat', coalesce((select value from public.encore_settings where name = 'roof_chat'), 'open')
  );
$$;
revoke all on function public.encore_public_settings() from public;
grant execute on function public.encore_public_settings() to anon, authenticated;

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
  if p_name not in ('github_token', 'pinata_jwt', 'pinata_gateway', 'season', 'roof_chat') then
    raise exception 'unknown_setting';
  end if;
  if p_name = 'season' and coalesce(btrim(p_value), '') not in ('', '2099', 'backrooms') then
    raise exception 'invalid_value';
  end if;
  if p_name = 'roof_chat' and coalesce(btrim(p_value), '') not in ('', 'open', 'closed') then
    raise exception 'invalid_value';
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
  if coalesce((select value from public.encore_settings where name = 'roof_chat'), 'open') = 'closed' then
    raise exception 'closed';
  end if;
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
  if (select count(*) from public.encore_chat c
      where not c.approved and not c.hidden and c.created_at > now() - interval '24 hours') >= 300 then
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

-- True only when the whole line is made of greetings, cheers and compliments (plus punctuation, emoji and a few
-- particles), and the nickname is plain. Anything else, however harmless, waits for a person.
create or replace function public.encore_chat_plain(p_name text, p_body text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    char_length(p_body) between 1 and 40
    and p_body ~ '[\u4e00-\u9fffA-Za-z]'
    and p_body !~ '(棒棒|🖕|💩|🤡|🐷|🐖|🐶|🐕|🤮|🤬|👎|🙄|🤣|😂|😅)'
    and regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(p_body),
          '(大家好|你好|您好|哈囉|hello|hi|hey|安安|早安|午安|嗨|'
          || '台北安可|安可|台北|蔣市長|蔣萬安|萬安|市長|加油|一起|繼續|支持|謝謝|感謝|辛苦了|恭喜|當選|連任|'
          || '讚啦|讚|棒|好美|漂亮|好看|可愛|好玩|有趣|好酷|酷|喜歡|愛|厲害|帥|美|舒服|'
          || '黃金十年|黃金|十年|未來|2099|夜景|頂樓|花園|吹風|風景|來了|我來了|打卡|簽到|留名|新年快樂|生日快樂|快樂)',
          '', 'g'),
        '(大家|我們|我|你們|你|在|來|看|的|了|很|超|好|真|太|也|都|是|啊|喔|耶|呀|啦|唷|哦|囉|欸|哇|嘿|吧|呢|～|~)',
        '', 'g'),
      '[^\u3040-\u30ff\u3100-\u312f\u31a0-\u31bf\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7afa-z0-9]', '', 'g') = ''
    and p_name !~* (
      '蔣|萬安|市長|議員|總統|安可|官方|沈|伯洋|洋流|習|毛澤|盧|柯|黃國昌|8964|1450|64|ㄋ|ㄟ|餒|奶|乳|5告|烙賽|'
      || '幹|靠|屁|媽|操|網軍|青鳥|吱|共產|台獨|獨立|國民黨|民進黨|民眾黨|kmt|dpp|tpp|fuck|shit|sex'
    );
$$;

create or replace function public.encore_chat_auto_review()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  update public.encore_chat
  set hidden = true, review_note = 'expired'
  where not approved and not hidden and created_at < now() - interval '3 days';

  for r in
    select c.id, c.name, c.body, c.ip_hash
    from public.encore_chat c
    where not c.approved and not c.hidden
      and c.created_at < now() - interval '3 minutes'
      and c.created_at > now() - interval '3 days'
      and c.review_note is null
    order by c.created_at
    limit 200
  loop
    if v_count >= 20 then
      exit;
    end if;
    if public.encore_chat_plain(r.name, r.body)
       and r.ip_hash is not null
       and not exists (select 1 from public.encore_chat_blocks b where b.ip_hash = r.ip_hash)
       and not exists (
         select 1 from public.encore_chat h
         where h.ip_hash = r.ip_hash and h.hidden and h.created_at > now() - interval '14 days'
       )
       and (select count(*) from public.encore_chat a
            where a.ip_hash = r.ip_hash and a.review_note = 'auto' and a.created_at > now() - interval '1 hour') < 3
    then
      update public.encore_chat set approved = true, review_note = 'auto' where id = r.id;
      v_count := v_count + 1;
    else
      update public.encore_chat set review_note = 'waiting' where id = r.id;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.encore_chat_auto_review() from public, anon, authenticated;
revoke all on function public.encore_chat_plain(text, text) from public, anon, authenticated;

-- Admin decisions clear the auto-review note so the admin list shows who decided.
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
  set approved = p_approved, hidden = not p_approved, review_note = 'admin'
  where id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
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
  return query
    select * from public.encore_chat
    order by (not approved and not hidden) desc, created_at desc
    limit 300;
end;
$$;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'encore-chat-auto-review';
select cron.schedule('encore-chat-auto-review', '*/10 * * * *', 'select public.encore_chat_auto_review()');
