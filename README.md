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

## 頻道與後台

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
GitHub Actions 每 10 分鐘比對一次已上架頻道，有變動才重建，所以新頻道通常 10～20 分鐘內就有分享圖。
分享圖的來源依序是：`public/og/<台號>.jpg` 手工圖 → 用無頭 Chrome 截下舞台畫面，加上台號和「台北安可電視台」標籤
（截圖會沿用上一版，網址或名稱改了、或滿 7 天才重拍，紀錄在 `og/shots.json`）→ 舞台網站自己的 og:image → 文字卡。
本機建置預設不截圖，要測試可加 `ENCORE_OG_SHOTS=1`。

投稿表單貼上網址後，會透過 Supabase Edge Function `encore-meta`（`supabase/functions/encore-meta/`）
讀取該網站的標題和描述，自動帶入舞台名稱與說明。

### 給舞台作者：讓遙控器控制你的頁面（選用）

電視會用 `postMessage` 傳 `{ type: 'encore:volume', volume: 0–1, muted }` 給你的頁面，
按下彩色鍵時傳 `{ type: 'encore:color', color: 'red' | 'green' | 'yellow' | 'blue' }`；
你的頁面也可以把方向鍵傳回來：`parent.postMessage({ type: 'encore:key', key: 'ArrowRight' }, '*')`。

## 本機執行

需要 Node.js 20 以上。

```bash
npm install
npm run dev        # http://localhost:4733（電視台）、/club/、/admin/、/2027/
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

`.github/workflows/deploy-pages.yml` 在推到 `main`、手動執行或每小時整點過 17 分時：先建置 `main` 放在網站根目錄，
再把 Beta 分支（`cursor/encore-tv-0d54`）建置到 `/beta/`。Beta 建置失敗不會影響正式站。
Beta 測試順利後，把 Beta 分支合併進 `main`，電視台就會變成 `encore.taipei/`，各台網址變成 `encore.taipei/2027/`。

GitHub Pages 與 encore.taipei 的第一次設定：

1. GitHub repo 的 **Settings → Pages**：**Source** 選 **GitHub Actions**；**Custom domain** 填 `encore.taipei` 按 Save。
   請勿選 **Deploy from a branch → main / (root)**：這是 Vite 專案，原始碼根目錄不是可直接發布的成品。
2. Gandi 的 **Domain → encore.taipei → DNS Records**：刪掉預設的 `@ A 217.70.184.38` 與 `www CNAME webredir.vip.gandi.net.`，改成：

   | 名稱 | 類型 | 值 |
   | --- | --- | --- |
   | `@` | A | `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`（四筆） |
   | `@` | AAAA | `2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153`（四筆） |
   | `www` | CNAME | `daaab.github.io.` |

   MX、TXT 等郵件相關紀錄不用動。
3. DNS 生效、GitHub 憑證核發後（通常幾分鐘到一小時），回到 Settings → Pages 勾選 **Enforce HTTPS**。
4. 到 **Actions → Deploy to GitHub Pages → Run workflow** 重新部署一次。之後每次新增、變更或移除 Custom domain，
   也要重新執行 workflow，讓建置使用更新後的網址與資源路徑。

## 素材與資料

- **新聞特輯照片**：Wikimedia Commons 的公共領域與創用 CC 授權影像，作者與授權逐張列在 `public/montage/credits.json`，片尾名單也會顯示。
- **新聞旁白**：Microsoft Edge 語音合成（zh-TW HsiaoChen），老年代片段加上收音機與雜訊效果（`public/montage/vo-*.mp3`）。
- **地球夜景**：NASA Earth Observatory「Black Marble」（公共領域）。
- **星座臉孔**：`scripts/build_face.py` 用 MediaPipe Face Landmarker 從 `public/images/mayor-portrait.jpg` 取 478 個臉部特徵點，挑出約 100 顆星連線。
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
