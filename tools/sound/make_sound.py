#!/usr/bin/env python
"""
Silt film soundtrack, for the re-cut of 2026-11-04. The cue sheet below (CUES) is that film's timeline:
re-cut the film and the cues, the sections and the chords change with it.

Renders silt-film.wav (60.000 s, 48 kHz, stereo, 16-bit) next to this file, encodes the site's
assets/silt-film.m4a from it, and checks the result: cue onsets measured on the finished mix and on the
decoded m4a, loudness and true peak through ffmpeg's ebur128, the m4a's start offset and duration, and a
spectrogram PNG.

Everything is synthesized here from oscillators, noise and filters (numpy + scipy). No samples, no
downloaded audio. Deterministic: every random source is seeded from SEED.

The audio file is the film's master clock. Every scripted accent starts its attack ramp (5 ms or more) on
the exact sample of its cue time. Beat-grid cues use the exact grid (72 bpm, beat = 0.83333 s), so a cue
the sheet writes as 3.33 starts at 3.3333 s; the sheet's own rounding is never more than 3.4 ms away.

    python make_sound.py              render, encode, check
    python make_sound.py --no-encode  render and check the wav only

Music: D major pentatonic (D E F# A B) for every melodic voice. The chords are the sheet's own
(Dmaj9, Gmaj7, Bm9, Gmaj9), so the pad and the e-piano also use C# and G; the home chord is D6/9.
"""

import argparse
import re
import subprocess
from pathlib import Path

import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, hilbert, lfilter, resample_poly, sosfilt, sosfiltfilt

HERE = Path(__file__).resolve().parent
WAV = HERE / "silt-film.wav"
PNG = HERE / "silt-film-spectrogram.png"
PNG_CUES = HERE / "silt-film-cues.png"
SITE_M4A = HERE.parents[1] / "assets" / "silt-film.m4a"  # tools/sound/ -> the repo root's assets/

SR = 48000
DUR = 60.0
N = int(round(DUR * SR))          # 2,880,000 samples, exactly 60.000 s
T = np.arange(N) / SR
BEAT = 60.0 / 72.0                # 0.83333 s; a bar is 3.33333 s
SEED = 20261103
TARGET_LUFS = -18.0
TP_CEILING = -2.0                 # dBTP for the wav, so the AAC encode also stays under -1 dBTP
WET = 0.55                        # reverb return


def beat(n):
    return n * BEAT


def rng(k):
    return np.random.default_rng(SEED + 7919 * k)


_PC = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name):
    midi = 12 * (int(name[-1]) + 1) + _PC[name[:-1]]
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


# ------------------------------------------------------------------------------------------ the cue sheet

# (time as the sheet writes it, exact time, what it is). These are the accents the film is drawn against.
CUES = [
    ("0.42", beat(0.5), "key tick: s"),
    ("0.83", beat(1), "key tick: i"),
    ("1.25", beat(1.5), "key tick: l"),
    ("1.67", beat(2), "key tick: t"),
    ("2.08", beat(2.5), "kalimba D4: Enter, the world fades up"),
    ("4.17", beat(5), "kalimba A4: the seed lands"),
    ("5.00", beat(6), "soft tap and kalimba D5: planted"),
    ("7.50", beat(9), "dig tick 1"),
    ("7.92", beat(9.5), "scratch 1"),
    ("8.33", beat(10), "dig tick 2 (higher)"),
    ("8.75", beat(10.5), "scratch 2"),
    ("9.17", beat(11), "dig tick 3 (higher)"),
    ("9.58", beat(11.5), "scratch 3"),
    ("10.00", beat(12), "kalimba F#4: it looks in"),
    ("11.67", beat(14), "wooden knock: the plank"),
    ("12.50", beat(15), "glassy tick: the first drops; the pad leans to G"),
    ("14.17", beat(17), "soft low bell D4: the step back"),
    ("18.33", beat(22), "kalimba D5: clay (with F#5 and A5 after)"),
    ("20.00", beat(24), "faint high tick: inspect, moisture; the pad home to Dmaj9"),
    ("20.42", beat(24.5), "bird call: they come to drink"),
    ("20.83", beat(25), "kalimba B4: the sprout"),
    ("24.58", beat(29.5), "drip 1"),
    ("25.42", beat(30.5), "drip 2"),
    ("25.83", beat(31), "marimba A3: the spill (F#4, E4, D4 after)"),
    ("29.17", beat(35), "deep soft drop: the water reaches the cave"),
    ("30.00", beat(36), "scratch: the shaft; chord to Gmaj7"),
    ("30.83", beat(37), "scratch"),
    ("31.67", beat(38), "scratch"),
    ("32.50", beat(39), "scratch"),
    ("33.33", beat(40), "bell D5: it breaks into the dark"),
] + [
    (f"{beat(42 + n / 2):.2f}", beat(42 + n / 2), f"wooden knock {n + 1}: building") for n in range(4)
] + [
    ("35.00", beat(42), "chord to Bm9 (with knock 1)"),
    ("36.67", beat(44), "knock and creak: the water starts the wheel"),
    ("37.50", beat(45), "kalimba D5: the pots (E5, F#5, A5, B5 after)"),
    ("39.58", beat(47.5), "wooden knock: the trough"),
    ("40.83", beat(49), "faint high tick: inspect, flow"),
    ("41.67", beat(50), "kalimba D5: the first cabbage"),
    ("42.92", beat(51.5), "bird call: at the trough"),
    ("43.33", beat(52), "FM e-piano enters, Dmaj9: the days pass"),
    ("48.33", beat(58), "crickets enter, Gmaj9: dusk"),
    ("50.00", beat(60), "kalimba D5: home"),
    ("52.50", beat(63), "soft low bell D4: the pull-back; D6/9"),
    ("56.67", beat(68), "kalimba D5: the tagline; the pad resolves"),
]
CUES = sorted(CUES, key=lambda c: c[1])

# Sections of the sheet, for the balance table.
SECTIONS = [0.0, beat(3), beat(9), beat(15), beat(17), beat(24), beat(31), beat(36), beat(42), beat(48), beat(52),
            beat(58), beat(63), beat(68), DUR]

# Pad voicings, held from each time to the next (notes common to two chords are held, not restruck).
PAD_CHORDS = [
    (beat(3), ["D3", "A3"]),                           # 2.500 the open D-A fifth, ~2 s attack
    (beat(15), ["G2", "D3", "B3", "F#4"]),             # 12.500 the rain: Gmaj7
    (beat(24), ["D3", "A3", "E4", "F#4"]),             # 20.000 Dmaj9, after the rain
    (beat(36), ["G2", "D3", "B3", "F#4"]),             # 30.000 Gmaj7, the shaft
    (beat(42), ["B2", "F#3", "A3", "D4"]),             # 35.000 Bm9, the wheel
    (beat(52), ["D3", "A3", "E4", "F#4"]),             # 43.333 Dmaj9, the days pass
    (beat(58), ["G2", "D3", "A3", "B3", "F#4"]),       # 48.333 Gmaj9, dusk
    (beat(63), ["D3", "A3", "E4", "F#4", "B4"]),       # 52.500 home: D6/9, the pull-back
]
PAD_START = beat(3)

EP_VOICING = {
    "Dmaj9": ["D3", "F#3", "A3", "C#4", "E4"],
    "Gmaj7": ["G2", "F#3", "B3", "D4"],
    "Bm9": ["B2", "D3", "A3", "C#4", "F#4"],
    "Gmaj9": ["G2", "F#3", "A3", "B3", "D4"],
    "D69": ["D3", "A3", "B3", "E4", "F#4"],
}

