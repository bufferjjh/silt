"""Coracle's sprite builder: one bowl, drawn every way the views, the strips and the cut need it.
build.py (spec.json and in-cut/s12.json), views.py, strips.py, poses.py and in-cut/kf.py all draw from here, so every
frame is the same character at the same size in the world.

The bowl (24x24): a lit lip over a round hull, 22 wide and 14 deep, outlined in umber; two near-black eyes with a glint;
a short line in clay shade, tied 2.5 px right of the bowl's axis (which falls between columns 11 and 12); a lit bead
(a seed of its own light) 5x4 on it. At rest the line is 2 px with one kink out, so the bead's centre hangs 3.5 px off
the axis, never plumb under the keel.
Its proportions are the 12's and the 9's in Exhibit B grains: halved for the 2:1 crossfade it is 11 x 10 cells against
the 12's 12 x 10, with the eyes, the shade band, the keel, the line and the bead on the 12's rows and columns.
When the bead touches anything the line is at most 3 px and kinked, and the bead at least 2 px off the axis.
At 16, 12 and 9 the keel under the eyes is clay shade, with umber only where the outline turns. At 12 the line is
tied a column right of the keel's right-middle column, so neither the line nor the bead sits on the axis.
In every frame at 24 and 12 the eyes keep a row of clay between them and the lit lip, and in every frame but the
12's wide-eyed discovery beat also a row between them and the shade band; where a look would push them into either,
the eyes narrow (the lower row) instead of moving.
Light comes from the upper left in every view."""

PAL = {
    "o": "#6A4934",  # umber outline (P2 wood)
    "k": "#281C17",  # the eyes only (darkest topsoil)
    "l": "#F7E6C4",  # the lit lip and the glaze down the left wall
    "p": "#DAC29C",  # the clay body
    "s": "#B49A78",  # clay shade: the underside, the right wall, and the line
    "h": "#D2AC60",  # the bead (seed gold)
    "g": "#FFE09A",  # glow: the eye glints and the bead's core; stays lit at night
}
GLOW = ["g"]

# Props and effects drawn beside it in the strips (all from the film's and Exhibit B's tables). Never part of the sprite.
SCENE_PAL = {
    "A": "#A8937E",  # silt, the ground's top
    "B": "#9A8570",  # silt, darker
    "C": "#8C7864",  # silt, darkest
    "e": "#62824B",  # sprout, light leaf
    "f": "#3B5F42",  # sprout, dark leaf / stem
    "r": "#66615C",  # pebble
    "q": "#4A4643",  # pebble, shade
    "c": "#D08460",  # a clay grain
    "d": "#AE6040",  # a clay grain, shade
    "u": "#B6A08C",  # a puff of fine silt (silt, lightest)
    "w": "#FFF6DC",  # the brief touch-light where the bead meets the work (lamp, lightest)
}

# ---------------------------------------------------------------- the 24

W24 = [22] * 8 + [20, 20, 18, 16, 14, 12]   # hull widths, lip to keel: 8 full rows (3.33 B grains, as the 12's 4),
                                            # then a taper in even steps of 2 (a round underside, no 2-px corner)
SQUASH = [24] * 7 + [22, 22, 20, 18, 16, 14]   # one row shallower, two pixels wider (the most it ever gives)
CX24 = 23                   # twice the axis: the bowl spans columns 1-22, so the axis falls between 11 and 12
SHADE24, SHADE_SQ = 3, 2    # clay-shade rows over the umber keel: rest 3 (the 18, 16 and 14 rows); the squash 2, so
                            # the three clay rows under the eyes stay and only the shade band gives
TOP = 3                     # the lip's row at rest (row 2 is left free for the lift)
EYE_XS = (7, 15)            # the eyes' left columns (2 wide each): 8 apart, 4 px each side of the axis (the 12's 2
                            # cells, doubled), with 5 px of clay between each eye and its wall
EYE_ROW = 4                 # the eyes' top row, below the lip: three rows of clay over them, three under
SIDE_EYE = {'right': 17, 'left': 5}   # the near eye in profile, 3 px in from the front wall
KX = 14                     # the line is tied here on the keel, 2.5 px right of the axis
REST = [(0, 0), (1, 1)]     # the line at rest: 2 px with one kink out, so the bead's centre hangs 3.5 px off the axis
BEAD = [".hhh.", "hgggh", "hhghh", ".hhh."]          # no umber foot
BEAD_BRIGHT = [".ggg.", "ggggg", "hgggh", ".hhh."]   # a brief brightening (discovery, the touch)


