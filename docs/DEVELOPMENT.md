# 開發說明：台北安可大舞台 ENCORE.TAIPEI

空房間裡有一台電視。打開它，從十大建設、竹科、台積電一路看到公館圓環，鏡頭推進螢幕，轉到第 2026 台就是〈台北安可之夜〉；
再往下轉，每一台都是一位市民用 AI 做的台北安可舞台。轉到最後一台「訊號徵求中」，你也可以送出自己的舞台。

> 粉絲創作之互動藝術作品，非蔣萬安競選團隊官方網站。

| 網址 | 內容 |
| --- | --- |
| `/` | 大舞台（後室、新聞特輯開場、轉台、片尾） |
| `/2026/`、`/2027/`… | 直接轉到某一台，每台有自己的分享預覽圖與標題 |
| `/3d/`、`/2037/` | 短網址與舊台號：打開「台北安可 3D」（現在第 2077 台），分享預覽和那一台相同；清單在 `src/tv/aliases.ts`，用頻道 id 對應，改台號也會跟著走 |
| `/club/` | 第 2026 台〈台北安可之夜〉單獨開啟 |
| `/admin/` | 頻道管理（需要管理連結） |
| `/tower/`、`/tower/2027/`… | 台北安可大樓：每台是一層樓，搭無人機逛；同一份頁面也發布在網站根目錄的 `encore.taipei/tower/` |
| `/submit/` | 上架申請頁：一般網頁，不載入 3D；送出後帶到大舞台預覽。同一份頁面也發布在 `encore.taipei/submit/` |

