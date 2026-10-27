#!/usr/bin/env python3
"""Turn public/images/mayor-portrait.jpg into the starry-sky constellation for the finale.

Usage: python3 scripts/build_face.py landmarks.json
  landmarks.json: the 478 [x, y, z] points from MediaPipe FaceLandmarker for the portrait.
Requires: pip install opencv-python numpy

The landmarks give eyes, irises, brows, nose, lips and a faint triangle mesh; the photo's dark pixels
give the hairline. The portrait crops the top of the head and one shoulder, so the outer hair, ears,
shoulders, collar and tie are drawn from the landmarks to keep the figure whole and symmetric.
Writes src/tv/finale/face.json with stars [x, y, magnitude] (y up), lines [a, b, group] and the winking eye.
"""
import json
import pathlib
import sys

import cv2
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / 'public' / 'images' / 'mayor-portrait.jpg'

OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
IRIS_R = [469, 470, 471, 472]
IRIS_L = [474, 475, 476, 477]
BROWS = [[70, 63, 105, 66, 107], [46, 53, 52, 65, 55], [300, 293, 334, 296, 336], [276, 283, 282, 295, 285]]
NOSE = [[168, 6, 197, 195, 5, 4], [115, 48, 64, 98, 97, 2, 326, 327, 294, 278, 344], [4, 45, 220, 115], [4, 275, 440, 344]]
LIPS_OUT = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LIPS_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]


class Sky:
    def __init__(self, scale_px):
        self.stars = []
        self.lines = []
        self.merge = 2.2 * scale_px / 100

    def star(self, x, y, mag):
        for i, (sx, sy, sm) in enumerate(self.stars):
            if abs(sx - x) < self.merge and abs(sy - y) < self.merge:
                self.stars[i][2] = max(sm, mag)
                return i
        self.stars.append([x, y, mag])
        return len(self.stars) - 1

    def path(self, pts, group, mag, closed=False):
        ids = [self.star(x, y, mag) for x, y in pts]
        pairs = list(zip(ids, ids[1:] + ([ids[0]] if closed else [])))
        for a, b in pairs:
            if a != b:
                self.lines.append([a, b, group])
        return ids


def resample(pts, n):
    """n points evenly spaced (by index) along a polyline."""
    pts = np.array(pts, dtype=float)
    t = np.linspace(0, 1, len(pts))
    u = np.linspace(0, 1, n)
    return list(zip(np.interp(u, t, pts[:, 0]), np.interp(u, t, pts[:, 1])))