def blank(W=24, H=24):
    return [['.'] * W for _ in range(H)]


def S(g):
    return [''.join(r) for r in g]


def put(g, x, y, rows, skip='.'):
    for j, r in enumerate(rows):
        for i, c in enumerate(r):
            if c != skip and 0 <= y + j < len(g) and 0 <= x + i < len(g[0]):
                g[y + j][x + i] = c


def bowl(g, top, widths=W24, cx2=22, shade_rows=2, glaze=True, glaze_rows=4, soft=False):
    """Draws the hull. Row 0 is the lit lip (umber only at its two ends); the hull is outlined in umber.
    soft: umber only at each row's two ends (where the outline turns); the keel and the underside steps are clay shade,
    so no dark bar sits under the eyes (used at 16 and 12)."""
    spans = {}
    for j, w in enumerate(widths):
        a = (cx2 - (w - 1)) // 2
        spans[top + j] = (a, a + w - 1)
    ys = sorted(spans)
    bot = ys[-1]
    for y in ys:
        a, b = spans[y]
        up, dn = spans.get(y - 1), spans.get(y + 1)
        for x in range(a, b + 1):
            if y == top:
                g[y][x] = 'o' if x in (a, b) else 'l'
                continue
            under = y == bot or not (dn[0] <= x <= dn[1]) or not (up[0] <= x <= up[1])
            if x in (a, b) or (under and not soft):
                g[y][x] = 'o'
            elif under or y > bot - 1 - shade_rows or x == b - 1:
                g[y][x] = 's'
            else:
                g[y][x] = 'p'
    if glaze:
        a = spans[top + 1][0]
        for y in range(top + 1, top + 1 + glaze_rows):     # the glaze down the left wall
            if g[y][a + 1] == 'p':
                g[y][a + 1] = 'l'
        j0 = next(j for j, w in enumerate(widths) if w < widths[0])   # the first row of the taper
        for (dx, dy) in ((2, j0), (3, j0 + 1)):     # and a glint low on the belly, so the hull reads round
            y = top + dy
            if y in spans and g[y][spans[y][0] + dx - 1] == 'p':
                g[y][spans[y][0] + dx - 1] = 'l'
    return spans, bot


def shear(g, a, w, lean):
    """The lean: the body, w wide from column a, cut into three runs, moved down 0/1/2 (lean > 0: the right end lower).
    The two end runs are w // 3 each and the middle one takes the rest, so the cut is symmetric (4/4/4 at 12, 7/8/7 at
    22)."""
    r = w // 3

    def shift(x):
        if not lean:
            return 0
        k = 0 if x - a < r else (1 if x - a < w - r else 2)
        return k if lean > 0 else 2 - k
    if lean:
        H, W = len(g), len(g[0])
        h = blank(W, H)
        for y in range(H):
            for x in range(W):
                if g[y][x] != '.':
                    h[min(H - 1, y + shift(x))][x] = g[y][x]
        # where a run's step leaves a short piece of the keel (1-3 columns) hanging a pixel below both its neighbours,
        # take those pixels off and let the ones above carry their colour, so the keel steps cleanly instead of growing
        # a stub
        bottom = [max([y for y in range(H) if h[y][x] != '.'], default=-1) for x in range(W)]
        x = 1
        while x < W - 1:
            x1 = x
            while x1 + 1 < W and bottom[x1 + 1] == bottom[x]:
                x1 += 1
            yb = bottom[x]
            if yb >= 1 and x1 - x < 3 and x1 + 1 < W and bottom[x - 1] >= 0 and bottom[x1 + 1] >= 0 \
                    and yb > bottom[x - 1] and yb > bottom[x1 + 1] and all(h[yb - 1][c] != '.' for c in range(x, x1 + 1)):
                for c in range(x, x1 + 1):
                    h[yb - 1][c], h[yb][c] = h[yb][c], '.'
            x = x1 + 1
        g[:] = h
    return shift