EP_STRIKES = [  # (beat, chord, velocity); the lo-fi bed comes in with the time-lapse
    (52, "Dmaj9", 0.74), (54, "Dmaj9", 0.42), (56, "Dmaj9", 0.52),
    (58, "Gmaj9", 0.62), (61, "Gmaj9", 0.36),
    (63, "D69", 0.46), (66, "D69", 0.26),
]

PLUCKS = [  # (beat, note, velocity)
    (2.5, "D4", 0.62), (5, "A4", 0.62), (6, "D5", 0.55), (12, "F#4", 0.45),
    (22, "D5", 0.52), (22.5, "F#5", 0.46), (23, "A5", 0.42),
    (25, "B4", 0.50), (27, "A4", 0.26), (28, "B4", 0.24),
    (31.5, "F#4", 0.42), (32, "E4", 0.40), (32.5, "D4", 0.38),
    (45, "D5", 0.42), (45.5, "E5", 0.38), (46, "F#5", 0.40), (46.5, "A5", 0.36), (47, "B5", 0.34),
    (50, "D5", 0.46), (53, "F#5", 0.24), (55, "E5", 0.22), (57, "D5", 0.22),
    (60, "D5", 0.62), (61.5, "B4", 0.20),
    (68, "D5", 0.60),
]

KNOCK_NOTES = ["A4", "B4", "D5", "B4"]

# Times other textures keep clear of, so every accent reads on its own.
ACCENT_TIMES = np.array([c[1] for c in CUES])
CUE_SNIPS = {}        # cue time -> mono sum of everything started within 25 ms of it (dry, before the master)
MASTER = {"gain_db": 0.0}


def capture(at, sig2):
    for tc in ACCENT_TIMES:
        if 0.0 <= at - tc < 0.025:
            j = int(round((at - tc) * SR))
            buf = CUE_SNIPS.setdefault(round(float(tc), 6), np.zeros(int(0.3 * SR)))
            m = min(len(buf) - j, sig2.shape[1])
            buf[j:j + m] += sig2[:, :m].mean(axis=0)


def clear_of_accents(t, before=0.12, after=0.06):
    d = t - ACCENT_TIMES
    return not np.any((d > -before) & (d < after))


# ------------------------------------------------------------------------------------------ tools

def _sos(kind, f, order):
    return butter(order, f, kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return sosfilt(_sos("lowpass", f, order), x, axis=-1)


def hp(x, f, order=2):
    return sosfilt(_sos("highpass", f, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return sosfilt(_sos("bandpass", [lo, hi], order), x, axis=-1)


def rcos(n):
    """0 -> 1 over n samples, raised cosine."""
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / max(n, 1))


def smooth01(v):
    v = np.clip(v, 0.0, 1.0)
    return v * v * (3.0 - 2.0 * v)


def oneshot(x, att=0.006, tail=0.04):
    """Attack ramp from the first sample (the cue sample), at least 5 ms, and a fade to zero at the end."""
    x = np.array(x, dtype=float)
    na = int(round(max(att, 0.005) * SR))
    x[..., :na] *= rcos(na)
    nt = int(round(tail * SR))
    x[..., -nt:] *= rcos(nt)[::-1]
    return x


def pan_gains(p):
    th = (np.clip(p, -1.0, 1.0) + 1.0) * np.pi / 4.0
    return np.cos(th) * np.sqrt(2.0), np.sin(th) * np.sqrt(2.0)


def ease(points, tt=None):
    """Automation curve through (time, value) points, cosine-eased between them, flat outside."""
    tt = T if tt is None else tt
    ts = np.array([p[0] for p in points], float)
    vs = np.array([p[1] for p in points], float)
    i = np.clip(np.searchsorted(ts, tt, side="right") - 1, 0, len(ts) - 2)
    u = np.clip((tt - ts[i]) / np.maximum(ts[i + 1] - ts[i], 1e-9), 0.0, 1.0)
    out = vs[i] + (vs[i + 1] - vs[i]) * (0.5 - 0.5 * np.cos(np.pi * u))
    out = np.where(tt < ts[0], vs[0], out)
    return np.where(tt >= ts[-1], vs[-1], out)


def wander(rate, seed, lo=0.0, hi=1.0, tt=None):
    """A smooth random curve with about `rate` new values per second."""
    tt = T if tt is None else tt
    r = np.random.default_rng(seed)
    knots = np.arange(-3.0 / rate, DUR + 3.0 / rate, 1.0 / rate)
    return PchipInterpolator(knots, r.uniform(lo, hi, len(knots)))(tt)


def grain_env(rate, seed, rise=0.005, decay=0.03):
    """Amplitude texture: a Poisson stream of small soft bumps whose density follows `rate` (per second)."""
    r = np.random.default_rng(seed)
    rmax = float(rate.max())
    cnt = r.poisson(rmax * DUR)
    idx = (r.uniform(0.0, DUR, cnt) * SR).astype(int).clip(0, N - 1)
    keep = r.uniform(0.0, 1.0, cnt) < rate[idx] / rmax
    imp = np.zeros(N)
    np.add.at(imp, idx[keep], r.uniform(0.25, 1.0, keep.sum()) ** 2)
    nr, nd = int(rise * SR), int(decay * 6 * SR)
    k = np.concatenate([rcos(nr), np.exp(-np.arange(nd) / (decay * SR))])
    m = fftconvolve(imp, k)[:N]
    active = rate > 0.2 * rmax
    return m / max(m[active].mean(), 1e-9)


def svf_bp(x, fc, damp):
    """Chamberlin state-variable band-pass with a moving centre (short sounds only)."""
    out = np.empty_like(x)
    F = 2.0 * np.sin(np.pi * np.asarray(fc) / SR)
    low = band = 0.0
    for i in range(len(x)):
        high = x[i] - low - damp * band
        band += F[i] * high
        low += F[i] * band
        out[i] = band
    return out


def kweight(x):
    """ITU-R BS.1770 K-weighting at 48 kHz."""
    y = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285],
                [1.0, -1.69065929318241, 0.73248077421585], x, axis=-1)
    return lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], y, axis=-1)


def integrated_lufs(x):
    p = kweight(x) ** 2
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(p, axis=1)], axis=1)
    starts = np.arange(0, x.shape[1] - blk + 1, hop)
    z = ((cs[:, starts + blk] - cs[:, starts]) / blk).sum(axis=0)
    lk = -0.691 + 10 * np.log10(np.maximum(z, 1e-20))
    z1 = z[lk > -70.0]
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10.0
    z2 = z[(lk > -70.0) & (lk > rel)]
    return -0.691 + 10 * np.log10(z2.mean())


def true_peak_db(x):
    return 20 * np.log10(np.abs(resample_poly(x, 4, 1, axis=1)).max() + 1e-12)


# ------------------------------------------------------------------------------------------ the mix

class Mix:
    def __init__(self):
        self.dry = np.zeros((2, N))
        self.send = np.zeros((2, N))
        self.stats = {}


class Stem:
    """One voice of the mix. Everything placed with put() starts on its exact sample."""

    def __init__(self, mix, name, send=0.0):
        self.mix, self.name, self.send = mix, name, send
        self.x = np.zeros((2, N))

    def put(self, sig, at, pan=0.0, gain=1.0):
        sig = np.asarray(sig, float)
        if sig.ndim == 1:
            gl, gr = pan_gains(pan)
            sig = np.stack([sig * gl, sig * gr])
        i = int(round(at * SR))
        m = min(sig.shape[1], N - i)
        if m > 0:
            self.x[:, i:i + m] += sig[:, :m] * gain
            capture(at, sig[:, :m] * gain)

    def done(self):
        self.mix.dry += self.x
        self.mix.send += self.x * self.send
        kw = kweight(self.x) ** 2
        self.mix.stats[self.name] = [kw[:, int(a * SR):int(b * SR)].mean(axis=1).sum()
                                     for a, b in zip(SECTIONS[:-1], SECTIONS[1:])]
        self.x = None


