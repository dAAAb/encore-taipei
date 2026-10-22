# 台北安可之夜｜蔣萬安黃金十年政見 3D 互動派對

一個互動 3D 網站：2033 年，松山機場遷移後的台北 AI 園區裡，園區最高樓的未來夜店今晚全場爆滿。
場景向電玩《電馭叛客 2077》的傳奇酒吧「來生（Afterlife）」致敬。
蔣萬安在中央舞台跳著麥可傑克森式的旋轉、月球漫步、踮腳與反重力傾斜舞步；政見以 3D 立體字從畫面外飛進他的對話泡泡；
台下數百位背對鏡頭的群眾揮舞應援棒、尖叫，並喊出他們最有感的四年施政成績。

> 粉絲創作之互動藝術作品，非蔣萬安競選團隊官方網站。

## 畫面風格

- **Colorfigures 手繪等角風**（[april-zhu.com/colorfigures](https://april-zhu.com/colorfigures)）：三階平塗明暗（toon gradient map）、
  粗墨線輪廓（inverted hull，連 instanced 群眾都有）、扁平靛藍投影、暖色紙張卡片與紙紋顆粒。
- **Cyberpunk 2077「來生」夜店**：深紫夜色、腥紅霓虹招牌、青色雷射、體積光束、Bloom 光暈、掃描線與色差。
- **2033 台北 AI 園區**：落地玻璃外是 110 公頃中央公園、基隆河、XY 軸磁浮捷運、無人機車流、AI 園區塔樓與遠方的台北 101。

## 功能

| 功能 | 說明 |
| --- | --- |
| 舞台 | 蔣萬安 3D 角色（深藍西裝、淺藍領帶、MJ 白手套與白襪），40 拍一輪的舞步循環，跟著節拍跳 |
| 3D 政見泡泡 | 每隔不定時間，從 22 條「黃金十年」政見中挑一條，每個字都是擠出成型的 3D 字，從畫面外旋轉飛入、落定、再炸開飛走 |
| 群眾 | 約 450 位 instanced 人影，跳躍、揮手、應援棒、手機錄影；隨機冒出 HTML 對話泡泡喊出 35 項四年政績 |
| LED 大螢幕 | 輪播「台北安可」、蔣萬安肖像、「黃金十年」、「870 公頃」，說政見時顯示政策分類 |
| 背景音樂 | 以 YouTube 內嵌播放器播放蔣萬安頻道官方〈台北安可〉MV；無法載入時自動切換為網站內建的流行龐克節拍（Web Audio 即時合成，副歌會用語音合成喊「台北！安可！」） |
| 視角 | 正面／特寫／等角／環繞，可拖曳旋轉、滾輪縮放 |
| 政績資料 | 側欄列出所有政績與政見，每條附出處連結 |
| 製作花絮 | 政績資料側欄最下方的「Made with Cursor × Opus 5.5 × Colorfigures」彩蛋：原始 prompt、製作時間、token 用量與費用估算（`src/data/making-of.json`） |

## 本機執行

需要 Node.js 20 以上。

```bash
npm install
npm run dev        # http://localhost:4733
```

其他指令：

```bash
npm run build      # 產生 dist/
npm run preview    # 預覽 production build（同樣在 4733 埠）
```

網址加上 `?autostart=1` 可略過進場畫面（無聲，方便截圖）；`?view=close` 直接以特寫視角開啟。

## 部署

純靜態網站，`npm run build` 後把 `dist/` 放到任何靜態主機即可。兩個建置用環境變數：

| 變數 | 用途 | 例子 |
| --- | --- | --- |
| `BASE_PATH` | 網站不在網域根目錄時的子路徑 | `/taipei-encore/` |
| `SITE_URL` | 公開網址，用來產生分享預覽圖（og:image）與 canonical 的絕對網址 | `https://you.github.io/taipei-encore` |

**GitHub Pages**：repo 已附 `.github/workflows/deploy-pages.yml`，推到 `main` 就會自動建置部署到
`https://<帳號>.github.io/<repo 名稱>/`。第一次使用前，到 GitHub repo 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。

分享預覽圖是 `public/og.jpg`（1200×630）。

## 資料

- `src/data/achievements.json`：四年施政成績（群眾喊話），整理自 gov.taipei 新聞稿、中央社、聯合報、公視等，每條附 `source`。
- `src/data/platform.json`：黃金十年政見（舞台 3D 泡泡），來自競選文宣與 2026 年 8–10 月公開記者會；部分仍屬規劃階段，詳見各條 `detail`。
- `src/data/stage3d.json`：舞台喊話與 3D 招牌文字。

修改上述文字後，需重新產生字型子集（3D 字只收錄用到的字）：

```bash
pip install fonttools brotli skia-pathops
curl -L -o /tmp/NotoSansTC.ttf "https://github.com/google/fonts/raw/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf"
python3 scripts/build_font.py /tmp/NotoSansTC.ttf
```

會輸出 `public/fonts/noto-tc-black.typeface.json`（three.js 3D 字型）與兩個 UI 用 woff2。字型為 Noto Sans TC（SIL Open Font License 1.1）。

## 技術

Vite · React 19 · TypeScript · three.js · @react-three/fiber · drei · postprocessing · zustand · Tailwind CSS v4 · shadcn/ui

```
src/
  scene/        Club（夜店與吧台）、Stage（舞台、LED、光束、雷射）、Mayor（角色與舞步）、
                MayorSpeech（3D 政見泡泡）、Crowd（群眾與喊話）、City（2033 台北 AI 園區）
  three/        toon 材質與墨線、幾何快取、3D 字型與排版
  audio/        節拍時鐘、Web Audio 合成器、YouTube 播放器
  components/   進場畫面、HUD、政績資料側欄
```