def eye(g, x, y, mode='open', h=3):
    """One eye, 2 wide. open: 3 tall with a glint top-left; wide: 4 tall; half: lower 2 rows; closed: the bottom row."""
    if mode == 'open':
        rows = h
        y0 = y
    elif mode == 'wide':
        rows, y0 = h + 1, y - 1
    elif mode == 'half':
        rows, y0 = h - 1, y + 1
    elif mode == 'closed':
        rows, y0 = 1, y + h - 1
    for dy in range(rows):
        for dx in (0, 1):
            g[y0 + dy][x + dx] = 'k'
    if mode != 'closed':
        g[y0][x] = 'g'


def line(g, pts):
    for (x, y) in pts:
        if 0 <= y < len(g) and 0 <= x < len(g[0]):
            g[y][x] = 's'


def bead(g, cx, y, bright=False):
    put(g, cx - 2, y, BEAD_BRIGHT if bright else BEAD)


def creature(top=TOP, squash=False, lean=0, eye_dx=0, eye_dy=0, eyes='open', eye_xs=EYE_XS,
             path=None, bright=False, bead_at=None, no_bead=False, line_len=None, side=None, rear=False):
    """A 24x24 frame.
    top     the lip's row (3 at rest)
    squash  the one-row settle (keep the keel where it was: top + 1)
    lean    +1 leans toward the right (right end lower), -1 toward the left; the lip is cut into runs of 7/8/7
    eye_dx, eye_dy  where it looks; eyes  open / wide / half / closed / none
    path    the line as a list of (dx, dy) steps from where it is tied on the keel (default REST: 2 px, one kink out);
            line_len n gives REST with n - 2 more pixels straight down (n = 1: just the first pixel)
    bead_at override the bead's top-centre (x, y); bright  the bead brightens
    side    'right' or 'left': the profile view (the bowl is round, so only the eye moves: one, toward the front)
    rear    seen from behind: no eyes, and the line's tie and kink are mirrored"""
    g = blank()
    widths = SQUASH if squash else W24
    spans, bot = bowl(g, top, widths, CX24, shade_rows=SHADE_SQ if squash else SHADE24)
    a, b = spans[top]
    shift = shear(g, a, b - a + 1, lean)
    # eyes, drawn on the leaned body so each stays whole
    ey = top + EYE_ROW + eye_dy
    if side in SIDE_EYE:                    # in profile only the near eye shows, toward the front of the bowl
        eye(g, SIDE_EYE[side], ey, eyes if eyes != 'none' else 'open')
    elif eyes != 'none' and not rear:
        for x0 in eye_xs:
            x = x0 + eye_dx
            eye(g, x, ey + shift(x), eyes)
    if no_bead:
        return S(g)
    kx = CX24 - KX if rear else KX           # from behind, the tie mirrored about the axis
    ky = bot + 1 + shift(kx)
    if path is None:
        path = list(REST)
        if line_len is not None:
            path = path[:max(1, min(2, line_len))]
            path += [(path[-1][0], path[-1][1] + j + 1) for j in range(max(0, line_len - 2))]
    if rear:
        path = [(-dx, dy) for (dx, dy) in path]
    pts = [(kx + dx, ky + dy) for (dx, dy) in path]
    line(g, pts)
    if bead_at is None:
        ex, eyy = pts[-1] if pts else (kx, ky - 1)
        bead_at = (ex, eyy + 1)
    bead(g, bead_at[0], bead_at[1], bright)
    return S(g)


# ---------------------------------------------------------------- the 16 (the brief's simplified version; not in the cut)

def s16(eyes='open', eye_dx=0):
    """The 16x16, a reduction of the 24: same lip, hull, eyes, line and bead; the keel in clay shade."""
    g = blank(16, 16)
    spans, bot = bowl(g, 3, [15, 15, 15, 15, 13, 11, 7], 14, shade_rows=1, glaze=False, soft=True)
    g[4][1] = 'l'
    g[5][1] = 'l'
    for x in (4, 9):
        x += eye_dx
        if eyes == 'closed':
            g[6][x] = g[6][x + 1] = 'k'
        else:
            g[5][x] = 'g'; g[5][x + 1] = 'k'; g[6][x] = 'k'; g[6][x + 1] = 'k'
    g[bot + 1][8] = 's'                     # tied one right of the keel's middle; the bead hangs off the axis
    put(g, 8, bot + 2, ["hh", "hg"])
    return S(g)


