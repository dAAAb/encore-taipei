/** The newsreel on the old TV. Each segment is one milestone; `era` drives both the picture look and the TV model. */
export type Era = 'film' | 'crt' | 'hd'

export interface Segment {
  id: string
  era: Era
  year: string
  headline: string
  sub: string
  narration: string
  /** Files under public/montage/, cut between in order. */
  images: string[]
  /** Fallback tint when an image is missing. */
  tint: [string, string]
}

export const SEGMENTS: Segment[] = [
  {
    id: 'ten',
    era: 'film',
    year: '1974',
    headline: '十大建設全面動工',
    sub: '中山高速公路・桃園國際機場・台中港',
    narration: '一九七四年，十大建設全面動工。高速公路、國際機場、港口，一項一項蓋起來。',
    images: [],
    tint: ['#6b6b6b', '#1b1b1b'],
  },
  {
    id: 'hsp',
    era: 'film',
    year: '1980',
    headline: '新竹科學園區成立',
    sub: '孫運璿・李國鼎 推動科技島',
    narration: '一九八〇年，新竹科學園區成立。孫運璿、李國鼎，把台灣推向科技島。',
    images: [],
    tint: ['#7a6b55', '#201a12'],
  },
  {
    id: 'tsmc',
    era: 'crt',
    year: '1987',
    headline: '台積電成立',
    sub: '護國神山 從這裡開始',
    narration: '一九八七年，台積電成立。護國神山，從這裡開始。',
    images: [],
    tint: ['#3d6f9c', '#0d1c2b'],
  },
  {
    id: 'visa',
    era: 'crt',
    year: '2012',
    headline: '台灣護照 免簽走天下',
    sub: '馬英九任內 美國宣布台灣加入免簽計畫',
    narration: '二〇一二年，美國宣布台灣加入免簽證計畫。台灣護照，走遍世界。',
    images: [],
    tint: ['#2f6a4a', '#0c1d14'],
  },
  {
    id: 'gate',
    era: 'hd',
    year: '2016',
    headline: '西區門戶計畫 北門重見天日',
    sub: '柯文哲任內 拆除忠孝橋引道',
    narration: '二〇一六年，西區門戶計畫拆除忠孝橋引道，北門重見天日。',
    images: [],
    tint: ['#8a5a3a', '#24150c'],
  },
  {
    id: 'gongguan',
    era: 'hd',
    year: '2024',
    headline: '公館圓環 拆除打通',
    sub: '蔣萬安任內 改為平面路口',
    narration: '二〇二四年，公館圓環拆除，改成平面路口，交通打通了。',
    images: [],
    tint: ['#2b5fae', '#0b1630'],
  },
]

export const FINALE_LINE = '下一個十年，台北，安可！'
