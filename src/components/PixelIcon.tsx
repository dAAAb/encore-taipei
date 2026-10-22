const ICONS = {
  cursor: {
    palette: { X: '#0c0812', W: '#ffffff' },
    rows: ['X........', 'XX.......', 'XWX......', 'XWWX.....', 'XWWWX....', 'XWWWWX...', 'XWWWWWX..', 'XWWWXXXX.', 'XWXWX....', 'XX.XWX...', '....XX...'],
  },
  claude: {
    palette: { O: '#d97757' },
    rows: ['....O....', '.O..O..O.', '..O.O.O..', '...OOO...', 'OOOOOOOOO', '...OOO...', '..O.O.O..', '.O..O..O.', '....O....'],
  },
  figure: {
    palette: { X: '#0c0812', B: '#1f6bff', W: '#ffffff', Y: '#ffd400' },
    rows: ['..XXXX..', '.XBBBBX.', '.XBWBWX.', '.XBBBBX.', '..XXXX..', '.XYYYYX.', 'XYYYYYYX', '.XYYYYX.', '..X..X..'],
  },
} as const

export type PixelIconName = keyof typeof ICONS

/** Tiny pixel-art glyphs drawn as crisp SVG rects. */
export function PixelIcon({ name, size = 12 }: { name: PixelIconName; size?: number }) {
  const { palette, rows } = ICONS[name]
  const w = rows[0].length
  const h = rows.length
  return (
    <svg width={(size * w) / h} height={size} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden className="inline-block shrink-0">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => {
          const fill = (palette as Record<string, string>)[c]
          return fill ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} /> : null
        }),
      )}
    </svg>
  )
}