# ---------------------------------------------------------------- the 12 (the film's 1:1 view, 1.2 cells a B grain)

W12 = [12, 12, 12, 12, 10, 8, 6]        # lip, clay, two eye rows, a clay row, shade, keel
SETTLE12 = [12, 12, 12, 12, 10, 8]      # one row shallower, the lower hull two pixels fuller; keel where it was
TOP12 = 1                               # the lip's row at rest (row 0 is left free for the lift)
EYE12 = (3, 7)                          # the eyes' left columns (2x2 each)
KX12 = 7                                # the line is tied here: a column right of the keel's right-middle column (6),
                                        # so the line is 1.5 cells and the 2x2 bead 2 cells right of the axis (5.5)
BEAD12, BRIGHT12 = ["hh", "hg"], ["gg", "gg"]
BLINK_BEAD12 = ["hg", "hg"]             # while the eyes are shut the bead keeps two cells lit (two glow cells always)


def eye12(g, x, y, mode='open'):
    """One eye at 12, 2x2. open: glint top-left; wide: 3 tall, the extra row below (so the lit lip never sits on the
    eyes); half: the lower row only, still with its glint (narrowed: resting, or looking down at something; still lit
    at night); closed: the lower row only, dark (the blink)."""
    if mode == 'wide':
        g[y][x], g[y][x + 1] = 'g', 'k'
        g[y + 2][x] = g[y + 2][x + 1] = 'k'
    elif mode == 'open':
        g[y][x], g[y][x + 1] = 'g', 'k'
    g[y + 1][x] = g[y + 1][x + 1] = 'k'
    if mode == 'half':
        g[y + 1][x] = 'g'


def s12(top=TOP12, settle=False, lean=0, eye_dx=0, eye_dy=0, eyes='open', path=((0, 0),), bead_at=None,
        bright=False, bead=None):
    """A 12x12 frame. The same arguments as creature(); the lean cuts the lip into runs of 4 (columns 0-3, 4-7, 8-11).
    path: the line in (dx, dy) steps from where it is tied (default: 1 px straight down from column 7, so the 2x2 bead
    hangs with its left column under the line, two cells right of the axis). bead_at: the bead's top-left; bead: its
    2x2 grid (default BEAD12, or BRIGHT12 when bright).
    settle: one row shallower; only the keel row is shade, so the clay row under the eyes stays."""
    g = blank(12, 12)
    spans, bot = bowl(g, top, SETTLE12 if settle else W12, 11, shade_rows=0 if settle else 1, glaze=False, soft=True)
    for y in (top + 1, top + 2):        # the glaze down the left wall
        g[y][1] = 'l'
    shift = shear(g, 0, 12, lean)
    ey = top + 2 + eye_dy
    for x0 in EYE12:
        x = x0 + eye_dx
        eye12(g, x, ey + shift(x), eyes)
    ky = bot + 1 + shift(KX12)
    pts = [(KX12 + dx, ky + dy) for (dx, dy) in path]
    line(g, pts)
    if bead_at is None:
        ex, eyy = pts[-1] if pts else (KX12, ky - 1)
        bead_at = (ex, eyy + 1)
    put(g, bead_at[0], bead_at[1], bead or (BRIGHT12 if bright else BEAD12))
    return S(g)


