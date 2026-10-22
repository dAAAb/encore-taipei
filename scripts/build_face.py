#!/usr/bin/env python3
"""Turn MediaPipe face landmarks of public/images/mayor-portrait.jpg into the starry-sky constellation.

Usage: python3 scripts/build_face.py landmarks.json  (478 [x, y, z] points from FaceLandmarker)
Writes src/tv/finale/face.json: stars (x, y in roughly -1..1, y up), line segments, and the winking eye.
"""
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
W, H = 254, 460

OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
EYE_R = [33, 160, 158, 133, 153, 144]
EYE_L = [362, 385, 387, 263, 373, 380]
BROW_R = [70, 63, 105, 66, 107]
BROW_L = [336, 296, 334, 293, 300]
NOSE = [168, 6, 197, 195, 5, 4]
NOSTRIL = [98, 97, 2, 326, 327]
UPPER_LIP = [61, 37, 0, 267, 291]
LOWER_LIP = [61, 91, 84, 17, 314, 321, 291]
IRIS_R, IRIS_L = 468, 473


def main(src):
    lm = json.load(open(src))
    px = [(p[0] * W, p[1] * H) for p in lm]
    cx = sum(px[i][0] for i in OVAL) / len(OVAL)
    cy = sum(px[i][1] for i in OVAL) / len(OVAL)
    top = min(px[i][1] for i in OVAL)
    bottom = max(px[i][1] for i in OVAL)
    scale = (bottom - top) / 1.25

    stars, lines, index = [], [], {}

    def star(key, x, y, mag=1.0):
        if key not in index:
            index[key] = len(stars)
            stars.append([round((x - cx) / scale, 4), round(-(y - cy) / scale + 0.12, 4), mag])
        return index[key]

    def lm_star(i, mag=1.0):
        return star(('lm', i), *px[i], mag)

    def path(ids, closed=False, mag=1.0, group='face'):
        s = [lm_star(i, mag) for i in ids]
        for a, b in zip(s, s[1:] + ([s[0]] if closed else [])):
            lines.append([a, b, group])
        return s

    path(OVAL, closed=True, mag=0.9)
    path(BROW_R, mag=1.0)
    path(BROW_L, mag=1.0)
    eye_r = path(EYE_R, closed=True, mag=1.1, group='eyeR')
    eye_l = path(EYE_L, closed=True, mag=1.1, group='eyeL')
    pupil_r = lm_star(IRIS_R, 2.4)
    pupil_l = lm_star(IRIS_L, 2.4)
    path(NOSE, mag=0.9)
    path(NOSTRIL, mag=0.9)
    lines.append([index[('lm', 4)], index[('lm', 2)], 'face'])
    path(UPPER_LIP, mag=1.0)
    path(LOWER_LIP, mag=1.0)

    # Hair: the upper oval pushed outward and up, fuller on the side-swept left, with the parting line.
    upper = OVAL[-8:] + OVAL[:9]
    hair = []
    for k, i in enumerate(upper):
        x, y = px[i]
        dx, dy = x - cx, y - cy
        n = math.hypot(dx, dy) or 1
        lift = 0.2 + 0.16 * math.sin(math.pi * k / (len(upper) - 1))
        sweep = 0.06 if dx < 0 else 0.0
        hx = x + dx / n * scale * (0.1 + sweep)
        hy = y + dy / n * scale * 0.08 - scale * lift
        hair.append(star(('hair', k), hx, hy, 0.85))
    for a, b in zip(hair, hair[1:]):
        lines.append([a, b, 'hair'])
    lines.append([hair[0], index[('lm', upper[0])], 'hair'])
    lines.append([hair[-1], index[('lm', upper[-1])], 'hair'])
    lines.append([hair[4], index[('lm', 103)], 'hair'])

    # Shirt collar and tie knot under the chin.
    chin = px[152]
    jaw_r, jaw_l = px[172], px[397]
    neck_l = star(('col', 'nl'), jaw_r[0] + scale * 0.1, chin[1] + scale * 0.16, 0.7)
    neck_r = star(('col', 'nr'), jaw_l[0] - scale * 0.1, chin[1] + scale * 0.16, 0.7)
    knot = star(('col', 'k'), chin[0], chin[1] + scale * 0.34, 1.2)
    c_l = star(('col', 'l'), jaw_r[0] - scale * 0.02, chin[1] + scale * 0.42, 0.8)
    c_r = star(('col', 'r'), jaw_l[0] + scale * 0.02, chin[1] + scale * 0.42, 0.8)
    tie = star(('col', 't'), chin[0], chin[1] + scale * 0.66, 1.0)
    lines += [[neck_l, knot, 'body'], [neck_r, knot, 'body'], [neck_l, c_l, 'body'], [c_l, knot, 'body'], [neck_r, c_r, 'body'], [c_r, knot, 'body'], [knot, tie, 'body']]
    lines.append([neck_l, index[('lm', 172)], 'body'])
    lines.append([neck_r, index[('lm', 397)], 'body'])

    out = {
        'stars': stars,
        'lines': lines,
        'wink': {'eye': sorted(set(eye_l + [pupil_l])), 'center': stars[pupil_l][:2]},
        'pupils': [pupil_r, pupil_l],
        'source': 'MediaPipe FaceLandmarker on public/images/mayor-portrait.jpg',
    }
    target = ROOT / 'src' / 'tv' / 'finale' / 'face.json'
    target.write_text(json.dumps(out))
    print(f'{len(stars)} stars, {len(lines)} lines -> {target.relative_to(ROOT)}')


if __name__ == '__main__':
    main(sys.argv[1])
