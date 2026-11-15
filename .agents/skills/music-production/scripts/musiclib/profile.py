"""Score descriptors of a project: what the notes do, never whether they are good.

After Yang and Lerch, "On the evaluation of generative models in music" (Neural Computing and Applications 32, 2020):
simple, reproducible measures of the written score, meant for comparing sets of pieces, for instance two versions of
the skill writing for the same requests.  Per part: note count and density, register, pitch-class use and entropy, the
melodic intervals of its top line, inter-onset intervals, note lengths, off-beat onsets, bar-to-bar rhythm repetition,
recurring melodic cells, velocity spread and polyphony.  Per section: every part's density, the distinct onsets per
second of the pitched parts together (the tempo measure of Eerola, Friberg and Bresin 2013), the melody's register, and
the melody's phrases (`melody_in`): the longest run without a breath, leaps, bars that restate an earlier one, the peak.
Times are written beats (quarter notes); performance timing is ignored, velocities come from the performance.
"""
import math
import statistics
from collections import Counter
from fractions import Fraction

from .model import Clock

NAMES = ('C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B')
STEPS = 12  # grid divisions per beat: sixteenths and triplets both land on it


def name(pitch):
    return f'{NAMES[pitch % 12]}{pitch // 12 - 1}'


def tick(beats):
    return round(beats * STEPS)


def beats_label(ticks):
    f = Fraction(ticks, STEPS)
    return str(f.numerator) if f.denominator == 1 else f'{f.numerator}/{f.denominator}'


def share(counter, total, top=4):
    return {beats_label(k): round(100 * v / total, 1) for k, v in counter.most_common(top)} if total else {}


def entropy_bits(counter):
    total = sum(counter.values())
    return round(-sum(v / total * math.log2(v / total) for v in counter.values()), 3) if total else 0.0


def top_line(notes):
    """The highest note at each onset: the line a listener follows through a chordal part."""
    best = {}
    for n in notes:
        t = tick(n['on'])
        if t not in best or n['pitch'] > best[t]['pitch']:
            best[t] = n
    return [best[t] for t in sorted(best)]


def recurrence(line, size=4):
    """Share of melodic cells (successive intervals with their inter-onset spacing) heard earlier in the part."""
    cells = [tuple((b['pitch'] - a['pitch'], tick(b['on']) - tick(a['on'])) for a, b in zip(line[i:i + size], line[i + 1:i + size + 1]))
             for i in range(len(line) - size)]
    seen, again = set(), 0
    for c in cells:
        again += c in seen
        seen.add(c)
    return round(100 * again / len(cells), 1) if cells else None


def phrases(line, rest=.5, hold=1.5):
    """A line's phrases: a new one after a rest of at least `rest` beats or after a note held `hold` beats or more,
    where a singer breathes (a phrase ends by resting or holding: Perricone 2000)."""
    out, cur = [], []
    for n in line:
        gap = n['on'] - (cur[-1]['on'] + cur[-1]['duration']) if cur else 0
        if cur and (gap >= rest - 1e-6 or cur[-1]['duration'] >= hold - 1e-6):
            out.append(cur)
            cur = []
        cur.append(n)
    return out + ([cur] if cur else [])


def _alike(u, v, bar):
    """Two bars of a line alike: their onsets in the bar with a Jaccard similarity of .75 or more, and the directions
    of their intervals agreeing at 70% or more of the longer bar's intervals.  A restatement keeps the rhythm and the
    shape; a sequence or a new ending keeps both."""
    a, b = {tick(n['on'] % bar) for n in u}, {tick(n['on'] % bar) for n in v}
    if len(a & b) / len(a | b) < .75:
        return False
    sign = lambda x: (x > 0) - (x < 0)
    cu = [sign(y['pitch'] - x['pitch']) for x, y in zip(u, u[1:])]
    cv = [sign(y['pitch'] - x['pitch']) for x, y in zip(v, v[1:])]
    return not (cu or cv) or sum(x == y for x, y in zip(cu, cv)) / max(len(cu), len(cv)) >= .7