正式站 [encore.taipei](https://encore.taipei/) 的首頁就是這台電視，打開直接轉到第 2026 台；Beta 分支部署在 [encore.taipei/beta/](https://encore.taipei/beta/) 當下一版的預覽。

## 一次看完

1. **後室開場**：黃色壁紙的 Backrooms 走廊盡頭有一台老電視。點一下，電視「啪」一聲亮起，播出〈台北安可 新聞特輯〉：
   1974 十大建設、1980 新竹科學園區、1987 台積電、2012 美國免簽、2016 北門重見天日、2025 公館圓環拆除。
   鏡頭一路推近，燈光從閃爍變得明亮，電視從 70 年代木頭電視、90 年代映像管電視變成液晶電視，最後依照你的螢幕比例推進到滿版。
2. **轉台**：右下角漂浮的遙控器（像 GTA 的手機）可以轉台、調音量、靜音、輸入台號、看資訊、分享；
   鍵盤 ← → 轉台、+ − 音量、M 靜音、I 資訊、數字鍵直接選台。轉台有雜訊與音效，右上角短暫顯示台號，就像液晶電視。
   遙控器量自己的高度，畫面不夠高時整支縮小（最小 0.42 倍），所以上方的「收起」把手永遠在畫面裡；往下滑收起、往上滑拿起，
   點電視畫面（iframe 取得焦點時頁面會失去焦點）、按 Esc 或 R 也會收起。從按鍵上開始的滑動不會按到那顆鍵。
   遙控器最下面一排彩色鍵依序是：紅 5️⃣ 播放音效（`public/remote/five.wav`）、綠 📱 用 `?duo` 進入 Duo 模式、
   黃 📺 用 `?tv` 進入可配對的電視模式、藍 🕹️ 用 `?remote` 進入可配對的遙控器模式。
   頻道網址是 YouTube（影片、Shorts、youtu.be）時，電視和大樓會自動改用 YouTube 內嵌播放器滿版播放，音量跟著遙控器。
3. **上架你的舞台**：最後一台是彩色條紋的「訊號徵求中」。按「一鍵交給你的 AI Agent」會複製一份完整 prompt
   （入門 prompt、遙控器程式碼、第 2026 台原始 prompt、部署與上架步驟），直接貼給 AI 助手；也可以按「怎麼做」看步驟。按「上架這一台」填網址，
   送出後這一台立刻換成你的舞台（只有你看得到），管理員審核通過才正式上架。
4. **關機彩蛋**：按遙控器電源鍵，鏡頭拉遠，電視其實站在大安森林公園露天音樂台上，噴出火焰飛上天，穿過雲層看見以台灣為中心的地球，
   飛進星空。星星連成蔣萬安的臉、眨眼、閃十字光，〈台北安可〉響起，片尾名單滾動。最後畫面中間裂開一道白線，點一下穿過去，回到後室，電視掉在地上。

### 體感安可

第 2026 台右上角「體感安可」在 3D 舞台上蓋一層 2D canvas（`src/lib/confetti.ts`），從畫面下緣兩角噴出彩帶、彩紙和飄帶，台下群眾跟著歡呼。
動作感測在 `src/lib/motion.ts`：iPhone 第一次按會跳出「動作與方向」權限（只能在點擊當下詢問），Android 直接可用；讀數依螢幕方向換成畫面座標，
iOS 和規格的正負號相反，前 20 筆讀數會自動校正。搖一下會把空中的彩帶往反方向甩（像搖晃一個裝著彩帶的盒子），用力搖且畫面上所剩不多時再放一輪；
傾斜手機會改變重力方向，彩帶落地前就會改往低的那一邊飄。電腦（包括所有 Mac 筆電）沒有開放動作感測器給瀏覽器，1.6 秒內沒有讀數就改用滑鼠：
快速左右甩動三下放彩帶，游標移動會帶動空氣。Duo 模式下舞台按鈕收起，遙控器的舞台列多一顆「✨體感」：
手上那支手機的搖晃與傾斜會以 `{ a: 'encore', t: 'burst' | 'gust' | 'tilt' }` 舞台指令送到電視（每秒最多約 8 則）。

### 大家一起上台與「台北安可大舞團」

右上角「大家一起上台」（或鍵盤 D；Duo 遙控器的舞台按鍵）會讓六位表演者從舞台下跳上來，和市長跳同一套舞、踩同一個拍子。
按鈕上寫的就是按下去會上台的那一批，依序輪替：大家一起 → 可愛動物（橘貓、柴犬、臺灣黑熊、熊貓、梅花鹿、浣熊、石虎、兔兔）→
市民朋友（上班族、高中生、阿嬤、外送員、護理師、夜市主廚、阿伯、籃球少年）。「獨舞」讓市長一個人跳。
網址加 `?troupe=animals`、`citizens` 或 `mix` 可以讓表演者一開場就在台上，每次進來的陣容和順序都不同。
`club/?troupe=animals` 是同一座夜店、標題換成「台北安可大舞團」的版本（目前沒有排在頻道上）。角色定義在 `src/scene/troupe-looks.ts`。

## 台北安可大樓（`/tower/`）

同一份頻道清單的另一種逛法：每一台是一層樓，第 2026 台是一樓，往上依序疊；大樓至少蓋到 2035 樓（黃金十年），
台數更多就繼續長高。最上面是紐約風頂樓花園。

- **大樓外**：玻璃帷幕大樓，每層落地窗裡看得到那一台的分享預覽圖，霧面模糊、慢慢漂移，加上派對燈光與玻璃反光，
  像一段一直循環的朦朧 GIF；不用同時跑十座 3D 舞台。空著的那一層掛「招租中」，再往上是「即將開放」的空辦公室。
- **無人機**：畫面下方是你的無人機。滾輪或上下拖曳／滑動是上下飛，左右拖曳繞著大樓轉，雙指或 ＋ − 拉近拉遠；
  右下角遙控器有上下一層、遠近、頂樓、回最底層與「飛進」。鍵盤 ↑ ↓ 換樓層、Enter 飛進去。放開後自動對準最近的一層。
- **飛進樓層**：點樓層（或按「飛進」），無人機衝向那一層的窗戶、鏡頭推到窗戶剛好填滿螢幕，接著換成那一台的舞台本身。
  畫面四周有一圈薄霧（像隔著玻璃），中間清楚；薄霧可以關。↑ ↓ 搭電梯換樓層（電梯門關上、叮一聲、門打開），
  Esc、瀏覽器上一頁或「飛出大樓」飛回大樓外。從最高的一層再往上，就飛到頂樓。
- **頂樓花園**：木棧板、玻璃欄杆、串燈、躺椅、立燈、火盆桌、植栽、紐約水塔，與「台北安可 黃金十年」燈泡招牌（燈泡會跑馬）。
  飛到頂樓會出現聊天室；最新幾句話會變成對話泡泡，浮在躺椅上。留言存在 Supabase `encore_chat`，
  只能透過 `encore_chat_post` 寫入（暱稱 20 字、內容 140 字、不能重複洗版、全站每分鐘上限 30 則），後台「頂樓聊天」分頁可以隱藏留言。
- 空樓層一樣可以「一鍵交給你的 AI Agent」或直接上架，送出後那一層馬上換成你的舞台（只有你看得到）。
- `/tower/2027/` 會直接飛進 2027 樓，每層有自己的分享標題與預覽圖。程式在 `src/tower/`。

## Duo 模式：上面電視、下面遙控器（`?duo`、`?tv`、`?remote`）

任何一台的網址後面都可以加參數，例如 `encore.taipei/2026/?duo`：

| 參數 | 用途 |
| --- | --- |
| `?duo` | 單機上下分割：上面是電視，下面是滿版遙控器。給 iPhone Duo 內螢幕直拿，一般手機直拿也能用；橫拿時回到一般版。 |
| `?tv` | 這支手機只當電視，畫面上顯示 QR code 和 6 位數配對碼。 |
| `?remote` | 這支手機只當遙控器。用相機掃電視的 QR code 會直接連上，或在這裡輸入配對碼。 |

規則：
- 大小寫都可以。
- 同時寫好幾個時，以遙控器、電視、單機分割的順序取一個。
- 寫成 `?duo=false`、`=0`、`=off` 或 `=no` 等於沒開。
- 舊寫法 `?duo=true`、`?duo=tv`、`?duo=remote` 繼續有效。

兩支 iPhone 打橫、上下貼在一起，上面開 `?tv`、下面開 `?remote`，就是「窮人版 Duo」。

- **遙控器會依空間自動排版**：直拿像一支真的遙控器，橫拿或 Duo 下半部時，左手轉台、右手音量。
- **完整功能**：可以點頻道縮圖直接轉台、用數字鍵選台、調音量和靜音、看頻道資訊、上架、分享，也能用彩色鍵。
- **舞台控制**：內建舞台（第 2026、2033 台）多一排舞台控制（鏡頭、官方 MV／節拍、上台、體感安可），舞台自己的按鈕會自動收起。
- **Duo 的折線**：Safari 目前只有在實驗設定裡才會告訴網頁折線在哪裡。沒有的話，螢幕比例像折疊機內螢幕時用螢幕高度推算，
  其他裝置則讓電視維持 16:9。中間的分隔條可以拖曳調整，點兩下恢復。
- **連線方式**：兩支手機透過 Supabase Realtime 的廣播頻道 `encore-duo:<房間>` 溝通，不存任何資料。
  房間碼是 24 碼隨機字串，只存在電視那個分頁的 `sessionStorage`，不放進網址；遙控器從 QR 連結拿到房間碼後，
  也會立刻從網址拿掉，避免分享出去。
- **配對碼**：資料表 `encore_duo_codes` 只能透過 `encore_duo_code` / `encore_duo_claim` 存取。
  配對碼 5 分鐘內有效、用過就失效；全站每分鐘最多試 60 次，猜錯也會計入。
- **防爆**：
  - 收到的每則訊息都先照固定格式檢查，不符合就丟掉；超過 8 KB 的訊息也直接丟掉。
  - 電視每秒最多執行約 12 個指令。
  - 斷線會自動重連，手機從背景回來時也會立刻重連。
  - 兩支手機都會保持螢幕不鎖定。
- **聲音**：只從電視那支出來。iPhone 上如果新的一台被擋聲音，舞台會顯示「點一下打開聲音」。

程式在 `src/tv/duo/`。

## 頻道與後台

投稿有三個入口：大舞台「訊號徵求中」那一台、大樓「招租中」的樓層，以及獨立的上架頁 `encore.taipei/submit/`（`src/submit/`）。
三者共用同一份表單（`SubmitFields`）；送出後預覽存在瀏覽器（`encore.pending`），上架頁送出後會直接帶到大舞台那一台。

頻道資料存在 Supabase（`ai2023` 專案中以 `encore_` 開頭的資料表），所有讀寫都經過 `supabase/migrations/` 裡的 SQL 函式：

| 函式 | 誰能用 | 做什麼 |
| --- | --- | --- |
| `encore_public_channels()` | 所有人 | 已上架的頻道（不含聯絡 email） |
| `encore_submit(...)` | 所有人 | 送出新舞台，狀態為「待審核」；限 https、同網址不重複、每小時上限 |
| `encore_admin_list/update/delete(p_key, ...)` | 持管理金鑰者 | 列出全部投稿、上架／隱藏、改台號、刪除 |

管理金鑰只存雜湊值（`encore_admin_keys`）。管理連結的格式是 `…/admin/#key=金鑰`，金鑰放在網址 `#` 後面，不會送到任何伺服器；
第一次開啟後會記在瀏覽器裡，換電腦時再開一次連結即可。後台右上角「更換金鑰」會產生新連結並讓舊連結立刻失效
（`encore_admin_rotate`），連結外流時用它。後台每張卡片的縮圖就是該台分享連結實際會顯示的圖，
並標示「分享圖已更新」或「等待重建」；「立即重建分享圖」連到 GitHub Actions 手動重建。也可以用 SQL 新增金鑰：

```sql
insert into public.encore_admin_keys (key_hash, label)
values (encode(extensions.digest('新的長金鑰', 'sha256'), 'hex'), '說明');
```

上架或改台號後電視會立刻更新。每台的分享頁（`/2027/index.html`）和分享圖在建置時產生：
後台設定好「自動重建」（一把只有 Actions: Read and write、只限這個 repo 的 GitHub fine-grained token，
存在 `encore_settings`，只有 Edge Function `encore-rebuild` 讀得到）後，上架或改台號會立刻觸發 GitHub Actions，
約 3～5 分鐘更新。另外每 10 分鐘的排程也會比對已上架頻道、有變動才重建，但 GitHub 排程常延遲，只當備援。
分享圖的來源依序是：
1. 內建舞台的手工圖（`public/og/stage-club.jpg`、`stage-troupe.jpg`，依舞台網址對應，改台號也不會錯）。
2. 用無頭 Chrome 直接開啟舞台網站截圖（不放在 iframe 裡，所以只允許 encore.taipei 嵌入的網站也拍得到），加上台號和「台北安可大舞台」標籤。
   截圖會沿用上一版，網址或名稱改了、或滿 7 天才重拍，紀錄在 `og/shots.json`。
3. 截圖打不開或幾乎是一片純色（錯誤頁、空白頁）時，改用舞台網站自己的 og:image → 投稿時存下的 og:image → 作者 GitHub repo 的預覽圖，一樣加上台號和標籤。
4. 都沒有就用文字卡。
本機建置預設不截圖，要測試可加 `ENCORE_OG_SHOTS=1`。
每一台拍分享圖時，也會另存一張 640×336 的頻道縮圖 `thumbs/<台號>.jpg`，給「頻道總覽」（`src/tv/components/ChannelOverview.tsx`）和 Duo 遙控器的縮圖列使用。縮圖優先用舞台網址自己的 og:image（YouTube 用影片封面），沒有或是一片空白時才用截圖。管理後台的頻道卡也是同樣順序：投稿時存下的 og:image、影片封面、舞台現在的 og:image，最後才是分享圖。

首頁的分享圖是 `public/og/home.jpg`（第 2026 台舞台全景）。README 裡的大舞台卡片 `docs/media/tv-card.jpg` 由 `scripts/og/tv-card.html` 用無頭 Chrome 截成 1200×630。

投稿表單貼上網址後，會透過 Supabase Edge Function `encore-meta`（`supabase/functions/encore-meta/`）
讀取該網站的標題和描述，自動帶入舞台名稱與說明。

Gemini、Google 等網站的分享頁不准被 iframe 嵌入。後台設定好「上傳 HTML」（Pinata JWT 和專屬閘道網域，存在 `encore_settings`）後，
投稿表單的網址欄可以拖進單一 `.html` 檔、按旁邊的「上傳 HTML」選檔，或直接貼上 HTML 程式碼。
Edge Function `encore-upload`（`supabase/functions/encore-upload/`）把它以 `stage/index.html` 釘到 IPFS，
回傳 `https://<閘道>/ipfs/<CID>/` 填進網址欄，送出後跟一般投稿一樣先在電視上預覽、再等審核。
每位訪客每小時 6 次、每天 20 次、全站每小時 120 次，單檔 5 MB（紀錄在 `encore_uploads`）；
一天內沒被任何投稿使用的檔案會在之後的上傳時順便從 Pinata 移除，後台刪除頻道時也會移除。
後台「儲存並測試」會上傳一個測試檔，確認閘道讀得到、以 text/html 提供、沒有擋 iframe 或頁面內的程式，再把它刪掉。
沒設定時投稿頁完全不顯示上傳功能。

### 給舞台作者：讓遙控器控制你的頁面（選用）

電視會用 `postMessage` 傳 `{ type: 'encore:volume', volume: 0–1, muted }` 給你的頁面，
按下 Duo 手機遙控器的彩色鍵時傳 `{ type: 'encore:color', color: 'red' | 'green' | 'yellow' | 'blue' }`；
你的頁面也可以把方向鍵傳回來：`parent.postMessage({ type: 'encore:key', key: 'ArrowRight' }, '*')`。

## 流量分析（Google Analytics 4）

評估 ID `G-7S3BJVE1W8` 設在部署設定（`main` 分支 `.github/workflows/deploy-pages.yml` 的 `VITE_GA_ID`），舞台、大舞台、大樓、上架頁共用；本機開發時完全不送資料。
大舞台每轉到一台記一次虛擬瀏覽（`/2027/` 這種路徑），嵌在電視裡的第 2026、2028 台只送事件、不重複算瀏覽。

| 事件 | 時機 |
| --- | --- |
| `tv_power_on`、`intro_complete` | 打開電視、新聞特輯播完 |
| `channel_view` | 轉到某一台（帶台號與名稱） |
| `remote_color_key`、`share` | 按彩色鍵、分享頻道 |
| `guide_open`、`agent_prompt_copy`、`submit_open`、`stage_submit` | 投稿流程 |
| `channel_info_open` | 打開頻道資訊 |
| `tv_power_off`、`finale_complete` | 關機彩蛋開始、穿過裂縫回到後室 |
| `club_enter`、`troupe_switch`、`music_mode`、`camera_view`、`sound_unlock` | 夜店頁互動（`embedded` 表示在電視裡） |
| `datasheet_open`、`making_of_open` | 政績資料、製作花絮 |
| `tower_takeoff`、`floor_enter`、`floor_switch`、`floor_exit` | 大樓：起飛、飛進樓層、搭電梯、飛出（樓層另記虛擬瀏覽 `/tower/2027/`） |
| `roof_visit`、`roof_chat_post`、`switch_to_tv` | 大樓：上頂樓、留言、切回電視模式 |



需要 Node.js 20 以上。

```bash
npm install
npm run dev        # http://localhost:4733（大舞台）、/club/、/admin/、/2027/、/tower/、/submit/
npm run build      # 產生 dist/（含每台的分享頁與預覽圖）
npm run preview
```

第 2026 台單獨開啟時，網址加上 `?autostart=1` 可略過進場畫面；`?view=close` 直接以特寫視角開啟。

## 部署

純靜態網站加 Supabase。建置用環境變數：

| 變數 | 用途 | 例子 |
| --- | --- | --- |
| `BASE_PATH` | 網站不在網域根目錄時的子路徑（Beta 預覽用） | `/beta/` |
| `SITE_URL` | 公開網址，用來產生分享預覽圖與 canonical 的絕對網址 | `https://encore.taipei/beta` |

`.github/workflows/deploy-pages.yml` 在推到 `main`、手動執行、管理員上架頻道，或每 10 分鐘偵測到頻道清單變動時：先建置 `main` 放在網站根目錄
（電視、各台 `/2027/`、`/club/`、`/tower/`、`/submit/`、`/admin/`），再把 Beta 分支（`cursor/encore-tv-0d54`）建置到 `/beta/`。
Beta 建置失敗不會影響正式站。兩個分支是同一份程式，Beta 測試順利後把同樣的內容同步到 `main` 即可。


## 素材與資料

- **新聞特輯照片**：Wikimedia Commons 的公共領域與創用 CC 授權影像，作者與授權逐張列在 `public/montage/credits.json`，片尾名單也會顯示。
- **新聞旁白**：Microsoft Edge 語音合成（zh-TW HsiaoChen），老年代片段加上收音機與雜訊效果（`public/montage/vo-*.mp3`）。
- **地球**：NASA「Blue Marble」日景、「Black Marble」夜景與全球雲圖（公有領域）。
- **星座臉孔**：用 MediaPipe Face Landmarker 取 478 個臉部特徵點，挑出約 100 顆星連線（`src/tv/finale/face.json`）；`scripts/build_face.py` 可從 `public/images/mayor-portrait.jpg` 重新產生。
- **第 2026 台資料**：`src/data/achievements.json`（四年施政成績，整理自 gov.taipei 新聞稿、中央社、聯合報、公視等，每條附 `source`）、
  `src/data/platform.json`（黃金十年政見）、`src/data/stage3d.json`（舞台喊話與 3D 招牌）。

修改任何中文字後，需重新產生字型子集：

```bash
pip install fonttools brotli skia-pathops
curl -L -o /tmp/NotoSansTC.ttf "https://github.com/google/fonts/raw/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf"
python3 scripts/build_font.py /tmp/NotoSansTC.ttf
```

字型為 Noto Sans TC（SIL Open Font License 1.1）。分享預覽圖用的 `scripts/assets/og-*.ttf` 只含 `scripts/channel-pages.ts` 裡用到的字。

## 技術

Vite（多頁：大舞台、第 2026 台、後台）· React 19 · TypeScript · three.js · @react-three/fiber · drei · postprocessing · zustand ·
Tailwind CSS v4 · shadcn/ui · Supabase · resvg

**iPhone Safari 底部工具列**：iOS 26 之後，Safari 的分頁列浮在畫面上，後面那塊會顯示網頁底色。滿版的 3D 畫面只畫到工具列上緣，
所以原本會露出一條黑邊。現在後室和大樓的 3D 畫面每秒會讀幾次最底下一排像素的平均顏色（`src/three/EdgeSampler.tsx`），
把網頁底色和 `theme-color` 設成同一個顏色（`src/lib/page-edge.ts`），工具列看起來就接著地毯或街景。
開機畫面疊了一層暗角，所以顏色會乘上實測的壓暗係數。這個做法只改顏色、不動排版：
- 只在觸控裝置上執行；
- 頁面在背景時暫停；
- 讀取失敗一次就永久停用；
- 數值會先檢查、再平滑，避免閃爍。

進到大舞台、片尾或樓層裡的舞台時，會恢復原本的黑色，像電視的黑框；`?duo` 時則是遙控器的深灰色。

```
src/
  tv/           大舞台：狀態、轉台、遙控器、OSD、上架表單
    scene/      後室、三代電視機、螢幕 shader、開場導演
    montage/    新聞特輯（2D canvas 逐格繪製）與旁白
    finale/     關機彩蛋：大安森林公園、火箭、地球、星座臉、片尾名單
  admin/        Steam 風格頻道管理
  scene/        第 2026 台：夜店、舞台、角色、3D 政見泡泡、群眾、城市
  three/        toon 材質與墨線、幾何快取、3D 字型
  audio/        節拍時鐘、Web Audio 合成器、YouTube 播放器
scripts/        字型子集、分享頁產生器、星座臉產生器
supabase/       資料表與函式
```

## 授權

程式碼以 [MIT 授權](LICENSE) 釋出；照片、字型、貼圖、旁白等第三方素材依各自授權使用，逐項列在 [CREDITS.md](CREDITS.md)。
人物姓名、肖像、〈台北安可〉歌曲與相關文宣標誌屬各自權利人。發現資安問題請看 [SECURITY.md](SECURITY.md)。
