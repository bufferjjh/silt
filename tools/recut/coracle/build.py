"""Builds spec.json and in-cut/s12.json for the Coracle concept from coracle.py (one bowl, every size drawn from it).
Usage: python3 -B build.py <outdir> [name] [-v]     (in-cut/s12.json is written under <outdir>/in-cut/)
The reviewed first draft is kept in v1/ (its own build.py drew the ink-capped first draft); the state before the
second round of fixes is kept in v2-before/, and the state before the third in v3-before/."""
import json, sys, os
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coracle as C

NOTE12 = ("The 12-cell Coracle for the film's 1:1 view (1.2 cells per Exhibit B grain), built by coracle.py's s12() as a "
          "reduction of the 24 and a step up from b10. Rest is 12 x 10 inside a 12 x 12 grid; row 0 is left free for "
          "the lift, row 11 for the frames whose bead hangs lower. The keel is clay shade, umber only at each row's "
          "ends. The line is tied at column 7, a column right of the keel's right-middle column, so the line is 1.5 "
          "cells and the 2x2 bead 2 cells right of the bowl's axis (between columns 5 and 6): never on it. In every "
          "frame a row of clay lies between the eyes and the lit lip. idle12: rest, lift (the bowl rises a pixel, "
          "rigid; the bead held, so a second pixel of line shows), settle (one row shallower, the lower hull two pixels "
          "fuller, the clay row under the eyes kept; keel and bead where they were). blink12: its own frame, every 4-6 "
          "bobs, never in the idle; the lids shut and the bead lights a second cell. lean12: travelling right, "
          "travelling left (runs of 4, the eyes ahead, the bead trailing on a kinked line; both drawn, not mirrored, so "
          "the light stays upper left). glance12: left, right. inspect12: toward a thing on the left, then the right: "
          "not lifted, leaning toward it, the eyes on it and narrowed to their lower row (looking down at it), the "
          "bead hanging straight from its tie. discover12: the eyes widen a row, downward; a one-pixel hop with the "
          "bead brightening; settles with the bead swung out a cell. construct12: lets the bead down on a kinked line, "
          "the eyes narrowed on it and toward it; the touch (3 px kinked, the bead 3 cells off the axis, brightening; "
          "the work sits just under the frame). rest12: at anchor (the bead on the ground just under the frame, the "
          "line kinked, eyes half closed, glints kept); rocks (the bowl down a pixel, the line slack).")


def main():
    out = sys.argv[1]
    s24 = C.creature()
    # idle: (1) at rest; (2) the bowl lifts a pixel, rigid, and the bead lags so a pixel more line shows;
    # (3) it settles onto the air: one row shallower, two pixels wider, the keel and the bead where they were. No blink.
    i2 = C.creature(top=C.TOP - 1, line_len=3)
    i3 = C.creature(top=C.TOP + 1, squash=True)
    spec = {"name": sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('-') else "Coracle",
            "palette": C.PAL, "glow": C.GLOW,
            "s24": s24, "idle": [s24, i2, i3], "s16": C.s16(), "b10": C.b10(), "b10_lift": C.b10_lift(),
            "b10_settle": C.b10_settle(), "b10_blink": C.b10_blink(), "s8": C.s8(), "mark": C.MARK,
            "note": "s24 is 22 x 20 (columns 1-22, lip row 3 to the bead's last row 22): a 14-row hull with 8 "
                    "full-width rows, and a 2-px kinked line tied 2.5 px right of the bowl's axis (which falls between "
                    "columns 11 and 12), so the bead's centre is 3.5 px right of it. One size in the world, in Exhibit B "
                    "grains: s24 at the close-up's 2.4 cells a grain 9.17 x 8.33, s12 at the 1:1's 1.2 cells 10.0 x 8.33, "
                    "b10 at 1.0 9 x 9; halved at the 2:1 crossfade s24 is 11 x 10 cells against s12's 12 x 10, eyes, "
                    "shade band, keel, line and bead on s12's rows and columns to half a cell. b10 is Exhibit B's "
                    "frozen frame and the film's last frame, at rows 91-99 and x 422-430 of Exhibit B's grains at 1440 x "
                    "900 (two grains of air over the cabbage bed, row 102). The final hold's idle: b10 (rest), b10_lift "
                    "(10 rows, its bottom row on b10's, B rows 90-99: the bowl a grain higher, the line 2 px, the bead "
                    "held), then b10_settle, a short beat after landing (9 rows drawn in b10's place: row 0 empty, the "
                    "lip a grain lower, one row shallower; keel, line and bead where they were). b10_blink: drawn in "
                    "b10's place while the eyes are shut (the glints go, the dark row stays as the lid, the bead lights "
                    "a second grain)."}
    json.dump(spec, open(os.path.join(out, 'spec.json'), 'w'), indent=1)
    s12 = {"name": spec["name"], "note": NOTE12, "palette": C.PAL, "glow": C.GLOW}
    s12.update(C.s12_frames())
    os.makedirs(os.path.join(out, 'in-cut'), exist_ok=True)
    json.dump(s12, open(os.path.join(out, 'in-cut', 's12.json'), 'w'), indent=1)
    if '-v' in sys.argv:
        for k in ['s24', 's16', 'b10', 'b10_lift', 'b10_settle', 'b10_blink', 's8', 'mark']:
            print(k)
            print('\n'.join(spec[k]))
        for i, f in enumerate(spec['idle']):
            print('idle', i + 1)
            print('\n'.join(f))
        for k, v in s12.items():
            if k in ('name', 'note', 'palette', 'glow'):
                continue
            frames = v if isinstance(v[0], list) else [v]
            for i, f in enumerate(frames):
                print(k, i + 1)
                print('\n'.join(f))


if __name__ == '__main__':
    main()