def melody_in(line, lo, hi, clock):
    """The melody's figures over a span (beats `lo` to `hi`): its phrases and the longest of them without a breath,
    leaps of a fourth or more, bars of two notes or more that restate an earlier bar of the span (`_alike`), the peak
    and where it first falls, and where phrases start in the bar.  None for fewer than four notes."""
    notes = [n for n in line if lo <= n['on'] < hi]
    if len(notes) < 4:
        return None
    bpb = clock.beats_per_bar
    ph = phrases(notes)
    a, b = max(((p[0]['on'], p[-1]['on'] + p[-1]['duration']) for p in ph), key=lambda r: r[1] - r[0])
    by_bar = {}
    for n in notes:
        by_bar.setdefault(int((n['on'] - lo) // bpb), []).append(n)
    units = [by_bar[k] for k in sorted(by_bar) if len(by_bar[k]) >= 2]
    restated = sum(any(_alike(u, v, bpb) for v in units[:i]) for i, u in enumerate(units))
    peak = max(n['pitch'] for n in notes)
    first = next(n for n in notes if n['pitch'] == peak)
    return {'phrases': len(ph), 'longest_without_breath_beats': round(b - a, 2),
            'longest_without_breath_s': round(clock.seconds(b) - clock.seconds(a), 2),
            'leaps': sum(1 for x, y in zip(notes, notes[1:]) if abs(y['pitch'] - x['pitch']) >= 5),
            'bars_restated': restated, 'bars_compared': len(units),
            'peak': name(peak), 'peak_times': sum(1 for n in notes if n['pitch'] == peak),
            'peak_first_at_pct': round(100 * (first['on'] - lo) / (hi - lo)),
            'phrase_starts_beats': share(Counter(tick(p[0]['on'] % bpb) for p in ph), len(ph))}


def part(track, clock, bars):
    notes = sorted(track['notes'], key=lambda n: (n['on'], n['pitch']))
    if not notes:
        return {'notes': 0}
    bar_ticks = tick(clock.beats_per_bar)
    onsets = sorted({tick(n['on']) for n in notes})
    iois = Counter(b - a for a, b in zip(onsets, onsets[1:]))
    lengths = Counter(max(1, tick(n['duration'])) for n in notes)
    patterns = {}
    for t in onsets:
        patterns.setdefault(t // bar_ticks, set()).add(t % bar_ticks)
    seen, repeated = set(), 0
    for b in sorted(patterns):
        key = frozenset(patterns[b])
        repeated += key in seen
        seen.add(key)
    events = sorted([(tick(n['on']), 1) for n in notes] + [(tick(n['on'] + n['duration']), -1) for n in notes])
    sounding, peak = 0, 0
    for _, step in events:
        sounding += step
        peak = max(peak, sounding)
    perf = (track.get('performance') or {}).get('notes') or {}
    vel = [perf[n['id']]['velocity'] for n in notes if n.get('id') in perf and 'velocity' in perf[n['id']]]
    row = {'notes': len(notes), 'notes_per_bar': round(len(notes) / bars, 2),
           'ioi_beats': share(iois, sum(iois.values())), 'lengths_beats': share(lengths, len(notes)),
           'offbeat_onsets_pct': round(100 * sum(1 for t in onsets if t % STEPS) / len(onsets), 1),
           'downbeat_onsets_pct': round(100 * sum(1 for t in onsets if t % bar_ticks == 0) / len(onsets), 1),
           'rhythm_repeat_pct': round(100 * repeated / len(patterns), 1),
           'polyphony_max': peak,
           'velocity': ({'mean': round(statistics.fmean(vel), 1), 'sd': round(statistics.pstdev(vel), 1), 'range': [min(vel), max(vel)]}
                        if vel else None)}
    if track.get('drums'):
        row['drum_keys'] = dict(Counter(n['pitch'] for n in notes).most_common(6))
        return row
    pitches = [n['pitch'] for n in notes]
    line = top_line(notes)
    steps = [b['pitch'] - a['pitch'] for a, b in zip(line, line[1:])]
    row.update({
        'register': {'low': name(min(pitches)), 'high': name(max(pitches)), 'median': name(round(statistics.median(pitches))),
                     'span': max(pitches) - min(pitches)},
        'pitch_classes_used': len({p % 12 for p in pitches}),
        'pitch_class_entropy_bits': entropy_bits(Counter(p % 12 for p in pitches)),
        'top_line': ({'notes': len(line), 'mean_abs_interval': round(statistics.fmean(abs(s) for s in steps), 2),
                      'repeats_pct': round(100 * sum(1 for s in steps if s == 0) / len(steps), 1),
                      'steps_pct': round(100 * sum(1 for s in steps if 0 < abs(s) <= 2) / len(steps), 1),
                      'leaps_pct': round(100 * sum(1 for s in steps if abs(s) >= 5) / len(steps), 1),
                      'largest_leap': max(abs(s) for s in steps),
                      'direction_changes_pct': round(100 * sum(1 for a, b in zip(steps, steps[1:]) if a * b < 0) / max(1, len(steps) - 1), 1),
                      'recurring_cells_pct': recurrence(line)} if len(steps) >= 2 else None),
    })
    return row


def profile(p):
    from .review import unpitched
    clock = Clock(p)
    bars = p['clock']['bars']
    parts = {t['id']: {'role': t.get('role'), **part(t, clock, bars)} for t in p['tracks']}
    melody = next((t for t in p['tracks'] if t.get('role') == 'melody' and t['notes']), None)
    line = top_line([n for t in p['tracks'] if t.get('role') == 'melody' for n in t['notes']])
    sections = []
    for s in p.get('sections', []):
        lo, hi = s['start_bar'] * clock.beats_per_bar, (s['start_bar'] + s['bars']) * clock.beats_per_bar
        density = {t['id']: round(sum(1 for n in t['notes'] if lo <= n['on'] < hi) / s['bars'], 2) for t in p['tracks']}
        onsets = {tick(n['on']) for t in p['tracks'] if not unpitched(t) for n in t['notes'] if lo <= n['on'] < hi}
        span = clock.seconds(hi) - clock.seconds(lo)
        lead = [n['pitch'] for n in top_line(melody['notes']) if lo <= n['on'] < hi] if melody else []
        sections.append({'section': s['id'], 'bars': s['bars'], 'notes_per_bar': density,
                         'onsets_per_second': round(len(onsets) / span, 2) if span > 0 else None,
                         'melody_median': name(round(statistics.median(lead))) if lead else None,
                         'melody_high': name(max(lead)) if lead else None,
                         'melody': melody_in(line, lo, hi, clock)})
    total = sum(len(t['notes']) for t in p['tracks'])
    return {'title': p.get('title'), 'bars': bars, 'meter': p['clock']['meter'], 'tempo': p['clock']['tempo'],
            'seconds': round(clock.end, 2), 'parts_with_notes': sum(1 for t in p['tracks'] if t['notes']),
            'notes': total, 'notes_per_bar': round(total / bars, 2), 'melody_part': melody['id'] if melody else None,
            'parts': parts, 'sections': sections,
            'note': 'Descriptors of the written score after Yang and Lerch (2020); they show what changed, not what is better.'}
