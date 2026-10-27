-- Channel 2033 becomes ai2033.taipei. The 台北安可大舞團 stage that held it is kept, hidden and unnumbered,
-- so it can come back on any free channel from the admin page.
update public.encore_channels
set status = 'hidden', channel = null, updated_at = now()
where channel = 2033 and url = 'club/?troupe=animals';

insert into public.encore_channels (channel, status, title, url, author, author_url, message, prompt, tools, og_image, reviewed_at)
values (
  2033,
  'live',
  'AI黃金世紀，從臺北開始｜松機變身臺北AI園區',
  'https://ai2033.taipei/',
  '台北安可市民',
  'https://github.com/dAAAb/ai2033.taipei',
  '2026/10/08 臺北市長蔣萬安宣布：規劃遷移松山機場，打造 300 公頃「臺北AI園區」：100 公頃 AI 產業聚落、90 公頃國際永續生活聚落、110 公頃中央公園。大字版重點整理、記者會文字整理、簡報下載與 3D 沉浸式體驗。',
  $prompt$可否製作逐字稿
以及 PPT PDF 和 清晰字大的互動式網站
都給我公開連結
感謝：
AI黃金世紀，
從臺北開始！！
大台北
= 亞洲新矽谷
蔣萬安 + 李四川
= 大台北新矽谷
https://youtu.be/ircGbXWHRbQ?si=gRi8lFJCsbfnrr47
可以使用 three js 做台北的 3D 模擬
點進去可以有一個類似 台北 GTA (你上網查）的沈浸式互動頁面 可以體驗 松機變成 台北 AI 園區 和110公頃綠地的感覺
根據這個發表會和網路上的官方訊息
製作超級厲害的網頁介紹
要穿插蔣萬安市長的照片
謝謝$prompt$,
  'Claude · three.js',
  'https://ai2033.taipei/assets/og.jpg',
  now()
)
on conflict (channel) do nothing;
