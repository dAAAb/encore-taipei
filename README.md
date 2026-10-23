# 台北安可電視台 ENCORE.TAIPEI

空房間裡有一台電視。打開它，從十大建設、竹科、台積電一路看到公館圓環，鏡頭推進螢幕，轉到第 2026 台就是〈台北安可之夜〉；
再往下轉，每一台都是一位市民用 AI 做的台北安可舞台。轉到最後一台「訊號徵求中」，你也可以送出自己的舞台。

> 粉絲創作之互動藝術作品，非蔣萬安競選團隊官方網站。

| 網址 | 內容 |
| --- | --- |
| `/` | 電視台（後室、新聞特輯開場、轉台、片尾） |
| `/2026/`、`/2027/`… | 直接轉到某一台，每台有自己的分享預覽圖與標題 |
| `/club/` | 第 2026 台〈台北安可之夜〉單獨開啟 |
| `/admin/` | 頻道管理（需要管理連結） |
| `/tower/`、`/tower/2027/`… | 台北安可大樓：每台是一層樓，搭無人機逛；同一份頁面也發布在網站根目錄的 `encore.taipei/tower/` |
| `/submit/` | 上架申請頁：一般網頁，不載入 3D；送出後帶到電視台預覽。同一份頁面也發布在 `encore.taipei/submit/` |