def main(src):
    lm = np.array(json.load(open(src)))
    img = cv2.imread(str(IMG))
    h, w = img.shape[:2]
    px = lm[:, :2] * [w, h]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(float)
    sat, val = hsv[..., 1] / 255, hsv[..., 2] / 255

    oval = px[OVAL]
    cx, cy = oval.mean(axis=0)
    face_h = oval[:, 1].max() - oval[:, 1].min()
    sky = Sky(face_h)

    # Hairline from the photo: the lowest hair pixel above the brows in each column.
    brow_y = px[[105, 334], 1].mean()
    hair = ((val < 0.22) & (sat < 0.9)).astype(np.uint8)
    hair = cv2.morphologyEx(hair, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    left, right = px[234, 0], px[454, 0]
    hairline = []
    for x in np.linspace(left + face_h * 0.04, right - face_h * 0.02, 15):
        col = hair[: int(brow_y - face_h * 0.04), int(np.clip(x, 0, w - 1))]
        ys = np.nonzero(col)[0]
        if len(ys):
            hairline.append((float(x), float(ys.max())))
    # The portrait crops the top of the head, so the outer hair is drawn from the upper face oval,
    # fuller on top and swept to one side.
    upper = OVAL[-9:] + OVAL[:10]
    outer = []
    for k, i in enumerate(upper):
        x, y = px[i]
        dx, dy = x - cx, y - cy
        n = np.hypot(dx, dy) or 1
        u = k / (len(upper) - 1)
        lift = face_h * (0.1 + 0.2 * np.sin(np.pi * u) + 0.06 * (1 - u))
        push = face_h * (0.08 + 0.05 * (1 - u))
        outer.append((x + dx / n * push, y + dy / n * push * 0.6 - lift))
    sky.path(outer, 'hair', 0.85)
    if hairline:
        sky.path(hairline, 'hair', 0.8)
        sky.path([outer[0], hairline[0]], 'hair', 0.8)
        sky.path([hairline[-1], outer[-1]], 'hair', 0.8)
        a, b = resample(hairline, 9), resample(outer, 9)
        for f in (0.32, 0.62):
            strand = [(ha[0] + (oa[0] - ha[0]) * f + face_h * 0.03 * np.sin(np.pi * j / 8), ha[1] + (oa[1] - ha[1]) * f) for j, (ha, oa) in enumerate(zip(a, b))]
            sky.path(strand[1:-1], 'hair', 0.6)

    # Ears.
    for top, mid, low, side in ((127, 234, 132, -1), (356, 454, 361, 1)):
        t, m, l = px[top], px[mid], px[low]
        ear = [t, (m[0] + side * face_h * 0.07, m[1] - face_h * 0.06), (m[0] + side * face_h * 0.075, m[1] + face_h * 0.06), l]
        sky.path([tuple(p) for p in ear], 'outline', 0.75)

    # Neck, shoulders, collar and tie.
    chin = px[152]
    jaw_l, jaw_r = px[172], px[397]
    half_w = (right - left) / 2
    neck_l = (jaw_l[0] + face_h * 0.05, chin[1] + face_h * 0.2)
    neck_r = (jaw_r[0] - face_h * 0.05, chin[1] + face_h * 0.2)
    sh_l = (cx - half_w * 2.3, chin[1] + face_h * 0.62)
    sh_r = (cx + half_w * 2.3, chin[1] + face_h * 0.62)
    knot = (chin[0], chin[1] + face_h * 0.34)
    col_l = (jaw_l[0] - face_h * 0.04, chin[1] + face_h * 0.4)
    col_r = (jaw_r[0] + face_h * 0.04, chin[1] + face_h * 0.4)
    tie = (chin[0], chin[1] + face_h * 0.78)
    sky.path([tuple(jaw_l), neck_l, (cx - half_w * 1.25, chin[1] + face_h * 0.36), sh_l], 'outline', 0.8)
    sky.path([tuple(jaw_r), neck_r, (cx + half_w * 1.25, chin[1] + face_h * 0.36), sh_r], 'outline', 0.8)
    sky.path([neck_l, knot, neck_r], 'outline', 0.8)
    sky.path([neck_l, col_l, knot, col_r, neck_r], 'outline', 0.85)
    sky.path([knot, (chin[0] - face_h * 0.05, chin[1] + face_h * 0.6), tie, (chin[0] + face_h * 0.05, chin[1] + face_h * 0.6), knot], 'outline', 0.9)
    sky.path([col_l, (cx - half_w * 0.9, chin[1] + face_h * 0.8)], 'outline', 0.7)
    sky.path([col_r, (cx + half_w * 0.9, chin[1] + face_h * 0.8)], 'outline', 0.7)

    sky.path(px[OVAL], 'feature', 0.9, closed=True)
    for brow in BROWS:
        sky.path(px[brow], 'feature', 1.0)
    eye_r = sky.path(px[EYE_R], 'eyeR', 1.0, closed=True)
    eye_l = sky.path(px[EYE_L], 'eyeL', 1.0, closed=True)
    iris_r = sky.path(px[IRIS_R], 'eyeR', 1.1, closed=True)
    iris_l = sky.path(px[IRIS_L], 'eyeL', 1.1, closed=True)
    pupil_r = sky.star(*px[468], 2.4)
    pupil_l = sky.star(*px[473], 2.4)
    for part in NOSE:
        sky.path(px[part], 'feature', 0.9)
    sky.path(px[LIPS_OUT], 'feature', 1.0, closed=True)
    sky.path(px[LIPS_IN], 'feature', 0.8, closed=True)

    # Faint mesh: farthest-point sample the landmarks, Delaunay inside the face oval.
    chosen = [int(np.argmin(px[:468, 1]))]
    dist = np.linalg.norm(px[:468] - px[chosen[0]], axis=1)
    while len(chosen) < 150:
        nxt = int(np.argmax(dist))
        chosen.append(nxt)
        dist = np.minimum(dist, np.linalg.norm(px[:468] - px[nxt], axis=1))
    subdiv = cv2.Subdiv2D((-w, -h, 3 * w, 3 * h))
    for i in chosen:
        subdiv.insert((float(px[i, 0]), float(px[i, 1])))
    hull = px[OVAL].astype(np.float32).reshape(-1, 1, 2)
    edges_seen = set()
    for x1, y1, x2, y2, x3, y3 in subdiv.getTriangleList():
        tri = [(x1, y1), (x2, y2), (x3, y3)]
        if any(cv2.pointPolygonTest(hull, (float(x), float(y)), False) < 0 for x, y in tri):
            continue
        for (ax, ay), (bx, by) in [(tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])]:
            if np.hypot(ax - bx, ay - by) > face_h * 0.16:
                continue
            a = sky.star(ax, ay, 0.45)
            b = sky.star(bx, by, 0.45)
            key = (min(a, b), max(a, b))
            if a != b and key not in edges_seen:
                edges_seen.add(key)
                sky.lines.append([a, b, 'mesh'])

    scale = face_h / 1.25
    stars = [[round((x - cx) / scale, 4), round(-(y - cy) / scale + 0.12, 4), round(m, 2)] for x, y, m in sky.stars]
    xs = [s[0] for s in stars]
    ys = [s[1] for s in stars]
    eye = sorted(set(eye_l + iris_l + [pupil_l]))
    out = {
        'stars': stars,
        'lines': sky.lines,
        'wink': {'eye': eye, 'center': stars[pupil_l][:2]},
        'pupils': [pupil_r, pupil_l],
        'bounds': [min(xs), max(xs), min(ys), max(ys)],
        'source': 'MediaPipe FaceLandmarker + backdrop segmentation of public/images/mayor-portrait.jpg',
    }
    target = ROOT / 'src' / 'tv' / 'finale' / 'face.json'
    target.write_text(json.dumps(out, separators=(',', ':')))
    groups = {}
    for _, _, g in sky.lines:
        groups[g] = groups.get(g, 0) + 1
    print(f'{len(stars)} stars, {len(sky.lines)} lines {groups} -> {target.relative_to(ROOT)}')


if __name__ == '__main__':
    main(sys.argv[1])
