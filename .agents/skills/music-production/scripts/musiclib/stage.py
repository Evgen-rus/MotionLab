"""Where a part sits on the stage (`mix.depth_m`): early reflections from its position and a wetter balance with depth.

The model is a shoebox hall, 24 m wide, 40 m long and 16 m high, the stage filling its first 12 m, heard from a main
microphone pair 4 m in front of the stage edge and 3.5 m up (two capsules 1 m apart, a little off the centre line),
as an orchestral recording is.  A part stands `depth_m` metres behind the first desks (1 m behind the stage edge, up to
10 m), across the stage by its pan (7 m at full pan), with the back rows on risers.  Image sources (Allen and Berkley
1979) up to the second order give its early reflections, each delayed and attenuated by its path and by the walls it
met, and darkened a little per reflection.  The reflections are high-passed at 250 Hz: their part in placing a
source lies in the mid and high frequencies, while below that specular images add up in phase into a boom and a comb
on the direct sound, and the low end of the room is the reverberation's.  The stage shell reflects most and the audience end least; the stage floor,
covered by players, chairs and stands, returns half; the side walls differ a little, as no hall is exactly symmetric,
so a centred part still reaches the two capsules with different reflections.  The direct sound keeps the part's pan
and arrives on time, so a back row does not drag; what moves with depth is the pattern of reflections (the first one
follows the direct sound sooner) and the share of the hall.

Listeners judge distance in a room mainly by the ratio of direct to reverberant sound, along with level (Zahorik
2002; Bronkhorst and Houtgast 1999).  Moving a source from d0 to d lowers that ratio by 20 log10(d / d0) dB; a
recording that mixes spot microphones with the main pair keeps about half of that, so a part's hall send rises by half
the distance loss.  The direct sound and its reflections are scaled to keep the part's dry energy, so `level_dbfs`
still sets its loudness.

A horn's bell points backward, away from the audience: in front of the player its sound above about 2 kHz is some
10 dB weaker than on the bell's axis, and much of what the hall hears comes off the wall behind (Meyer 2009, on the
directivity of orchestral instruments).  With `facing: "back"` the direct sound and the reflections that leave the
player toward the hall lose about 4 dB toward the top (a first-order shelf from 2 kHz), while the reflections off the stage shell, which the
bell faces, come back 6 dB stronger; the part keeps its dry energy as before, so it sounds further and darker, not
quieter.
"""
import math

import numpy as np

from .measure import fast_length

RATE = 48000
SOUND = 343.0
HALL = (24.0, 40.0, 16.0)          # width (x), length (y), height (z); walls at x = 0 and 24, y = 0 (stage shell) and 40
WALLS = ((.85, .78), (.9, .6), (.5, .85))  # pressure reflection factors: (lower, upper) wall of each axis
STAGE_EDGE, MIC_X, MIC_Y, MIC_Z, MIC_GAP = 12.0, 12.3, 16.0, 3.5, 1.0


def source(pan, depth):
    """Stage position of a part: across by its pan, `depth` metres behind the first desks, back rows on risers."""
    return (HALL[0] / 2 + 7.0 * pan, max(1.0, STAGE_EDGE - 1.0 - depth), 1.2 + (.5 if depth >= 6 else 0.0))


def mics():
    return [(MIC_X + side * MIC_GAP / 2, MIC_Y, MIC_Z) for side in (-1, 1)]


def distance(a, b):
    return math.dist(a, b)


def images(src, order=2):
    """Image sources up to `order` reflections: (position, reflection factor, order)."""
    out = []
    axes = []
    for axis in range(3):
        opts = []
        for n in (-1, 0, 1):
            for q in (0, 1):
                lower, upper = abs(n - q), abs(n)
                pos = (1 - 2 * q) * src[axis] + 2 * n * HALL[axis]
                opts.append((pos, WALLS[axis][0] ** lower * WALLS[axis][1] ** upper, lower + upper))
        axes.append(opts)
    for x in axes[0]:
        for y in axes[1]:
            for z in axes[2]:
                k = x[2] + y[2] + z[2]
                if 1 <= k <= order:
                    out.append(((x[0], y[0], z[0]), x[1] * y[1] * z[1], k))
    return out


def _shelf(freqs, corner=2000.0, cut_db=-8.0):
    """A first-order high shelf: unity at low frequencies, falling to half of `cut_db` (-4 dB for the default) well above
    `corner`."""
    g = 10 ** (cut_db / 20)
    return (1 + 1j * freqs / (corner / math.sqrt(g)) * math.sqrt(g)) / (1 + 1j * freqs / (corner / math.sqrt(g)))


