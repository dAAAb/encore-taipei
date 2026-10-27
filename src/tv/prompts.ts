import making from '@/data/making-of.json'
import { SUBMIT_PATH } from './routing'

export const STARTER_PROMPT = `幫我做一個 3D 互動網站：我的「台北安可」舞台。

- 主題：〈台北安可〉是蔣萬安 2026 連任競選主題曲，請做一座屬於我的台北安可舞台。
- 畫風：（寫下你想要的風格，例如 Colorfigures 卡通 3D、賽博龐克、像素風、水彩、黏土動畫…）
- 地點：（舞台在哪？例如 2033 年的台北 AI 園區、大稻埕碼頭、101 頂樓、捷運車廂、夜市…）
- 台上：（誰在表演？做什麼動作？）
- 台下：（觀眾在做什麼？喊什麼？）
- 內容：上 gov.taipei 查蔣萬安四年施政成績和「黃金十年」政見，做成畫面裡的文字或互動，每一條附上資料來源。
- 音樂：嵌入 YouTube 上的〈台北安可〉官方 MV（影片 ID uKCiYJdv6Zg）當背景音樂。
- 要求：手機和電腦都能玩；可以被別的網站用 iframe 嵌入；最後幫我部署成公開的 https 網址。
- 規範：內容友善正向，不攻擊、不抹黑任何人或政黨；照片、音樂、字型只用自己做的、公有領域或有授權的素材，並標示來源；頁面上註明「粉絲創作，非官方網站」。`

export const PROTOCOL = `// 選用：讓台北安可大舞台的遙控器控制你的舞台
window.addEventListener('message', (e) => {
  if (e.data?.type === 'encore:volume') {
    // e.data.volume：0～1，e.data.muted：true / false
  }
  if (e.data?.type === 'encore:color') {
    // Duo 遙控器的彩色鍵：e.data.color 是 'red'、'green'、'yellow' 或 'blue'
  }
})
// 讓觀眾在你的舞台裡也能用 ← → 轉台
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight'].includes(e.key) && parent !== window) {
    parent.postMessage({ type: 'encore:key', key: e.key }, '*')
  }
})`

/** Everything an AI agent needs in one paste: the brief, the optional remote hooks, a worked example, and how to list it. */
export function agentPrompt() {
  const site = `${location.origin}${import.meta.env.BASE_URL}`
  const submit = `${location.origin}${SUBMIT_PATH}`
  return `你是我的 AI 寫程式助手。請帶我做一座「台北安可」3D 舞台網站，做好後我要把它上架到「台北安可大舞台」（${site}）的一個頻道。
括號裡的部分請先問我想要什麼；我沒意見的話，就由你決定一個好看的版本。

## 一、舞台內容

${STARTER_PROMPT}

## 二、選用：讓電視遙控器控制舞台

你的網站會被台北安可大舞台用 iframe 嵌入。加上下面這段，遙控器的音量就能控制舞台，Duo 手機遙控器的紅綠黃藍彩色鍵也會傳給你（例如綠色鍵換一批表演者），觀眾在舞台裡按 ← → 也能轉台：

\`\`\`js
${PROTOCOL}
\`\`\`

## 三、參考範例：第 2026 台「台北安可之夜」的原始 prompt

${making.prompt}

（${making.attachments}）

## 四、完成後

1. 部署成公開的 https 網址（GitHub Pages、Vercel、Cloudflare Pages 或 Netlify 都有免費方案）。不要用 X-Frame-Options 或 CSP frame-ancestors 擋住 iframe 嵌入。
2. 給我網址，並幫我寫一段 80 字內的作品介紹和製作工具清單。
3. 告訴我：打開上架頁 ${submit} 貼上網址（或在大舞台轉到「訊號徵求中」那一台按「上架這一台」），送出後馬上就能在大舞台預覽；審核通過後正式上架。`
}