# ------------------------------------------------------------------------------------------ instruments

def kalimba(f, vel, seed, dur=2.8):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.9)
    x += 0.09 * np.sin(2 * np.pi * 2 * f * tt + 0.4) * np.exp(-tt / 0.28)
    for ratio, a, tau in ((5.4, 0.13, 0.06), (8.9, 0.04, 0.022)):
        if ratio * f < 6500:
            x += a * np.sin(2 * np.pi * ratio * f * tt + r.uniform(0, 2 * np.pi)) * np.exp(-tt / tau)
    nb = int(0.03 * SR)
    x[:nb] += 0.10 * bp(r.standard_normal(nb), 250, 1800) * np.exp(-np.arange(nb) / (0.005 * SR))
    return oneshot(x * vel, att=0.005, tail=0.3)


def bell(f, vel, seed, dur=5.5):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    parts = [(0.5, 0.08, 2.8), (1.0, 1.0, 2.6), (2.0, 0.22, 1.4), (2.76, 0.18, 0.9), (4.07, 0.06, 0.5),
             (5.43, 0.035, 0.32)]
    out = np.zeros((2, n))
    for ratio, a, tau in parts:
        if ratio * f < 7000:
            main = a * np.sin(2 * np.pi * ratio * f * tt + r.uniform(0, 2 * np.pi)) * np.exp(-tt / tau)
            for ch, det in ((0, -0.4), (1, 0.4)):
                twin = 0.3 * a * np.sin(2 * np.pi * (ratio * f + det) * tt + r.uniform(0, 2 * np.pi)) * np.exp(-tt / tau)
                out[ch] += main + twin
    nb = int(0.04 * SR)
    strike = bp(r.standard_normal(nb), 900, 3500) / 0.35 * np.exp(-np.arange(nb) / (0.006 * SR)) * 0.14
    out[:, :nb] += strike
    return oneshot(out * vel, att=0.006, tail=0.6)


def marimba(f, vel, seed, dur=1.8):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.5)
    x += 0.18 * np.sin(2 * np.pi * 2 * f * tt + 0.3) * np.exp(-tt / 0.22)
    x += 0.22 * np.sin(2 * np.pi * 3.93 * f * tt + r.uniform(0, 6.3)) * np.exp(-tt / 0.07)
    if 9.2 * f < 6500:
        x += 0.06 * np.sin(2 * np.pi * 9.2 * f * tt + r.uniform(0, 6.3)) * np.exp(-tt / 0.02)
    nb = int(0.03 * SR)
    x[:nb] += 0.12 * lp(r.standard_normal(nb), 1500) * np.exp(-np.arange(nb) / (0.005 * SR))
    return oneshot(x * vel, att=0.005, tail=0.3)


def knock(f, vel, seed, dur=0.4):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.05)
    x += 0.3 * np.sin(2 * np.pi * 2.43 * f * tt + r.uniform(0, 6.3)) * np.exp(-tt / 0.02)
    x += 0.25 * bp(r.standard_normal(n), 700, 2800) * np.exp(-tt / 0.005)
    return oneshot(x * vel, att=0.005, tail=0.1)


def tick(f, vel, seed, body_tau=0.008, band=(1500, 5000), noise=0.6, noise_tau=0.004, dur=0.12):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt / body_tau)
    x += noise * bp(r.standard_normal(n), *band) / 0.3 * np.exp(-tt / noise_tau)
    return oneshot(x * vel, att=0.005, tail=0.03)


def scratch(vel, seed):
    """A scratch of dry silt: a few gritty micro-grains, the first and largest on the cue."""
    r = np.random.default_rng(seed)
    n = int(0.15 * SR)
    x = np.zeros(n)
    m = int(0.03 * SR)
    tm = np.arange(m) / SR
    for k, off in enumerate([0.0] + sorted(r.uniform(0.008, 0.05, 4))):
        g = bp(r.standard_normal(m), 1200, 5000) / 0.3 * np.exp(-tm / 0.006)
        g[:240] *= rcos(240)
        i = int(off * SR)
        x[i:i + m] += g * (1.0 if k == 0 else r.uniform(0.3, 0.6))
    tt = np.arange(n) / SR
    x += 0.35 * np.sin(2 * np.pi * 900 * tt) * np.exp(-tt / 0.01)
    return oneshot(x * vel, att=0.005, tail=0.04)


def dig_tick(f, vel, seed):
    r = np.random.default_rng(seed)
    x = tick(f, 1.0, seed, body_tau=0.025, band=(400, 2200), noise=0.5, noise_tau=0.012, dur=0.2)
    n = len(x)
    tt = np.arange(n) / SR
    for off in sorted(r.uniform(0.01, 0.06, 3)):     # a little crumble after the tick
        i = int(off * SR)
        m = int(0.02 * SR)
        g = bp(r.standard_normal(m), 500, 2500) / 0.3 * np.exp(-np.arange(m) / (0.004 * SR)) * 0.25
        g[:240] *= rcos(240)
        x[i:i + m] += g[:max(0, min(m, n - i))]
    return oneshot(x * vel * np.exp(-tt / 0.2), att=0.005, tail=0.04)


def glass(f, vel, seed, dur=0.5):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    for ratio, a, tau in ((1.0, 1.0, 0.035), (2.76, 0.25, 0.018), (5.4, 0.06, 0.01)):
        if ratio * f < 7000:
            x += a * np.sin(2 * np.pi * ratio * f * tt + r.uniform(0, 6.3)) * np.exp(-tt / tau)
    return oneshot(x * vel, att=0.005, tail=0.1)


def scoop(vel, seed):
    """A soft scoop of wet clay: a falling band of noise and a small round thud."""
    r = np.random.default_rng(seed)
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    fc = 1500.0 * (380.0 / 1500.0) ** np.clip(tt / 0.22, 0, 1)
    y = svf_bp(r.standard_normal(n), fc, damp=0.35)
    y = y / y.std() * np.exp(-tt / 0.11)
    ph = 2 * np.pi * np.cumsum(140.0 + 70.0 * np.exp(-tt / 0.03)) / SR
    x = 0.35 * y + 0.7 * np.sin(ph) * np.exp(-tt / 0.05)
    return oneshot(x * vel, att=0.006, tail=0.08)


def brush(vel, seed):
    r = np.random.default_rng(seed)
    n = int(0.32 * SR)
    tt = np.arange(n) / SR
    y = bp(r.standard_normal(n), 1200, 5500) / 0.35
    env = 0.75 * np.exp(-tt / 0.05) + 0.25 * np.exp(-tt / 0.16)
    return oneshot(y * env * vel, att=0.008, tail=0.06)