目前 Beta 版部署在 [encore.taipei/beta/](http://encore.taipei/beta/)，正式站 `encore.taipei/` 仍是第 2026 台。

## 一次看完

1. **後室開場**：黃色壁紙的 Backrooms 走廊盡頭有一台老電視。點一下，電視「啪」一聲亮起，播出〈台北安可 新聞特輯〉：
   1974 十大建設、1980 新竹科學園區、1987 台積電、2012 美國免簽、2016 北門重見天日、2025 公館圓環拆除。
   鏡頭一路推近，燈光從閃爍變得明亮，電視從 70 年代木頭電視、90 年代映像管電視變成液晶電視，最後依照你的螢幕比例推進到滿版。
2. **轉台**：右下角漂浮的遙控器（像 GTA 的手機）可以轉台、調音量、靜音、輸入台號、看資訊、分享；
   鍵盤 ← → 轉台、+ − 音量、M 靜音、I 資訊、數字鍵直接選台。轉台有雜訊與音效，右上角短暫顯示台號，就像液晶電視。
   遙控器下方有紅綠黃藍彩色鍵，會傳給目前的頻道：在第 2026 台，綠色鍵換一批伴舞上台、紅色鍵讓市長獨舞。
3. **上架你的舞台**：最後一台是彩色條紋的「訊號徵求中」。按「一鍵交給你的 AI Agent」會複製一份完整 prompt
   （入門 prompt、遙控器程式碼、第 2026 台原始 prompt、部署與上架步驟），直接貼給 AI 助手；也可以按「怎麼做」看步驟。按「上架這一台」填網址，
   送出後這一台立刻換成你的舞台（只有你看得到），管理員審核通過才正式上架。
4. **關機彩蛋**：按遙控器電源鍵，鏡頭拉遠，電視其實站在大安森林公園露天音樂台上，噴出火焰飛上天，穿過雲層看見以台灣為中心的地球，
   飛進星空。星星連成蔣萬安的臉、眨眼、閃十字光，〈台北安可〉響起，片尾名單滾動。最後畫面中間裂開一道白線，點一下穿過去，回到後室，電視掉在地上。

### 伴舞與第 2028 台「台北安可大舞團」

右上角「叫伴舞上台」（或鍵盤 D、遙控器綠色鍵）會讓六位伴舞從舞台下跳上來，和市長跳同一套舞、踩同一個拍子。
每按一次換一批、換一個順序，依序輪替：可愛動物（橘貓、柴犬、臺灣黑熊、熊貓、梅花鹿、浣熊、石虎、兔兔）→
市民朋友（上班族、高中生、阿嬤、外送員、護理師、夜市主廚、阿伯、籃球少年）→ 大家一起。「獨舞」讓市長一個人跳。
網址加 `?troupe=animals`、`citizens` 或 `mix` 可以直接帶伴舞開場，每次進來的陣容和順序都不同。
第 2028 台就是 `club/?troupe=animals`：同一座夜店，標題換成「台北安可大舞團」。角色定義在 `src/scene/troupe-looks.ts`。

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

## 頻道與後台

投稿有三個入口：電視台「訊號徵求中」那一台、大樓「招租中」的樓層，以及獨立的上架頁 `encore.taipei/submit/`（`src/submit/`）。
三者共用同一份表單（`SubmitFields`）；送出後預覽存在瀏覽器（`encore.pending`），上架頁送出後會直接帶到電視台那一台。

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
分享圖的來源依序是：`public/og/<台號>.jpg` 手工圖 → 用無頭 Chrome 截下舞台畫面，加上台號和「台北安可電視台」標籤
（截圖會沿用上一版，網址或名稱改了、或滿 7 天才重拍，紀錄在 `og/shots.json`）→ 舞台網站自己的 og:image → 文字卡。
本機建置預設不截圖，要測試可加 `ENCORE_OG_SHOTS=1`。
電視台首頁的分享圖是 `public/og/tv.jpg`，由 `scripts/og/tv-card.html` 用無頭 Chrome 截成 1200×630。

投稿表單貼上網址後，會透過 Supabase Edge Function `encore-meta`（`supabase/functions/encore-meta/`）
讀取該網站的標題和描述，自動帶入舞台名稱與說明。

### 給舞台作者：讓遙控器控制你的頁面（選用）

電視會用 `postMessage` 傳 `{ type: 'encore:volume', volume: 0–1, muted }` 給你的頁面，
按下彩色鍵時傳 `{ type: 'encore:color', color: 'red' | 'green' | 'yellow' | 'blue' }`；
你的頁面也可以把方向鍵傳回來：`parent.postMessage({ type: 'encore:key', key: 'ArrowRight' }, '*')`。

## 流量分析（Google Analytics 4）

評估 ID `G-7S3BJVE1W8` 設在部署設定（`main` 分支 `.github/workflows/deploy-pages.yml` 的 `VITE_GA_ID`），舞台、電視台、大樓、上架頁共用；本機開發時完全不送資料。
電視台每轉到一台記一次虛擬瀏覽（`/2027/` 這種路徑），嵌在電視裡的第 2026、2028 台只送事件、不重複算瀏覽。

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
npm run dev        # http://localhost:4733（電視台）、/club/、/admin/、/2027/、/tower/、/submit/
npm run build      # 產生 dist/（含每台的分享頁與預覽圖）
npm run preview
```

第 2026 台單獨開啟時，網址加上 `?autostart=1` 可略過進場畫面；`?view=close` 直接以特寫視角開啟。

## 部署

純靜態網站加 Supabase。建置用環境變數：

| 變數 | 用途 | 例子 |
| --- | --- | --- |
| `BASE_PATH` | 網站不在網域根目錄時的子路徑 | `/beta/` |
| `SITE_URL` | 公開網址，用來產生分享預覽圖與 canonical 的絕對網址 | `https://encore.taipei/beta` |

`.github/workflows/deploy-pages.yml` 在推到 `main`、手動執行、管理員上架頻道，或每 10 分鐘偵測到頻道清單變動時：先建置 `main` 放在網站根目錄，
再把 Beta 分支（`cursor/encore-tv-0d54`）建置到 `/beta/`，並把其中的 `tower/`、`submit/` 複製一份到網站根目錄（`/tower/`、`/submit/`）。
Beta 建置失敗不會影響正式站。
Beta 測試順利後，把 Beta 分支合併進 `main`，電視台就會變成 `encore.taipei/`，各台網址變成 `encore.taipei/2027/`。


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

Vite（多頁：電視台、第 2026 台、後台）· React 19 · TypeScript · three.js · @react-three/fiber · drei · postprocessing · zustand ·
Tailwind CSS v4 · shadcn/ui · Supabase · resvg

```
src/
  tv/           電視台：狀態、轉台、遙控器、OSD、上架表單
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
