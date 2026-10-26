import { Loader2, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadFont } from '@/three/font3d'

export function StartGate({ onEnter, webgl }: { onEnter: () => void; webgl: boolean }) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([loadFont(), document.fonts.ready])
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(40,10,40,0.55),rgba(5,3,10,0.94)_70%)] p-4 backdrop-blur-[2px]">
      <div className="ink-card slide-up w-full max-w-lg p-6 sm:p-8">
        <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#0c0812] bg-[#ffd400] px-2.5 py-0.5 text-[11px] font-black tracking-[0.16em] text-[#0c0812]">
          <span className="live-dot" aria-hidden />
          LIVE · 2033 台北 AI 園區
        </p>
        <h1 className="mt-3 text-[42px] font-black leading-none tracking-[0.04em] sm:text-[54px]">
          台北安可<span className="text-[#c8234a]">之夜</span>
        </h1>
        <p className="mt-2 text-lg font-black text-[#1f4fd1]">蔣萬安 · 黃金十年 3D 互動派對</p>
        <p className="mt-4 text-[15px] leading-relaxed text-[#2a2f52]">
          2033 年，松山機場遷移後的台北 AI 園區。園區最高樓的未來夜店今晚全場爆滿，蔣萬安在中央舞台跳起麥可傑克森的旋轉舞步，
          黃金十年政見從四面八方飛進他的 3D 對話泡泡，台下群眾高喊感謝他四年來的施政。
        </p>
        <p className="mt-2 text-xs text-[#6a6f8e]">場景靈感來自電玩《電馭叛客 2077》裡的傳奇酒吧「來生」。</p>
        <ul className="mt-4 space-y-1 text-sm text-[#4a4f6e]">
          <li className="flex items-center gap-2">
            <Volume2 className="size-4 shrink-0" /> 建議開啟聲音：背景播放〈台北安可〉官方 MV
          </li>
          <li>拖曳可旋轉視角，滾輪或雙指可縮放</li>
        </ul>
        {!webgl ? (
          <p className="mt-6 rounded-xl border-2 border-[#0c0812] bg-[#ffd9d9] p-3 text-sm font-bold text-[#7a1020]">
            你的瀏覽器沒有啟用 WebGL，無法顯示 3D 場景。請改用最新版 Chrome、Edge、Safari 或 Firefox。
          </p>
        ) : (
          <button
            type="button"
            className="ink-btn mt-6 flex w-full items-center justify-center gap-2 px-6 py-3 text-xl disabled:opacity-60"
            data-on="true"
            disabled={!ready && !failed}
            onClick={onEnter}
          >
            {ready || failed ? (
              <>進場 ENTER</>
            ) : (
              <>
                <Loader2 className="size-5 animate-spin" /> 場景載入中…
              </>
            )}
          </button>
        )}
        {failed && <p className="mt-2 text-xs text-[#7a1020]">3D 字型載入失敗，仍可進場，但對話泡泡可能不會出現。</p>}
        <p className="mt-5 text-[11px] leading-snug text-[#6a6f8e]">
          粉絲創作之互動藝術作品，非蔣萬安競選團隊官方網站。施政成績引自臺北市政府與中央社等報導，可在場內「政績資料」查看出處。
        </p>
      </div>
    </div>
  )
}
