"""Creature concept kit: renders a sprite spec into review sheets and mockups at real film / Exhibit B scale.

Usage:  python3 review-local/kit/kit.py <spec.json> <out_dir>

spec.json:
{
  "name": "Concept name",
  "palette": {"a": "#RRGGBB", ...},       3-5 body colours (an optional extra glow colour may be added)
  "glow": ["e"],                           palette keys that stay lit at night (eyes / inner light); may be []
  "s24":  [24 strings of 24 chars],       the native 24x24 design ('.' = transparent)
  "idle": [[24 strings], [24 strings], [24 strings]],   3-frame idle bob, 24x24 each
  "s16":  [16 strings of 16 chars],       the 16x16 simplified version (used at the film's 1:1 view)
  "b10":  [about 9-10 strings of about 10 chars],  Exhibit B / the film's final frame (2 CSS px grains at 1440)
  "s8":   [about 8 strings of about 8 chars],      optional: a wider view (~x2)
  "mark": [2-4 strings of 2-4 chars]       the mark for wide shots
}
Every row of a grid must have the same length; every char must be '.' or a palette key.

Writes into out_dir:
  sheet.png      native 24 / 16 / b10 / s8 / mark at 1x and 8x (no smoothing), black silhouettes, palette with hex,
                 the 3-frame idle bob at 8x, and the night version (everything dimmed but the glow keys)
  mock-film.png  the new creature placed in frames of the current film at real film scale (1440x900, dpr 1:
                 a cell is 2 CSS px), today's creature beside it for comparison: the close-up with s24, the 1:1 with s16
  mock-b.png     Exhibit B's frozen frame (1440x900, dpr 1, 2 CSS px a grain) with b10 in place of today's creature
                 at the cabbages, plus a 4x crop beside today's
  ladder.png     today's creature vs the new one at each view's size, shown at 4x screen px
  env.png        s24 and s16 over dusk sky, foliage, water, a dark cave, wood, and at night
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

KIT = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(KIT, 'plex-mono.ttf')
INK = (31, 23, 20)
PAPER = (236, 226, 210)
BAND = (21, 17, 15)


def font(sz):
    return ImageFont.truetype(FONT, sz)


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def grid_img(rows, pal, mode='color', night=False, glow=()):
    h = len(rows)
    w = len(rows[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        if len(row) != w:
            raise SystemExit(f'row {y} has length {len(row)}, expected {w}')
        for x, ch in enumerate(row):
            if ch == '.' or ch == ' ':
                continue
            if ch not in pal:
                raise SystemExit(f'char {ch!r} at {x},{y} is not in the palette')
            if mode == 'black':
                px[x, y] = (0, 0, 0, 255)
            else:
                c = hexrgb(pal[ch])
                if night and ch not in glow:
                    c = tuple(int(v * 0.42) for v in c)
                px[x, y] = c + (255,)
    return im


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def label(d, xy, text, sz=16, fill=INK):
    d.text(xy, text, font=font(sz), fill=fill)


def paste(base, sprite, x, y):
    base.alpha_composite(sprite, (int(x), int(y)))


def sheet(spec, out):
    pal, glow = spec['palette'], spec.get('glow', [])
    W = 1500
    rows = []
    def block(title, items):
        rows.append((title, items))
    s24 = grid_img(spec['s24'], pal)
    s16 = grid_img(spec['s16'], pal)
    b10 = grid_img(spec['b10'], pal)
    items = [('24x24, 1x', s24, 1), ('24x24, 8x', s24, 8), ('16x16, 1x', s16, 1), ('16x16, 8x', s16, 8),
             (f'Exhibit B {b10.width}x{b10.height}, 1x', b10, 1), ('8x', b10, 8)]
    block('Native sprites (no smoothing)', items)
    sil = [('24 silhouette', grid_img(spec['s24'], pal, 'black'), 8), ('16 silhouette', grid_img(spec['s16'], pal, 'black'), 8),
           ('B silhouette', grid_img(spec['b10'], pal, 'black'), 8)]
    extra = []
    if spec.get('s8'):
        s8 = grid_img(spec['s8'], pal)
        extra += [(f'{s8.width}x{s8.height}, 1x', s8, 1), ('8x', s8, 8)]
    if spec.get('mark'):
        mk = grid_img(spec['mark'], pal)
        extra += [(f'mark {mk.width}x{mk.height}, 1x', mk, 1), ('8x', mk, 8)]
    block('Silhouettes, solid black', sil + extra)
    idle = [(f'idle {k + 1}', grid_img(f, pal), 8) for k, f in enumerate(spec['idle'])]
    block('Idle bob, three frames', idle)
    night = [('night 24, 8x', grid_img(spec['s24'], pal, night=True, glow=glow), 8),
             ('night 16, 8x', grid_img(spec['s16'], pal, night=True, glow=glow), 8)]
    block('At night (dimmed, glow keeps)', night)
    # layout
    H = 70
    for title, items in rows:
        H += 40 + max(it[1].height * it[2] for it in items) + 40
    H += 110
    im = Image.new('RGBA', (W, H), PAPER + (255,))
    d = ImageDraw.Draw(im)
    label(d, (24, 18), spec['name'], 26)
    y = 70
    for title, items in rows:
        label(d, (24, y), title, 17, (110, 90, 70))
        y += 32
        x = 24
        hmax = max(it[1].height * it[2] for it in items)
        for name, sp, k in items:
            bg = (60, 52, 50) if 'night' in name else (200, 188, 170)
            tile = Image.new('RGBA', (sp.width * k + 16, sp.height * k + 16), bg + (255,))
            paste(tile, up(sp, k), 8, 8)
            im.alpha_composite(tile, (x, y))
            label(d, (x, y + tile.height + 4), name, 13)
            x += tile.width + 28
        y += hmax + 16 + 34
    # palette
    label(d, (24, y), 'Palette', 17, (110, 90, 70))
    y += 30
    x = 24
    for k, h in pal.items():
        d.rectangle([x, y, x + 48, y + 36], fill=hexrgb(h))
        label(d, (x, y + 40), f'{k} {h.upper()}' + (' glow' if k in glow else ''), 13)
        x += 170
    im.convert('RGB').save(os.path.join(out, 'sheet.png'))


def ground_row(img, x, y_from):
    """First row at or below y_from where column x is not sky-ish: crude, only used to sit sprites."""
    return y_from


def mock_film(spec, out):
    pal = spec['palette']
    boxes = json.load(open(os.path.join(KIT, 'today-creature-boxes.json')))
    s24 = grid_img(spec['s24'], pal)
    s16 = grid_img(spec['s16'], pal)
    panels = []
    for name, sp, hover in [('close-t4.0', s24, 3), ('close-t9.0', s24, 3), ('one-t27.0', s16, 2), ('one-t38.0', s16, 2)]:
        b = boxes[name]
        today = Image.open(os.path.join(KIT, f'film-{name}.png')).convert('RGBA')
        base = Image.open(os.path.join(KIT, f'film-{name}-nocre.png')).convert('RGBA')
        cx = (b['x0'] + b['x1'] + 1) / 2
        bottom = b['y1'] + 1  # first row under today's creature: its feet are on the ground there
        x = round(cx - sp.width / 2)
        y = bottom - hover - sp.height
        new = base.copy()
        paste(new, sp, x, y)
        panels.append((name, today, new, (x, y, sp.width, sp.height), b))
    # each panel: today (left) and new (right), full picture at 1x cell = 2 screen px is 1154 wide: too big for 2 side
    # by side, so show the full new frame at 2x (screen size) and below it a crop of both at 6x
    W = 1154 + 48
    H = 0
    parts = []
    for name, today, new, (x, y, w, h), b in panels:
        full = up(new.convert('RGB'), 2)
        cw, ch = 70, 40
        cx0 = max(0, min(577 - cw, int(x + w / 2 - cw / 2)))
        cy0 = max(0, min(257 - ch, int(y + h - ch + 8)))
        c_today = up(today.crop((cx0, cy0, cx0 + cw, cy0 + ch)).convert('RGB'), 7)
        c_new = up(new.crop((cx0, cy0, cx0 + cw, cy0 + ch)).convert('RGB'), 7)
        parts.append((name, full, c_today, c_new))
        H += 40 + full.height + 40 + c_today.height + 30
    im = Image.new('RGB', (W, H + 60), PAPER)
    d = ImageDraw.Draw(im)
    label(d, (24, 14), spec['name'] + ': in the current film at real scale (1440 x 900, dpr 1; a cell is 2 CSS px)', 18)
    yy = 50
    for name, full, c_today, c_new in parts:
        view = 'opening close-up, 24x24' if name.startswith('close') else '1:1 view, 16x16'
        label(d, (24, yy), f'{view} (frame at {name.split("-t")[1]} s of today\'s film; the world will be zoomed out ~1.3x)', 15)
        yy += 26
        im.paste(full, (24, yy))
        yy += full.height + 10
        label(d, (24, yy), 'today, 7x crop', 13)
        label(d, (24 + c_today.width + 20, yy), 'new, 7x crop', 13)
        yy += 22
        im.paste(c_today, (24, yy))
        im.paste(c_new, (24 + c_today.width + 20, yy))
        yy += c_today.height + 30
    im.save(os.path.join(out, 'mock-film.png'))


def mock_b(spec, out):
    pal = spec['palette']
    base = Image.open(os.path.join(KIT, 'b-nocreature.png')).convert('RGBA')  # 1152x648 = 576x324 grains at 2 px
    today = Image.open(os.path.join(KIT, '..', 'ref', 'cross-section.png')).convert('RGBA')
    sp = grid_img(spec['b10'], pal)
    # today's creature: grains x 422..431, y 93..101; the bed's top is grain row 102
    cx = 427
    bottom = 102 - 1  # hover a grain above the bed
    gx = round(cx - sp.width / 2)
    gy = bottom - sp.height
    new = base.copy()
    paste(new, up(sp, 2), gx * 2, gy * 2)
    new.convert('RGB').save(os.path.join(out, 'mock-b-full.png'))
    box = (760, 140, 940, 230)
    c0 = up(today.crop(box).convert('RGB'), 4)
    c1 = up(new.crop(box).convert('RGB'), 4)
    W = max(1152 + 48, 24 + c0.width + 24 + c1.width + 24)
    im = Image.new('RGB', (W, 60 + 648 + 40 + c0.height + 40), PAPER)
    d = ImageDraw.Draw(im)
    label(d, (24, 14), spec['name'] + f': in Exhibit B\'s frozen frame (1440 x 900, dpr 1; {sp.width}x{sp.height} grains of 2 CSS px)', 18)
    im.paste(new.convert('RGB'), (24, 50))
    yy = 50 + 648 + 10
    label(d, (24, yy), 'today, 4x crop', 13)
    label(d, (24 + c0.width + 24, yy), 'new, 4x crop', 13)
    yy += 22
    im.paste(c0, (24, yy))
    im.paste(c1, (24 + c0.width + 24, yy))
    im.save(os.path.join(out, 'mock-b.png'))


def ladder(spec, out):
    pal = spec['palette']
    boxes = json.load(open(os.path.join(KIT, 'today-creature-boxes.json')))
    s24 = grid_img(spec['s24'], pal)
    s16 = grid_img(spec['s16'], pal)
    b10 = grid_img(spec['b10'], pal)
    s8 = grid_img(spec['s8'], pal) if spec.get('s8') else None
    mk = grid_img(spec['mark'], pal) if spec.get('mark') else None
    def crop_today(name):
        b = boxes[name]
        return Image.open(os.path.join(KIT, f'film-{name}.png')).convert('RGBA').crop((b['x0'] - 2, b['y0'] - 2, b['x1'] + 3, b['y1'] + 3))
    tb = Image.open(os.path.join(KIT, '..', 'ref', 'cross-section.png')).convert('RGBA').crop((840, 182, 868, 208)).resize((14, 13), Image.NEAREST)
    rows = [
        ('Opening close-up', crop_today('close-t4.0'), '32x22 today', s24, f'{s24.width}x{s24.height}'),
        ('1:1 view (patch)', crop_today('one-t27.0'), '16x11 today', s16, f'{s16.width}x{s16.height}'),
        ('Final frame = Exhibit B (2 CSS px grains)', tb, '10x9 today', b10, f'{b10.width}x{b10.height}'),
    ]
    if s8:
        rows.append(('Wider view (~x2)', None, '8x6 today', s8, f'{s8.width}x{s8.height}'))
    if mk:
        rows.append(('Wide shots (mark)', None, '2x2 today', mk, f'{mk.width}x{mk.height}'))
    K = 8  # 8 screen px per cell... each cell is 2 CSS px on screen, so this is 4x screen size
    def rowh(r):
        hs = [r[3].height * K + 8] + ([r[1].height * K + 8] if r[1] is not None else [])
        return max(hs) + 24 + 30
    im = Image.new('RGB', (1100, 70 + sum(rowh(r) for r in rows)), PAPER)
    d = ImageDraw.Draw(im)
    label(d, (24, 14), spec['name'] + ': size in each view, today vs new (cells drawn 8 px, which is 4x screen size)', 17)
    y = 56
    for title, t_img, t_lab, n_img, n_lab in rows:
        label(d, (24, y), title, 15)
        y += 24
        x = 24
        if t_img is not None:
            tile = Image.new('RGBA', (t_img.width * K + 8, t_img.height * K + 8), (200, 188, 170, 255))
            tile.alpha_composite(up(t_img, K), (4, 4))
            im.paste(tile.convert('RGB'), (x, y))
            label(d, (x, y + tile.height + 2), t_lab, 12)
            x += tile.width + 40
        else:
            label(d, (x, y + 10), t_lab + ' (part of the far view)', 12)
            x += 300
        tile = Image.new('RGBA', (n_img.width * K + 8, n_img.height * K + 8), (200, 188, 170, 255))
        tile.alpha_composite(up(n_img, K), (4, 4))
        im.paste(tile.convert('RGB'), (x, y))
        label(d, (x, y + tile.height + 2), 'new ' + n_lab, 12)
        y += rowh((title, t_img, t_lab, n_img, n_lab)) - 24
    im.save(os.path.join(out, 'ladder.png'))


def env(spec, out):
    pal, glow = spec['palette'], spec.get('glow', [])
    b = Image.open(os.path.join(KIT, 'b-nocreature.png')).convert('RGBA')
    # crops of Exhibit B (2x image, 2 px a grain): back to 1 px a grain
    def g(box):
        c = b.crop(box)
        return c.resize((c.width // 2, c.height // 2), Image.NEAREST)
    scenes = [('dusk sky', g((560, 40, 660, 100))), ('foliage', g((30, 30, 130, 90))), ('pond water', g((300, 200, 400, 260))),
              ('fungus cave', g((140, 490, 240, 550))), ('cabin wood', g((650, 156, 750, 216))), ('stone/strata', g((600, 330, 700, 390)))]
    s24 = grid_img(spec['s24'], pal)
    s16 = grid_img(spec['s16'], pal)
    n24 = grid_img(spec['s24'], pal, night=True, glow=glow)
    K = 4
    im = Image.new('RGB', (24 + len(scenes) * (50 * K + 16), 60 + 3 * (32 * K + 40)), PAPER)
    d = ImageDraw.Draw(im)
    label(d, (24, 14), spec['name'] + ': against the world (4x screen size)', 17)
    for i, (name, bg) in enumerate(scenes):
        for j, (sp, lbl, dim) in enumerate([(s24, '24', False), (s16, '16', False), (n24, '24 night', True)]):
            tile = bg.crop((0, 0, 50, 30)).copy()
            if tile.height < 30:
                t2 = Image.new('RGBA', (50, 30), (0, 0, 0, 255)); t2.alpha_composite(tile); tile = t2
            if dim:
                px = tile.load()
                for yy in range(tile.height):
                    for xx in range(tile.width):
                        r, gg, bb, a = px[xx, yy]
                        px[xx, yy] = (int(r * 0.42), int(gg * 0.42), int(bb * 0.45), a)
            tile.alpha_composite(sp, ((50 - sp.width) // 2, max(0, (30 - sp.height) // 2)))
            x = 24 + i * (50 * K + 16)
            y = 50 + j * (30 * K + 40)
            im.paste(up(tile, K).convert('RGB'), (x, y))
            label(d, (x, y + 30 * K + 2), f'{name}, {lbl}', 12)
    im.save(os.path.join(out, 'env.png'))


def main():
    spec = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for k in ['s24', 's16', 'b10']:
        if k not in spec:
            raise SystemExit('spec needs ' + k)
    if len(spec['s24']) != 24 or any(len(r) != 24 for r in spec['s24']):
        raise SystemExit('s24 must be 24x24')
    if len(spec['s16']) != 16 or any(len(r) != 16 for r in spec['s16']):
        raise SystemExit('s16 must be 16x16')
    if len(spec.get('idle', [])) != 3:
        raise SystemExit('idle needs three 24x24 frames')
    for k, h in spec['palette'].items():
        if len(k) != 1 or k == '.':
            raise SystemExit('palette keys are single chars other than "."')
    for f in spec['idle']:
        if len(f) != 24 or any(len(r) != 24 for r in f):
            raise SystemExit('idle frames must be 24x24')
    sheet(spec, out)
    mock_film(spec, out)
    mock_b(spec, out)
    ladder(spec, out)
    env(spec, out)
    for k in ['s24', 's16', 'b10']:
        grid_img(spec[k], spec['palette']).save(os.path.join(out, f'{k}-1x.png'))
        up(grid_img(spec[k], spec['palette']), 8).save(os.path.join(out, f'{k}-8x.png'))
    print('wrote', out)


if __name__ == '__main__':
    main()