def reflections(pan, depth, length=int(.3 * RATE), facing='front'):
    """Early reflections at the left and right capsule relative to the direct sound (amplitude 1 at the pair's
    centre): an array (length, 2), each order darkened by a first-order low-pass (8 kHz, then 5 kHz), all of them
    high-passed at 250 Hz (second order)."""
    src = source(pan, depth)
    centre = (MIC_X, MIC_Y, MIC_Z)
    direct = distance(src, centre)
    out = np.zeros((length, 2))
    by_order = {1: np.zeros((length, 2)), 2: np.zeros((length, 2))}
    away = {1: np.zeros((length, 2)), 2: np.zeros((length, 2))}  # with facing "back": paths leaving the bell sideways
    for ch, mic in enumerate(mics()):
        for pos, factor, k in images(src):
            d = distance(pos, mic)
            delay = (d - direct) / SOUND * RATE
            if delay <= 0 or delay >= length - 1:
                continue
            i, frac = int(delay), delay - int(delay)
            amp = factor * direct / d
            shell = pos[1] < 0  # reached the pair off the stage shell, the wall a backward-facing bell points at
            if facing == 'back' and shell:
                amp *= 2.0
            target = by_order[k] if facing != 'back' or shell else away[k]
            target[i, ch] += amp * (1 - frac)
            target[i + 1, ch] += amp * frac
    freqs = np.fft.rfftfreq(length, 1 / RATE)
    high = ((1j * freqs / 250.0) / (1 + 1j * freqs / 250.0)) ** 2
    for k, cutoff in ((1, 8000.0), (2, 5000.0)):
        spec = np.fft.rfft(by_order[k], axis=0) * (high / (1 + 1j * freqs / cutoff))[:, None]
        if facing == 'back':
            spec += np.fft.rfft(away[k], axis=0) * (high / (1 + 1j * freqs / cutoff) * _shelf(freqs))[:, None]
        out += np.fft.irfft(spec, n=length, axis=0)
    return out


def send_boost_db(pan, depth):
    """How much more hall a part at `depth` gets than one at the first desks: half the distance loss."""
    centre = (MIC_X, MIC_Y, MIC_Z)
    return 10 * math.log10(distance(source(pan, depth), centre) / distance(source(pan, 0.0), centre))


def place(x, pan, depth, facing='front'):
    """A stereo stem (frames, 2) placed at `depth`: its pan on the direct sound, the reflections from the mono sum,
    scaled so the result keeps the energy of the panned direct sound alone (with `facing` "back", of the direct sound
    before its shelf)."""
    x = np.asarray(x, dtype=np.float64)
    g = np.array([math.sqrt(1 - pan), math.sqrt(1 + pan)])
    er = reflections(pan, depth, facing=facing)
    direct = x * g[None, :]
    e_ref = float(np.sum(direct ** 2))
    if facing == 'back':
        m = fast_length(len(x))
        spec = np.fft.rfft(direct, n=m, axis=0) * _shelf(np.fft.rfftfreq(m, 1 / RATE))[:, None]
        direct = np.fft.irfft(spec, n=m, axis=0)[:len(x)]
    mid = x.mean(axis=1)
    m = fast_length(len(x) + len(er))
    spec = np.fft.rfft(mid, n=m)
    wet = np.stack([np.fft.irfft(spec * np.fft.rfft(er[:, ch], n=m), n=m)[:len(x)] for ch in range(2)], axis=1)
    e_direct, e_wet = float(np.sum(direct ** 2)), float(np.sum(wet ** 2))
    norm = math.sqrt(e_ref / (e_direct + e_wet)) if e_direct + e_wet > 0 else 1.0
    return ((direct + wet) * norm).astype(np.float32), {'reflection_share_db': round(10 * math.log10(max(e_wet, 1e-30) / max(e_direct, 1e-30)), 2),
                                                         'first_reflection_ms': first_reflection_ms(pan, depth),
                                                         'hall_send_boost_db': round(send_boost_db(pan, depth), 2)}


def first_reflection_ms(pan, depth):
    src = source(pan, depth)
    direct = distance(src, (MIC_X, MIC_Y, MIC_Z))
    return round(1000 * min(distance(pos, (MIC_X, MIC_Y, MIC_Z)) - direct for pos, _, _ in images(src, 1)) / SOUND, 2)