def epiano_note(f, vel, dur, seed):
    """Soft FM electric piano: 1:1 modulator with a falling index, a quiet tine, a little tape wow."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    wob = 1.0 + 0.0012 * np.sin(2 * np.pi * 0.55 * tt + r.uniform(0, 6.3))
    ph = 2 * np.pi * f * np.cumsum(wob) / SR
    index = vel * (1.0 * np.exp(-tt / 0.18) + 0.18)
    x = np.sin(ph + index * np.sin(ph))
    if 3 * f < 5000:
        x += 0.06 * vel * np.sin(3 * ph + 0.7 * np.exp(-tt / 0.02) * np.sin(ph)) * np.exp(-tt / 0.06)
    # the tine: a quick, quiet FM ding (14:1 modulator, index falling in ~12 ms) that defines the strike
    x += 0.12 * vel * np.sin(ph + 1.2 * np.exp(-tt / 0.012) * np.sin(14 * ph)) * np.exp(-tt / 0.03)
    x *= np.exp(-tt / (2.4 * (220.0 / f) ** 0.35))
    return oneshot(x * vel, att=0.005, tail=0.35)


def bird_call(notes, seed, spacing=0.12, note_dur=0.085):
    """Three FM down-sweeps; the first starts on the cue."""
    r = np.random.default_rng(seed)
    n = int((spacing * (len(notes) - 1) + note_dur + 0.02) * SR)
    x = np.zeros(n)
    m = int(note_dur * SR)
    tt = np.arange(m) / SR
    for k, (fa, fb) in enumerate(notes):
        f_inst = fb + (fa - fb) * np.exp(-4.0 * tt / note_dur)
        ph = 2 * np.pi * np.cumsum(f_inst) / SR
        y = np.sin(ph + 0.35 * np.sin(2 * np.pi * r.uniform(85, 110) * tt))
        y = oneshot(y * np.exp(-tt / 0.04), att=0.005, tail=0.012)
        i = int(round(k * spacing * SR))
        x[i:i + m] += y * (1.0 - 0.12 * k)
    return x


def pad_note(st, f, t0, t1, att, rel, amp, fc, seed, pan=0.0):
    """Additive soft pad note: saw-like partials through a moving low-pass. Two detuned voices are shared by
    both sides and one quieter, wider-detuned voice sits on each side, so the pad is only lightly wide."""
    r = np.random.default_rng(seed)
    i0, i1 = int(round(t0 * SR)), min(N, int(round((t1 + rel) * SR)))
    if i1 <= i0:
        return
    ta = T[i0:i1]
    env = smooth01((ta - t0) / att) * smooth01((t1 + rel - ta) / rel)
    env *= 1.0 + 0.07 * np.sin(2 * np.pi * r.uniform(0.05, 0.12) * ta + r.uniform(0, 6.3))
    fcs = fc[i0:i1]
    fmax = fcs.max()

    def voice(cents):
        fd = f * 2 ** (cents / 1200.0)
        acc = np.zeros(i1 - i0)
        for k in range(1, 48):
            fk = k * fd
            if fk > 4500 or fk > 3.5 * fmax:
                break
            acc += k ** -1.15 / np.sqrt(1.0 + (fk / fcs) ** 4) * np.sin(2 * np.pi * fk * ta + r.uniform(0, 6.3))
        return acc

    shared = voice(-4) + voice(4)
    gl, gr = pan_gains(pan)
    st.x[0, i0:i1] += (shared + 0.6 * voice(-10)) * env * (amp * gl / 2.4)
    st.x[1, i0:i1] += (shared + 0.6 * voice(10)) * env * (amp * gr / 2.4)


# ------------------------------------------------------------------------------------------ the voices

def v_wind(mix):
    st = Stem(mix, "wind", send=0.10)
    r = rng(1)
    c = r.standard_normal(N)
    nz = np.stack([0.87 * c + 0.5 * r.standard_normal(N), 0.87 * c + 0.5 * r.standard_normal(N)])
    low = hp(lp(nz, 420), 90) / 0.12
    air = bp(nz, 300, 1500) / 0.22
    gust = wander(0.22, SEED + 11) * 0.7
    # the breath of wind that carries the seed in (3.33 - 4.17)
    gust = np.clip(gust + ease([(2.4, 0.0), (3.2, 0.4), (3.9, 0.75), (4.4, 0.2), (5.4, 0.0)]), 0, 1)
    sig = low * (0.6 + 0.5 * gust) + air * (0.08 + 0.5 * gust ** 1.5)
    level = ease([(1.9, 0.0), (2.6, 0.6), (5.0, 0.56), (beat(15), 0.62), (beat(24), 0.3), (beat(26.5), 0.24),
                  (beat(29.5), 0.2), (43.0, 0.26), (beat(58), 0.34), (beat(63), 0.44), (56.0, 0.4), (59.0, 0.2),
                  (DUR, 0.0)])
    sway = 0.12 * wander(0.15, SEED + 12, -1, 1)
    st.x = sig * level * np.stack([1 + sway, 1 - sway]) * 0.075
    st.done()


def v_hum(mix):
    st = Stem(mix, "hum D2", send=0.05)
    f = hz("D2")
    level = ease([(2.0, 0.0), (3.8, 0.8), (beat(17), 0.8), (beat(26.5), 1.0), (beat(31), 0.8), (40.0, 0.6),
                  (beat(58), 0.66), (beat(63), 0.7), (59.0, 0.45), (DUR, 0.0)])
    breathe = 1.0 + 0.08 * np.sin(2 * np.pi * 0.11 * T)
    ph = 2 * np.pi * f * T
    x = 0.45 * np.sin(ph) + 0.6 * np.sin(2 * ph + 0.5) + 0.3 * np.sin(3 * ph + 1.2) + 0.12 * np.sin(4 * ph + 2.0)
    st.x[:] = x * level * breathe * 0.07
    st.done()


def pad_cutoff():
    pts = [(beat(3), 650), (beat(15), 600), (beat(24), 950), (beat(36), 1100), (beat(42), 1150), (beat(52), 1300)]
    # the low-pass opens a step each beat as the days pass, and wide for the pull-back
    for k, f in enumerate((1450, 1700, 1950, 2200)):
        tk = beat(54 + 2 * k)
        pts += [(tk, pts[-1][1]), (tk + 0.3, f)]
    pts += [(beat(63), 2200), (beat(63) + 0.4, 2600), (beat(68), 2400), (DUR, 1200)]
    return ease(pts)


SETTLE_DIM = [(beat(68), 1.0), (58.0, 0.85)]


def v_pad(mix):
    st = Stem(mix, "pad", send=0.45)
    fc = pad_cutoff()
    times = [c[0] for c in PAD_CHORDS] + [DUR + 0.5]
    pitches = sorted({p for _, ch in PAD_CHORDS for p in ch}, key=hz)
    seed = 300
    for p in pitches:
        runs, cur = [], None
        for i, (t0, ch) in enumerate(PAD_CHORDS):
            if p in ch:
                cur = [t0, times[i + 1]] if cur is None else [cur[0], times[i + 1]]
            elif cur is not None:
                runs.append(cur)
                cur = None
        if cur is not None:
            runs.append(cur)
        f = hz(p)
        amp = 1.0 if f < 200 else 0.8 if f < 400 else 0.6
        for s, e in runs:
            seed += 1
            pad_note(st, f, s, e, att=2.0 if s == PAD_START else 0.7, rel=0.9, amp=amp, fc=fc, seed=seed,
                     pan=0.25 * np.sin(seed))
    for p, pan in (("A4", -0.3), ("E5", 0.3)):        # the pull-back, the widest moment
        seed += 1
        pad_note(st, hz(p), beat(63), beat(69), att=1.5, rel=1.2, amp=0.35, fc=fc, seed=seed, pan=pan)
    st.x *= 0.085 * ease([(0, 1.0), (beat(24), 1.0), (beat(25), 0.85), (beat(52), 0.85), (beat(63), 1.0)] +
                         SETTLE_DIM + [(59.0, 0.6), (DUR, 0.0)])
    st.done()


def v_epiano(mix):
    st = Stem(mix, "e-piano", send=0.30)
    seed = 500
    for j, (b, chord, vel) in enumerate(EP_STRIKES):
        t0 = beat(b)
        nxt = beat(EP_STRIKES[j + 1][0]) if j + 1 < len(EP_STRIKES) else t0 + 6.0
        dur = min(nxt - t0 + 0.6, 7.0)
        for k, name in enumerate(EP_VOICING[chord]):
            seed += 1
            st.put(epiano_note(hz(name), vel * (1.0 - 0.06 * k), dur, seed), t0,
                   pan=-0.2 + 0.1 * k, gain=0.152)
    trem = 0.13 * np.sin(2 * np.pi * 3.1 * T)
    st.x[0] *= 1 + trem
    st.x[1] *= 1 - trem
    st.x = lp(st.x, 4200)
    st.x *= ease([(0, 1.0), (beat(66), 1.0), (58.0, 0.0)])
    st.done()


def v_plucks(mix):
    st = Stem(mix, "kalimba plucks", send=0.35)
    r = rng(6)
    for b, name, vel in PLUCKS:
        pan = 0.0 if b in (2.5, 68) else r.uniform(-0.3, 0.3)
        st.put(kalimba(hz(name), vel, 600 + int(b * 2)), beat(b), pan=pan, gain=0.21)
    st.done()


def v_bells(mix):
    st = Stem(mix, "bells", send=0.5)
    for b, name, vel in ((17, "D4", 0.72), (40, "D5", 0.62), (63, "D4", 0.74)):
        st.put(bell(hz(name), vel, 700 + b), beat(b), gain=0.19)
    st.done()


def v_marimba(mix):
    st = Stem(mix, "marimba", send=0.3)
    st.put(marimba(hz("A3"), 0.9, 801), beat(31), pan=-0.12, gain=0.185)
    st.done()


def v_foley(mix):
    st = Stem(mix, "ticks and scoops", send=0.12)
    for k, b in enumerate((0.5, 1, 1.5, 2)):                                           # the name, typed
        st.put(tick(2600 + 120 * k, 0.45, 880 + k, band=(2000, 6000)), beat(b), pan=-0.35, gain=0.10)
    st.put(tick(1500, 0.55, 904, body_tau=0.01, band=(800, 3000)), beat(6), pan=0.1, gain=0.12)  # planted
    for k, name in enumerate(("D6", "E6", "F#6")):                                     # the hollow, dug
        st.put(dig_tick(hz(name), 0.75 + 0.05 * k, 905 + k), beat(9 + k), pan=-0.2, gain=0.15)
        st.put(scratch(0.7, 920 + k), beat(9.5 + k), pan=0.2, gain=0.12)
    st.put(scoop(0.9, 910), beat(35), pan=-0.25, gain=0.30)                            # into the cave
    for k in range(4):                                                                 # the shaft
        st.put(scratch(0.8 - 0.05 * k, 930 + k), beat(36 + k), pan=0.25, gain=0.13)
    # a soft pour at each beat once the loop runs (under the knock), thinning out
    for b in range(48, 52):
        st.put(scoop(0.35 - 0.05 * (b - 48), 940 + b), beat(b) + 0.21, pan=0.3, gain=0.18)
    st.done()


def v_knocks(mix):
    st = Stem(mix, "wooden knocks", send=0.2)
    st.put(knock(hz("D4"), 0.8, 1010), beat(14), pan=-0.1, gain=0.3)                  # the plank
    for n, name in enumerate(KNOCK_NOTES):                                             # the wheel, built
        st.put(knock(hz(name), 0.95 if n == 1 else 0.8 + 0.02 * n, 1000 + n), beat(42 + n / 2), pan=0.2 + 0.04 * (n % 2), gain=0.34 if n == 1 else 0.3)
    st.put(knock(hz("D5"), 0.85, 1020), beat(44), pan=0.15, gain=0.3)                 # the water starts it
    st.put(knock(hz("E5"), 0.75, 1021), beat(47.5), pan=0.3, gain=0.26)               # the trough
    # the wheel turning: a soft knock a beat, slowing and stopping as the afternoon's water runs out at dusk
    b, k = 45.0, 0
    while b < 58.0:
        if b != 47.5:
            st.put(knock(hz(("A4", "B4", "D5")[k % 3]), 0.42 * (1 - (b - 45) / 16), 1030 + k), beat(b),
                   pan=0.2, gain=0.2)
        b += 1.0 if b < 54 else 1.5
        k += 1
    st.done()


def v_glass(mix):
    st = Stem(mix, "glassy ticks", send=0.45)
    for k, (b, name, pan, vel) in enumerate(((15, "F#6", -0.2, 0.7), (24, "A6", 0.1, 0.5), (29.5, "D6", 0.25, 0.6),
                                             (30.5, "E6", 0.3, 0.55), (49, "A6", 0.0, 0.5))):
        st.put(glass(hz(name), vel, 1100 + k), beat(b), pan=pan, gain=0.17)
    # a tiny high tick for each cap that lights in the cave as the days pass
    r = rng(12)
    for k in range(5):
        tb = beat(52.5 + k * 0.7) + r.uniform(0.05, 0.25)
        if clear_of_accents(tb, 0.15, 0.08):
            st.put(glass(hz(("B6", "A6", "F#6", "D7", "E6")[k]), 0.3, 1150 + k), tb, pan=-0.4 + 0.2 * k, gain=0.12)
    st.done()


def v_rain(mix):
    """12.5 - 20: soft rain, a hiss of filtered noise and scattered drops, swelling and easing."""
    st = Stem(mix, "rain", send=0.25)
    r = rng(10)
    c = r.standard_normal(N)
    hiss = lp(bp(np.stack([0.75 * c + 0.66 * r.standard_normal(N), 0.75 * c + 0.66 * r.standard_normal(N)]),
                 1800, 6500), 6500, order=4) / 0.36
    rate = ease([(beat(15), 30.0), (beat(17), 220.0), (beat(23), 220.0), (beat(24), 20.0), (DUR, 20.0)])
    for ch in range(2):
        hiss[ch] *= 0.5 + 0.5 * grain_env(rate, SEED + 61 + ch, rise=0.004, decay=0.012)
    env = ease([(beat(15), 0.0), (beat(15) + 0.4, 0.25), (beat(17), 0.8), (beat(23), 0.8), (beat(24) + 0.3, 0.0)])
    st.x = hiss * env * 0.03
    st.done()


def v_trickle(mix):
    send = ease([(beat(17), 0.25), (beat(31), 0.35), (beat(52), 0.5), (DUR, 0.5)])
    st = Stem(mix, "trickle", send=send)
    r = rng(4)
    c = r.standard_normal(N)
    nz = np.stack([0.85 * c + 0.53 * r.standard_normal(N), 0.85 * c + 0.53 * r.standard_normal(N)])
    hi_b = bp(nz, 1100, 3400) / 0.3
    mid_b = bp(nz, 520, 1500) / 0.22
    low_b = bp(nz, 240, 760) / 0.15
    # the hollow filling (bright), the stair running down to the cave (rounder), the wheel's water (deeper)
    wh = ease([(beat(17), 1.0), (beat(22), 0.6), (beat(31), 0.9), (beat(35), 0.4), (beat(44), 0.3)])
    wm = ease([(beat(17), 0.3), (beat(22), 0.4), (beat(31), 1.0), (beat(35), 1.0), (beat(44), 0.8)])
    wl = ease([(beat(17), 0.1), (beat(31), 0.2), (beat(35), 0.8), (beat(44), 1.0), (beat(52), 0.8)])
    flick = np.stack([0.45 + 0.55 * wander(14.0, SEED + 41) ** 2, 0.45 + 0.55 * wander(14.0, SEED + 42) ** 2])
    body = (wh * hi_b + wm * mid_b + 1.2 * wl * low_b) * flick * 0.5
    rate = ease([(beat(17), 0.0), (beat(18), 14.0), (beat(23), 6.0), (beat(31), 16.0), (beat(35), 9.0),
                 (beat(44), 8.0), (beat(52), 4.0), (beat(58), 2.0), (beat(63), 0.0)])
    pitch = ease([(beat(17), 1.0), (beat(31), 0.85), (beat(35), 0.6), (beat(44), 0.5)])
    pan = ease([(beat(17), -0.3), (beat(26), -0.1), (beat(31), 0.0), (beat(35), -0.3), (beat(44), 0.15)])
    bub = np.zeros((2, N))
    tb = beat(17)
    while True:
        tb += r.exponential(1.0 / 20.0)
        if tb >= beat(63):
            break
        i = int(tb * SR)
        if r.uniform() > rate[i] / 20.0 or not clear_of_accents(tb, 0.15, 0.08):
            continue
        f0 = pitch[i] * r.uniform(700, 1900)
        d = r.uniform(0.018, 0.04)
        tt = np.arange(int(d * SR)) / SR
        ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.8 * (tt / d) ** 1.3)) / SR
        y = oneshot(np.sin(ph) * np.exp(-tt / (0.4 * d)), att=0.005, tail=0.005) * r.uniform(0.2, 1.0) ** 2
        gl, gr = pan_gains(pan[i] + r.uniform(-0.25, 0.25))
        m = min(len(y), N - i)
        bub[0, i:i + m] += y[:m] * gl
        bub[1, i:i + m] += y[:m] * gr
    level = ease([(beat(16), 0.0), (beat(17), 0.6), (beat(21), 0.9), (beat(24), 0.5), (beat(29), 0.5),
                  (beat(31), 0.95), (beat(35), 0.85), (beat(39), 0.5), (beat(44), 0.85), (beat(52), 0.6),
                  (beat(58), 0.35), (beat(63), 0.0)])
    gl, gr = pan_gains(pan)
    st.x = (body * np.stack([gl, gr]) + 0.35 * bub) * level * 0.1
    st.done()


def v_rustle(mix):
    st = Stem(mix, "leaf rustle", send=0.2)
    r = rng(5)
    c = r.standard_normal(N)
    leaf = bp(np.stack([0.8 * c + 0.6 * r.standard_normal(N), 0.8 * c + 0.6 * r.standard_normal(N)]), 1800, 6000) / 0.4
    rate = ease([(beat(25), 25), (beat(52), 55), (beat(56), 110), (beat(60), 55), (beat(63), 30), (DUR, 20)])
    shared = grain_env(rate, SEED + 50, rise=0.005, decay=0.035)
    for ch in range(2):
        m = (0.6 * shared + 0.4 * grain_env(rate, SEED + 51 + ch, rise=0.005, decay=0.035)) / (rate / rate.mean())
        leaf[ch] *= 0.3 + m
    level = ease([(beat(25), 0.0), (beat(27), 0.3), (beat(52), 0.45), (beat(55), 0.9), (beat(60), 0.6),
                  (beat(63), 0.3), (57.0, 0.0)])
    st.x = leaf * level * 0.017
    st.done()


def v_brushes(mix):
    st = Stem(mix, "brushes", send=0.15)
    r = rng(7)
    for b in range(52, 63):
        if b % 2 == 1:                                      # the off-beats, while the days pass
            st.put(brush(0.8 + 0.2 * r.uniform(), 1200 + b), beat(b), pan=0.15, gain=0.07)
    st.done()


def v_insects(mix):
    st = Stem(mix, "insect hum", send=0.25)
    for f0, t0, t1, p0, p1, seed in ((205, 37.0, 43.0, -0.4, 0.2, 61), (232, 43.6, 47.6, 0.5, -0.1, 62),
                                     (188, 44.5, 48.4, 0.0, 0.4, 63)):
        r = np.random.default_rng(SEED + seed)
        n = int((t1 - t0) * SR)
        tt = np.arange(n) / SR
        fm = f0 * (1 + 0.03 * np.sin(2 * np.pi * 0.8 * tt + r.uniform(0, 6.3))
                   + 0.012 * np.sin(2 * np.pi * 5.3 * tt + r.uniform(0, 6.3)))
        ph = 2 * np.pi * np.cumsum(fm) / SR
        x = sum(np.sin(k * ph) / k for k in range(1, 15) if k * f0 < 3200)
        x = bp(x, 250, 2600)
        env = smooth01(tt / 1.0) * smooth01((tt[-1] - tt) / 1.0)
        env *= 0.5 + 0.5 * PchipInterpolator(np.linspace(0, tt[-1], 12), r.uniform(0, 1, 12))(tt)
        gl, gr = pan_gains(p0 + (p1 - p0) * tt / tt[-1])
        st.put(np.stack([x * env * gl, x * env * gr]), t0, gain=0.0155)
    st.done()


def v_crickets(mix):
    st = Stem(mix, "crickets", send=0.3)
    r = rng(8)
    pulse_n = int(0.014 * SR)
    hann = np.hanning(pulse_n)                       # 7 ms rise
    specs = [(4400, -0.45, 0.74, 1.0, beat(58), 3), (4750, 0.40, 0.91, 0.75, 49.15, 3),
             (4100, 0.10, 1.13, 0.6, 50.6, 4), (5000, -0.15, 0.83, 0.5, 52.0, 3), (4550, 0.6, 1.02, 0.45, 53.4, 2)]
    level = ease([(beat(58), 1.0), (beat(63), 1.1), (58.0, 0.9), (59.6, 0.0)])
    for f, pan, period, g, t, pulses in specs:
        first = True
        while t < 59.6:
            if first or clear_of_accents(t, 0.12, 0.05):
                for k in range(pulses):
                    tp = t + k * 0.034
                    tt = np.arange(pulse_n) / SR
                    y = np.sin(2 * np.pi * f * (tt + tp)) * hann * g * level[int(tp * SR)]
                    st.put(y, tp, pan=pan, gain=0.07)
            first = False
            t += period * (1 + r.uniform(-0.06, 0.06))
    st.done()


def v_birds(mix):
    st = Stem(mix, "birds", send=0.3)
    st.put(bird_call([(3600, 2500), (3350, 2300), (3100, 2100)], 1301), beat(24.5), pan=0.3, gain=0.13)
    st.put(bird_call([(3800, 2600), (3500, 2400), (3200, 2200)], 1302), beat(51.5), pan=0.25, gain=0.12)
    st.done()
    far = Stem(mix, "distant birds", send=0.7)
    for t0, pan, seed, k in ((22.6, -0.5, 1303, 0.0), (44.6, 0.55, 1304, 0.08), (46.9, -0.2, 1305, 0.04)):
        far.put(lp(bird_call([(3300 - 200 * k, 2300), (3100, 2150), (2900, 2000)], seed), 3500), t0, pan=pan,
                gain=0.06)
    far.done()


def v_breath(mix):
    """52.5: a soft breath of filtered noise under the bell as the camera pulls back."""
    st = Stem(mix, "breath", send=0.3)
    r = rng(9)
    n = int(2.0 * SR)
    tt = np.arange(n) / SR
    y = lp(bp(r.standard_normal((2, n)), 500, 2400), 2000) / 0.3
    env = smooth01(tt / 0.6) * np.exp(-np.maximum(tt - 0.6, 0) / 0.5)
    st.put(oneshot(y * env, att=0.3, tail=0.3), beat(63) + 0.05, gain=0.05)
    st.done()


VOICES = [v_wind, v_hum, v_pad, v_epiano, v_plucks, v_bells, v_marimba, v_foley, v_knocks, v_glass, v_rain,
          v_trickle, v_rustle, v_brushes, v_insects, v_crickets, v_birds, v_breath]


def make_ir(seed):
    r = np.random.default_rng(SEED + seed)
    n = int(2.6 * SR)
    tt = np.arange(n) / SR
    ir = lp(r.standard_normal(n), 1800) * np.exp(-tt / 0.33) + 0.5 * bp(r.standard_normal(n), 1800, 6000) * np.exp(
        -tt / 0.15)
    ir[:int(0.012 * SR)] *= rcos(int(0.012 * SR))
    ir = np.concatenate([np.zeros(int(0.015 * SR)), ir])
    return ir / np.sqrt((ir ** 2).sum())


def limit(x, ceiling_db):
    """Look-ahead peak limiter on the 4x-oversampled peak. Gain only, so nothing moves in time."""
    ceil = 10 ** (ceiling_db / 20)
    from scipy.ndimage import minimum_filter1d
    for _ in range(4):
        pk = np.abs(resample_poly(x, 4, 1, axis=1)).max(axis=0)[:4 * N].reshape(N, 4).max(axis=1)
        need = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
        if need.min() >= 0.999:
            return x
        g = minimum_filter1d(need, size=int(0.012 * SR) + 1)
        k = np.hanning(int(0.010 * SR))
        g = np.minimum(1.0, np.convolve(g, k / k.sum(), mode="same"))
        x = x * g * 0.995
    return x


def render():
    mix = Mix()
    for v in VOICES:
        v(mix)
        print(f"  rendered {v.__name__[2:]}", flush=True)
    wet = np.stack([fftconvolve(mix.send[c], make_ir(70 + c))[:N] for c in range(2)])
    out = mix.dry + WET * wet
    out = lp(hp(out, 50), 8000, order=6)              # no sub rumble, nothing harsh on top; also removes DC
    gain_db = TARGET_LUFS - integrated_lufs(out)
    MASTER["gain_db"] = gain_db
    out *= 10 ** (gain_db / 20)
    if true_peak_db(out) > TP_CEILING:
        out = limit(out, TP_CEILING)
        out *= 10 ** ((TARGET_LUFS - integrated_lufs(out)) / 20)
        out = limit(out, TP_CEILING)
    nf = int(0.5 * SR)                                 # the last 0.5 s fades to exact silence at 60.000
    out[:, -nf:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, nf + 1) / nf)
    r = rng(99)                                        # TPDF dither, silent where the signal is silent
    mask = (T >= 0.2) * np.concatenate([np.ones(N - nf), 0.5 + 0.5 * np.cos(np.pi * np.arange(1, nf + 1) / nf)])
    d = (r.uniform(-0.5, 0.5, (2, N)) + r.uniform(-0.5, 0.5, (2, N))) * mask
    pcm = np.clip(np.round(out * 32767 + d), -32768, 32767).astype(np.int16)
    wavfile.write(WAV, SR, pcm.T.copy())
    return mix.stats, gain_db


# ------------------------------------------------------------------------------------------ checks

BANDS = [(150, 450), (300, 900), (600, 1800), (1200, 3200), (2200, 5200), (3800, 7500)]


def envelope(x, a, b, lo, hi):
    y = sosfiltfilt(butter(3, [lo, hi], "bandpass", fs=SR, output="sos"), x[a:b])
    k = np.hanning(int(0.003 * SR) + 1)                 # 3 ms, zero-phase
    return np.convolve(np.abs(hilbert(y)), k / k.sum(), mode="same")


def measure(x, tc, t_prev, snip=None):
    """Onset of the accent at tc in the mono signal x.

    Band: the one where the attack of the accent's own sound (snip: everything the generator started within
    25 ms of the cue, at the master gain; its first 30 ms) is strongest against what was already playing
    just before the cue. In that band, on a 3 ms zero-phase envelope: bg is the pre-cue level (90th
    percentile), P the accent's level (90th percentile over the 15 ms after the cue), and the onset is the
    first time from 20 ms before the cue that the envelope rises through bg + 20 % of (P - bg) and the
    following 10 ms average more than bg + 40 % of (P - bg). So a chord's beating dips after the attack
    can't push the onset late, and a flicker in the bed before the cue can't pull it early."""
    a, b = max(0, int((tc - 1.0) * SR)), min(len(x), int((tc + 0.7) * SR))
    c = int(tc * SR) - a
    pre = 0.25 if t_prev is None else min(0.25, max(0.05, tc - t_prev - 0.02))
    pw = slice(c - int(pre * SR), c - int(0.008 * SR))
    best = None
    for lo, hi in BANDS:
        sos = butter(3, [lo, hi], "bandpass", fs=SR, output="sos")
        y = sosfiltfilt(sos, x[a:b])
        if snip is not None:
            score = np.mean(sosfilt(sos, snip)[:int(0.03 * SR)] ** 2) / (np.mean(y[pw] ** 2) + 1e-20)
        else:
            e = envelope(x, a, b, lo, hi)
            score = e[c: c + int(0.04 * SR)].max() / (np.percentile(e[pw], 90) + 1e-9)
        if best is None or score > best[0]:
            best = (score, lo, hi)
    score, lo, hi = best
    e = envelope(x, a, b, lo, hi)
    bg = np.percentile(e[pw], 90) + 1e-9
    P = np.percentile(e[c:c + int(0.015 * SR)], 90)
    thr, thr2 = bg + 0.2 * (P - bg), bg + 0.4 * (P - bg)
    w = int(0.01 * SR)
    j = c - int(0.02 * SR)
    while j < c + int(0.04 * SR) and not (e[j] >= thr and e[j:j + w].mean() >= thr2):
        j += 1
    k = j + int(np.argmax(e[j:j + int(0.03 * SR)]))
    return (a + j) / SR, (a + k) / SR, 20 * np.log10(P / np.median(e[pw])), (lo, hi)


def ebur128(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True)
    s = p.stderr[p.stderr.rfind("Summary:"):]
    get = lambda key: float(re.search(key + r":\s+(-?[\d.]+)", s).group(1))
    return get("I"), get("LRA"), get("Peak")


def edit_list(path):
    """The MP4 edit list: how many priming samples a player is told to skip at the start."""
    b = Path(path).read_bytes()
    i = b.find(b"elst")
    if i < 0:
        return None
    v1 = b[i + 4] == 1
    count = int.from_bytes(b[i + 8:i + 12], "big")
    if v1:
        seg, media = int.from_bytes(b[i + 12:i + 20], "big"), int.from_bytes(b[i + 20:i + 28], "big", signed=True)
    else:
        seg, media = int.from_bytes(b[i + 12:i + 16], "big"), int.from_bytes(b[i + 16:i + 20], "big", signed=True)
    return count, seg, media


def decode(path):
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                       capture_output=True)
    return np.frombuffer(p.stdout, np.float32).reshape(-1, 2).T.astype(float)


def plots(x, rows):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy.signal import spectrogram

    mono = x.mean(axis=0)
    f, tt, S = spectrogram(mono, fs=SR, window="hann", nperseg=4096, noverlap=4096 - 480, mode="magnitude")
    db = 20 * np.log10(S + 1e-10)
    db = np.maximum(db, db.max() - 90)
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(20, 9), sharex=True, gridspec_kw=dict(height_ratios=[3, 1]))
    keep = (f >= 30) & (f <= 16000)
    ax.pcolormesh(tt, f[keep], db[keep], shading="auto", cmap="magma")
    ax.set_yscale("log")
    ax.set_ylim(30, 16000)
    ax.axhline(8000, color="w", lw=0.5, ls="--")
    for _, t0, _ in CUES:
        ax.axvline(t0, color="c", lw=0.4, alpha=0.6)
    ax.set_ylabel("Hz")
    ax.set_title("silt-film.wav: spectrogram (cyan: scripted cues; dashed: 8 kHz)")
    p = kweight(x) ** 2
    w = int(0.4 * SR)
    hop = int(0.05 * SR)
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(p, axis=1)], axis=1)
    st = np.arange(0, N - w, hop)
    mom = -0.691 + 10 * np.log10(((cs[:, st + w] - cs[:, st]) / w).sum(0) + 1e-12)
    ax2.plot((st + w / 2) / SR, mom, lw=0.8)
    ax2.set_ylim(-60, -5)
    ax2.axhline(TARGET_LUFS, color="k", lw=0.5, ls="--")
    for _, t0, _ in CUES:
        ax2.axvline(t0, color="c", lw=0.4, alpha=0.6)
    ax2.set_ylabel("momentary LUFS")
    ax2.set_xlabel("s")
    ax2.set_xlim(0, DUR)
    ax2.set_xticks(np.arange(0, 61, 2))
    fig.tight_layout()
    fig.savefig(PNG, dpi=90)
    plt.close(fig)

    cols = 7
    nrow = int(np.ceil(len(rows) / cols))
    fig, axs = plt.subplots(nrow, cols, figsize=(20, 2.3 * nrow))
    for axc, (label, tc, on, pk, snr, band) in zip(axs.flat, rows):
        a, b = int((tc - 0.15) * SR), int((tc + 0.15) * SR)
        padded = np.pad(mono, (SR, SR))                 # a cue near the start or end still has a second each side
        e = envelope(padded, a, b + 2 * SR, *band)[SR:SR + (b - a)]
        axc.plot((np.arange(a, b) / SR - tc) * 1000, 20 * np.log10(e + 1e-9), lw=0.7)
        axc.axvline(0, color="r", lw=0.6)
        axc.axvline((on - tc) * 1000, color="g", lw=0.6, ls="--")
        axc.set_title(f"{label}  {tc:.3f}s  {band[0]}-{band[1]}Hz", fontsize=7)
        axc.tick_params(labelsize=6)
    for axc in list(axs.flat)[len(rows):]:
        axc.axis("off")
    fig.suptitle("Envelope around each cue (ms from cue; red: cue time; green: measured onset)")
    fig.tight_layout()
    fig.savefig(PNG_CUES, dpi=80)
    plt.close(fig)


def check(encode):
    sr, pcm = wavfile.read(WAV)
    x = pcm.T.astype(float) / 32768.0
    print(f"\nwav: {WAV}\n  {sr} Hz, {x.shape[0]} ch, {x.shape[1]} samples = {x.shape[1] / sr:.6f} s, "
          f"DC {x.mean(axis=1)[0]:+.1e} / {x.mean(axis=1)[1]:+.1e}, "
          f"sample peak {20 * np.log10(np.abs(x).max()):.2f} dBFS, last sample {pcm[-1].tolist()}")
    I, LRA, TP = ebur128(WAV)
    print(f"  ffmpeg ebur128: I = {I:.1f} LUFS, LRA = {LRA:.1f} LU, true peak = {TP:.1f} dBTP")
    print(f"  our own meter: I = {integrated_lufs(x):.2f} LUFS, true peak = {true_peak_db(x):.2f} dBTP")
    f, tt_ = None, None
    from scipy.signal import welch
    f, P = welch(x.mean(axis=0), fs=SR, nperseg=8192)
    tot = P.sum()
    print(f"  energy above 8 kHz: {10 * np.log10(P[f > 8000].sum() / tot):.1f} dB of total; "
          f"below 50 Hz: {10 * np.log10(P[f < 50].sum() / tot):.1f} dB; below 90 Hz: "
          f"{10 * np.log10(P[f < 90].sum() / tot):.1f} dB")
    corr = np.corrcoef(x[0], x[1])[0, 1]
    mono_i = integrated_lufs(np.stack([x.mean(0), x.mean(0)])) - 3.01
    print(f"  stereo: L/R correlation {corr:.2f}; mono fold-down (L+R)/2 plays at {mono_i:.1f} LUFS "
          f"(as one channel)")
    d2 = np.abs(np.diff(x, 2, axis=1)).max(axis=0)
    print(f"  largest second difference (click check): {d2.max():.4f} at {np.argmax(d2) / SR:.3f} s")

    mono = x.mean(axis=0)
    dec = None
    if encode:
        SITE_M4A.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(WAV), "-c:a", "aac", "-b:a", "128k",
                        "-movflags", "+faststart", str(SITE_M4A)], check=True)
        pr = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                             "format=duration,start_time,size:stream=codec_name,sample_rate,channels,start_time,"
                             "duration,duration_ts", "-of", "default=nw=1", str(SITE_M4A)],
                            capture_output=True, text=True).stdout
        print(f"\nm4a: {SITE_M4A}\n  " + pr.strip().replace("\n", "\n  "))
        dec = decode(SITE_M4A)
        n = min(dec.shape[1], N)
        seg = slice(int(2 * SR), int(14 * SR))
        cc = fftconvolve(dec.mean(0)[seg], mono[seg][::-1], mode="full")
        lag = int(np.argmax(cc)) - (seg.stop - seg.start - 1)
        I2, _, TP2 = ebur128(SITE_M4A)
        el = edit_list(SITE_M4A)
        print(f"  edit list: {el[0]} entry, media_time {el[2]} samples skipped (the encoder's priming), "
              f"segment {el[1]} (movie timescale)" if el else "  edit list: none")
        tail = dec[:, N:]
        print(f"  decoded: {dec.shape[1]} samples = {dec.shape[1] / SR:.6f} s (past 60.000 s: "
              f"{tail.shape[1]} samples, peak {20 * np.log10(np.abs(tail).max() + 1e-12):.0f} dBFS); offset "
              f"against the wav (cross-correlation, 2-14 s): {lag} samples = {lag / SR * 1000:.2f} ms; "
              f"I = {I2:.1f} LUFS, true peak = {TP2:.1f} dBTP")
        dmono = dec.mean(axis=0)[:n]

    rows = []
    print("\n  cue  sheet    exact     onset(wav)  err ms   peak     onset(m4a) err ms   band Hz    rise dB  what")
    prev = None
    for i, (sheet, tc, label) in enumerate(sorted(CUES, key=lambda c: c[1])):
        snip = CUE_SNIPS.get(round(float(tc), 6))
        if snip is not None:
            snip = snip * 10 ** (MASTER["gain_db"] / 20)
        on, pk, snr, band = measure(mono, tc, prev, snip)
        s_m4a = ""
        if dec is not None:
            on2, _, _, _ = measure(dmono, tc, prev, snip)
            s_m4a = f"{on2:9.4f}  {(on2 - tc) * 1000:+6.1f}"
        print(f"  {i + 1:3d}  {sheet:7s} {tc:8.4f}  {on:9.4f}  {(on - tc) * 1000:+6.1f}  {pk:8.4f}  {s_m4a}   "
              f"{band[0]:4d}-{band[1]:<5d} {snr:5.1f}   {label}")
        rows.append((sheet, tc, on, pk, snr, band))
        prev = tc
    plots(x, rows)
    print(f"\n  plots: {PNG}\n         {PNG_CUES}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-encode", action="store_true")
    ap.add_argument("--check-only", action="store_true")
    args = ap.parse_args()
    if not args.check_only:
        stats, gain_db = render()
        names = list(stats)
        heads = [f"{a:.1f}" for a in SECTIONS[:-1]]
        print("\nbalance: K-weighted loudness of each voice by section, LUFS (dry, after the master gain)")
        print("  " + " " * 16 + "".join(f"{h:>7s}" for h in heads))
        for nm in names:
            vals = [(-0.691 + 10 * np.log10(e) + gain_db) if e > 0 else -99 for e in stats[nm]]
            print(f"  {nm:16s}" + "".join(f"{v:7.1f}" if v > -70 else "      ." for v in vals))
    check(not args.no_encode)


if __name__ == "__main__":
    main()
