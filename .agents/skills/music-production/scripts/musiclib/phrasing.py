"""Phrase expression for composition scripts: arched velocities, hairpins, swells on held notes, and a dynamics curve
for a part rendered from dynamic layers.

A phrase in performance rises toward a point near its middle or a little after and falls away at its end (Todd 1992;
the phrase-arch rule of the KTH system, Friberg, Bresin and Sundberg 2006); a long note is seldom held at one level,
players swelling into it and easing off before the next; and an orchestra's hairpins move whole sections together.
These helpers write that into a project's notes and `performance.dynamics` so the scripts that compose pieces share it.
They work on plain project dictionaries (schema.md) and return values; nothing is rendered here.
"""


def arch(position, peak=8.0, apex=0.6):
    """The velocity added at `position` (0 at the phrase's first onset, 1 at its end): 0 at the ends, `peak` at `apex`,
    linear on each side."""
    if position <= apex:
        return peak * position / apex if apex > 0 else peak
    return peak * (1 - position) / (1 - apex) if apex < 1 else peak


def ramp(points):
    """A function of the beat, linear between [beat, value] points and flat beyond them (a hairpin or a dynamic plan)."""
    pts = sorted(points)
    def at(beat):
        if beat <= pts[0][0]:
            return pts[0][1]
        for (b0, v0), (b1, v1) in zip(pts, pts[1:]):
            if beat <= b1:
                return v0 + (v1 - v0) * (beat - b0) / (b1 - b0) if b1 > b0 else v1
        return pts[-1][1]
    return at


def sing(notes, base, peak=8.0, apex=0.6):
    """Velocities for a melodic line, each note on `base(beat)` (a number or a function such as `ramp`) plus the arch
    over the line.  `notes` are (on, duration) pairs or project notes; returns one velocity per note."""
    spans = [(n['on'], n['duration']) if isinstance(n, dict) else (n[0], n[1]) for n in notes]
    if not spans:
        return []
    a, b = spans[0][0], spans[-1][0] + spans[-1][1]
    level = base if callable(base) else (lambda _: base)
    return [int(max(1, min(127, round(level(on) + arch((on - a) / max(b - a, 1e-9), peak, apex))))) for on, _ in spans]


def dynamics(track, swell=0.0, plan=None, long_beats=2.0):
    """A `performance.dynamics` curve for `track`: each onset at its loudest note's velocity and, inside every held
    span of `long_beats` or more, a swell of `swell` toward 45% of the span and an easing of half of it by 90%, both
    following `plan` (a function of the beat, such as `ramp`, giving the part's dynamic plan) where one is given.
    Returns the [beat, value] points; put them in `track['performance']['dynamics']`."""
    perf = track['performance']['notes']
    loud, ends = {}, {}
    for n in track['notes']:
        b = round(n['on'], 4)
        loud[b] = max(loud.get(b, 0), perf[n['id']]['velocity'])
        ends[b] = max(ends.get(b, 0), n['on'] + n['duration'])
    onsets = sorted(loud)
    points = {}
    for k, b in enumerate(onsets):
        v = loud[b]
        points[b] = v
        span = min(onsets[k + 1] if k + 1 < len(onsets) else ends[b], ends[b]) - b
        if span >= long_beats:
            for x, bump in ((.45, swell), (.9, -swell / 2)):
                beat = round(b + x * span, 4)
                drift = plan(beat) - plan(b) if plan else 0.0
                points.setdefault(beat, v + drift + bump)
    return [[b, int(max(1, min(127, round(v))))] for b, v in sorted(points.items())]


def near(points, centre, spread=12):
    """A curve kept within `spread` of `centre`: a solo held close to one recorded dynamic, so a crossfade between two
    takes of its notes never sits in the middle (in `dynamics_mode` "crossfade"; "take", the default, needs none of it)."""
    return [[b, int(max(1, min(127, round(min(centre + spread, max(centre - spread, v))))))] for b, v in points]
