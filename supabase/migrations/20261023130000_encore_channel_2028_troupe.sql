insert into public.encore_channels (channel, status, title, url, author, author_url, message, tools, reviewed_at)
values
  (2028, 'live', '台北安可大舞團', 'club/?troupe=animals', '台北安可市民', 'https://github.com/dAAAb/encore-taipei',
   '橘貓、柴犬、臺灣黑熊、熊貓、梅花鹿、浣熊、石虎、兔兔，還有阿嬤、外送員、夜市主廚這些市民朋友，輪流上台跟市長跳同一支舞。按遙控器綠色鍵換一批，紅色鍵讓市長獨舞。',
   'Cursor · Claude Opus 5.5 · three.js', now())
on conflict (channel) do nothing;
