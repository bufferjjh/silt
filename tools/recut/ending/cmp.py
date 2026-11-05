"""Pixel diff of two frames of Exhibit B. Each may be at 1x or 2x (2x blocks are checked uniform, then taken 1 per grain).
Usage: python3 cmp.py a.png b.png [diff.png]  -- prints the count of differing grains and their bounding boxes."""
import sys
import numpy as np
from PIL import Image

def grains(p):
    a = np.asarray(Image.open(p).convert('RGB')).astype(int)
    if a.shape[1] in (1152, 1440, 1008, 864) or a.shape[1] % 2 == 0 and a.shape[1] > 700:
        s = a[0::2, 0::2]
        assert all((a[dy::2, dx::2] == s).all() for dy in (0, 1) for dx in (0, 1)), p + ' is not 2x blocks'
        return s
    return a

a, b = grains(sys.argv[1]), grains(sys.argv[2])
assert a.shape == b.shape, (a.shape, b.shape)
d = (a != b).any(2)
n = int(d.sum())
print('grains', a.shape[1], 'x', a.shape[0], 'differ:', n)
if n:
    ys, xs = np.nonzero(d)
    print('bbox x %d-%d y %d-%d' % (xs.min(), xs.max(), ys.min(), ys.max()))
    # cluster coarsely in 24x24 tiles
    tiles = {}
    for y, x in zip(ys, xs):
        tiles.setdefault((x // 24, y // 24), 0)
        tiles[(x // 24, y // 24)] += 1
    print('tiles (x0,y0:count):', ' '.join('%d,%d:%d' % (k[0] * 24, k[1] * 24, v) for k, v in sorted(tiles.items(), key=lambda kv: (kv[0][1], kv[0][0]))))
    if len(sys.argv) > 3:
        img = (a * 0.35).astype(np.uint8)
        img[d] = [255, 0, 255]
        Image.fromarray(img).resize((a.shape[1] * 2, a.shape[0] * 2), Image.NEAREST).save(sys.argv[3])
