"""Exhibit B's frozen frame today vs with Coracle: the numbers, the 8x before/after crop and the full-frame diff.
Usage (from in-b/): python3 work/compare.py [today.png] [new.png]
Writes before-after-8x.png and diff.png in in-b/, and prints the counts as JSON (also in node/compare.json)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
INB = os.path.dirname(HERE)
REF = os.path.join(INB, '../../../ref/cross-section.png')
FONT = os.path.join(INB, '../../../kit/plex-mono.ttf')
a_path = sys.argv[1] if len(sys.argv) > 1 else REF
b_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(INB, 'plate-coracle.png')
spec = json.load(open(os.path.join(INB, '../spec.json')))


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(int)


A2, B2 = load(a_path), load(b_path)
assert A2.shape == B2.shape == (648, 1152, 3), (A2.shape, B2.shape)
# Both are 2x: check the blocks, then take one pixel per grain.
for M in (A2, B2):
    s = M[0::2, 0::2]
    assert all((M[dy::2, dx::2] == s).all() for dy in (0, 1) for dx in (0, 1))
A, B = A2[0::2, 0::2], B2[0::2, 0::2]
dpx = (A2 != B2).any(2)
d = (A != B).any(2)
ys, xs = np.nonzero(d)
pys, pxs = np.nonzero(dpx)
res = {
    'grains_differ': int(d.sum()), 'pixels_differ_at_2x': int(dpx.sum()),
    'grain_bbox': [int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())],
    'pixel_bbox_at_2x': [int(pxs.min()), int(pxs.max()), int(pys.min()), int(pys.max())],
}
# Coracle's own cells at rest (x 422-430, y 91-99) and what is left: grains today's creature and sprout gave back.
X0, Y0 = 422, 91
spr = np.zeros(d.shape, bool)
for r, row in enumerate(spec['b10']):
    for q, ch in enumerate(row):
        if ch != '.':
            spr[Y0 + r, X0 + q] = True
assert all(B[Y0 + r, X0 + q].tolist() == [int(spec['palette'][ch][i:i + 2], 16) for i in (1, 3, 5)]
           for r, row in enumerate(spec['b10']) for q, ch in enumerate(row) if ch != '.'), 'Coracle not drawn as b10'
res['coracle_cells'] = int(spr.sum())
res['differ_on_coracle_cells'] = int((d & spr).sum())
res['differ_elsewhere'] = int((d & ~spr).sum())
# The creature's box: the union of today's creature + sprout (x 419-431, y 93-101) and Coracle (x 422-430, y 90-99, the
# bob included).
BOX = (419, 431, 90, 101)
inbox = np.zeros(d.shape, bool)
inbox[BOX[2]:BOX[3] + 1, BOX[0]:BOX[1] + 1] = True
res['creature_box'] = list(BOX)
res['differ_outside_creature_box'] = int((d & ~inbox).sum())
print(json.dumps(res))
json.dump(res, open(os.path.join(INB, 'node/compare.json'), 'w'), indent=1)

font = ImageFont.truetype(FONT, 15)
small = ImageFont.truetype(FONT, 13)
BG, TXT, DIM, AMB = (16, 13, 11), (232, 222, 209), (150, 134, 118), (245, 190, 110)

# 1. before/after, 8x around the cabbage bed.
cx0, cx1, cy0, cy1 = 396, 451, 80, 109  # grains, inclusive
S = 8
cw, ch = (cx1 - cx0 + 1) * S, (cy1 - cy0 + 1) * S
pad, head, gap = 16, 34, 16
img = Image.new('RGB', (pad * 2 + cw * 2 + gap, head + ch + pad + 26), BG)
dr = ImageDraw.Draw(img)
for k, (M, title) in enumerate([(A, "today's frozen frame"), (B, 'with Coracle (b10, rest pose)')]):
    crop = Image.fromarray(M[cy0:cy1 + 1, cx0:cx1 + 1].astype(np.uint8)).resize((cw, ch), Image.NEAREST)
    x = pad + k * (cw + gap)
    img.paste(crop, (x, head))
    dr.text((x, 9), title, font=font, fill=TXT)
note = 'Exhibit B, 1440 x 900, dpr 1: grains x %d-%d, y %d-%d, 8 px a grain. Cabbage bed top: row 102.' % (cx0, cx1, cy0, cy1)
dr.text((pad, head + ch + 7), note, font=small, fill=DIM)
img.save(os.path.join(INB, 'before-after-8x.png'), optimize=True)

# 2. the full frame, differing grains marked, the rest dimmed, at 2x.
D = (B * 0.3).astype(np.uint8)
D[d] = [255, 0, 255]
im = Image.fromarray(D).resize((1152, 648), Image.NEAREST)
dr = ImageDraw.Draw(im)
x0, x1, y0, y1 = res['grain_bbox']
m = 6
dr.rectangle([(x0 - m) * 2, (y0 - m) * 2, (x1 + 1 + m) * 2 - 1, (y1 + 1 + m) * 2 - 1], outline=AMB, width=2)
t = '%d grains differ, all in x %d-%d, y %d-%d' % (res['grains_differ'], x0, x1, y0, y1)
tw = font.getlength(t)
dr.text((min(max(8, (x0 - m) * 2), 1152 - tw - 8), (y1 + 1 + m) * 2 + 6), t, font=font, fill=AMB)
dr.text((12, 624), "differing grains in magenta; everything else dimmed (today's frozen frame vs with Coracle)", font=small, fill=TXT)
im.save(os.path.join(INB, 'diff.png'), optimize=True)