def s12_frames():
    """Everything at 12 the cut needs (s12.json): rest, idle, blink, lean, glance, inspection, discovery, construction,
    rest."""
    rest = s12()
    return {
        "s12": rest,
        # rest; lift (the bowl up a pixel, rigid; the bead held, so a second pixel of line shows); settle (one row
        # shallower, the lower hull fuller; keel and bead where they were)
        "idle12": [rest, s12(top=0, path=((0, 0), (0, 1))), s12(top=2, settle=True)],
        # the blink: the lids shut (the lower row, dark); the bead lights a second cell
        "blink12": s12(eyes='closed', bead=BLINK_BEAD12),
        # travelling right, then left: the body leans into travel in runs of 4, the eyes go ahead, the bead trails
        # back on a kinked line (drawn both ways, not mirrored, so the light stays upper left)
        "lean12": [s12(top=0, lean=1, eye_dx=1, path=((0, 0), (-1, 1))),
                   s12(top=0, lean=-1, eye_dx=-1, path=((0, 0), (1, 1)))],
        "glance12": [s12(eye_dx=-1), s12(eye_dx=1)],
        # inspection, toward the left, then the right: not lifted (it comes in close), leans toward the thing, the eyes
        # on it and narrowed (looking down at it: the lower row, glints kept), the bead hanging straight from its tie
        "inspect12": [s12(lean=-1, eye_dx=-1, eyes='half', path=((0, 0),)),
                      s12(lean=1, eye_dx=1, eyes='half', path=((0, 0),))],
        # sees it (the eyes widen a row, downward); a small hop (up a pixel, the bead brightens); settles (the bead
        # swings out once, still on its 1-px line)
        "discover12": [s12(eyes='wide'), s12(top=0, eyes='wide', bright=True),
                       s12(path=((0, 0),), bead_at=(KX12 + 1, 9))],
        # lets the bead down on a kinked line, eyes narrowed on it and toward it; the touch (the line 3 px and kinked,
        # the bead 3 cells off the axis, brightening)
        "construct12": [s12(top=0, eye_dx=1, eyes='half', path=((0, 0), (1, 1))),
                        s12(top=0, eye_dx=1, eyes='half', path=((0, 0), (1, 1), (1, 2)), bright=True)],
        # at anchor: the bead let down to the ground (just under the frame), the line kinked, eyes half closed (the
        # lower row, glints kept); rocks: the bowl down a pixel, the line slack
        "rest12": [s12(eyes='half', path=((0, 0), (1, 1))),
                   s12(top=2, eyes='half', path=((0, 0),), bead_at=(KX12 + 1, 10))],
    }


# ---------------------------------------------------------------- Exhibit B's size and smaller

def b10():
    """Exhibit B and the film's last frame: 9x9 grains, the 12 reduced again. Exhibit B's grains have no outlines, so at
    this size the clay itself makes the shape: lit lip, body, eyes, a row of clay under them, then the shade of the
    keel; the line, tied a grain right of the middle, and a 2x2 bead hanging off the axis. As at 12 and 24, a row of
    clay lies between the eyes and the shade (no dark band under the face). Placed at rows 91-99 (two grains of air over
    the cabbage bed)."""
    return ["lllllllls",
            "lppppppps",
            "lpgpppgps",
            "ppkpppkps",
            ".pppppps.",
            "..sssss..",
            ".....s...",
            ".....hh..",
            ".....hg.."]


B10_LINE = 6                            # b10's line row; the bead is the two rows under it


def b10_lift():
    """The final hold's bob: the bowl one grain higher (B rows 90-95), the line 2 px, the bead held (B rows 98-99).
    10 rows; its bottom row lines up with b10's."""
    r = b10()
    return r[:B10_LINE] + [r[B10_LINE], r[B10_LINE]] + r[B10_LINE + 1:]


def b10_settle():
    """The bob's settle, a short beat after it lands: one row shallower, the lip a grain lower (B row 92), the lower hull
    fuller (the 7-wide row is the keel now); keel, line and bead where they were. 9 rows, row 0 empty, so it is drawn
    in b10's place."""
    r = b10()
    return ["." * 9] + r[:4] + [".sssssss."] + r[B10_LINE:]


def b10_blink():
    """The blink at 9: the glints go and the eye's dark row stays as the closed lid; the bead lights a second grain,
    so two grains still glow."""
    r = b10()
    return r[:2] + ["lppppppps"] + r[3:B10_LINE + 1] + [".....hg..", ".....hg.."]


def s8():
    """A wider view (about x2): the same, 7x7, with both eye glints lit and a row of clay under the eyes; the line a
    column right of the axis and a 2-wide bead hanging from it, 1.5 columns off (as at 16 and 9), so no stem shows
    under the keel even in solid black. Three glow cells."""
    return ["lllllls",
            "lpgpgps",
            "lpkpkps",
            ".pppps.",
            "..sss..",
            "....s..",
            "....hg."]


MARK = ["lll", "gpg", "..g"]   # lit lip; two glowing eyes; the bead, lit, off the axis
