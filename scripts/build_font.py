#!/usr/bin/env python3
"""Subset Noto Sans TC for this site.

Outputs
  public/fonts/noto-tc-black.typeface.json  three.js typeface for the extruded 3D speech text
  public/fonts/noto-tc-900.woff2            UI display weight
  public/fonts/noto-tc-500.woff2            UI body weight

Usage: python3 scripts/build_font.py /path/to/NotoSansTC[wght].ttf
Requires: pip install fonttools brotli skia-pathops
"""
import json
import pathlib
import sys

from fontTools.pens.basePen import BasePen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
ASCII = "".join(chr(c) for c in range(32, 127))


def chars_3d() -> str:
    data = ROOT / "src" / "data"
    platform = json.loads((data / "platform.json").read_text("utf-8"))
    stage = json.loads((data / "stage3d.json").read_text("utf-8"))
    text = "".join(p["short"] for p in platform)
    text += "".join(stage["hype"]) + "".join(stage["signage"])
    return "".join(sorted(set(text + ASCII)))


def chars_ui() -> str:
    seen = set(ASCII)
    files = [ROOT / "index.html", ROOT / "club" / "index.html", ROOT / "admin" / "index.html", *(ROOT / "src").rglob("*")]
    for f in files:
        if f.is_file() and f.suffix in {".ts", ".tsx", ".json", ".html", ".css"}:
            seen.update(f.read_text("utf-8"))
    return "".join(sorted(c for c in seen if c.isprintable()))


def static_instance(src: str, wght: int) -> TTFont:
    font = TTFont(src)
    return instancer.instantiateVariableFont(
        font, {"wght": wght}, overlap=instancer.OverlapMode.REMOVE
    )


def write_woff2(src: str, wght: int, text: str, name: str) -> None:
    font = static_instance(src, wght)
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    sub = Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(OUT / name)
    print(f"{name}: {(OUT / name).stat().st_size // 1024} KB, {len(text)} chars")


class TypefacePen(BasePen):
    def __init__(self, glyphset):
        super().__init__(glyphset)
        self.cmds: list[str] = []

    @staticmethod
    def _n(v: float) -> str:
        return str(round(v))

    def _moveTo(self, p):
        self.cmds += ["m", self._n(p[0]), self._n(p[1])]

    def _lineTo(self, p):
        self.cmds += ["l", self._n(p[0]), self._n(p[1])]

    def _qCurveToOne(self, c, p):
        self.cmds += ["q", self._n(p[0]), self._n(p[1]), self._n(c[0]), self._n(c[1])]

    def _curveToOne(self, c1, c2, p):
        self.cmds += [
            "b", self._n(p[0]), self._n(p[1]),
            self._n(c1[0]), self._n(c1[1]), self._n(c2[0]), self._n(c2[1]),
        ]

    def _closePath(self):
        pass


def write_typeface(src: str, text: str, name: str) -> None:
    font = static_instance(src, 900)
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    glyphs = {}
    x_min = y_min = 10**9
    x_max = y_max = -(10**9)
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            print("missing glyph:", repr(ch))
            continue
        pen = TypefacePen(gs)
        gs[gname].draw(pen)
        nums = [int(v) for v in pen.cmds if v.lstrip("-").isdigit()]
        xs, ys = nums[0::2], nums[1::2]
        if xs:
            x_min, x_max = min(x_min, *xs), max(x_max, *xs)
            y_min, y_max = min(y_min, *ys), max(y_max, *ys)
        glyphs[ch] = {
            "ha": hmtx[gname][0],
            "x_min": min(xs) if xs else 0,
            "x_max": max(xs) if xs else 0,
            "o": " ".join(pen.cmds),
        }
    head = font["head"]
    post = font["post"]
    hhea = font["hhea"]
    data = {
        "glyphs": glyphs,
        "familyName": "Noto Sans TC Black (subset)",
        "ascender": hhea.ascent,
        "descender": hhea.descent,
        "underlinePosition": post.underlinePosition,
        "underlineThickness": post.underlineThickness,
        "boundingBox": {"xMin": x_min, "yMin": y_min, "xMax": x_max, "yMax": y_max},
        "resolution": head.unitsPerEm,
        "original_font_information": {"license": "SIL Open Font License 1.1"},
        "cssFontWeight": "900",
        "cssFontStyle": "normal",
    }
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"{name}: {(OUT / name).stat().st_size // 1024} KB, {len(glyphs)} glyphs")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    OUT.mkdir(parents=True, exist_ok=True)
    write_typeface(src, chars_3d(), "noto-tc-black.typeface.json")
    ui = chars_ui()
    write_woff2(src, 900, ui, "noto-tc-900.woff2")
    write_woff2(src, 500, ui, "noto-tc-500.woff2")


if __name__ == "__main__":
    main()
