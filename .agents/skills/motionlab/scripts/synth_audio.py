"""Local synthetic sketches inspired by the supplied Paper Cutout stems; NumPy only."""
import argparse
import json
from pathlib import Path
import wave
import numpy as np

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--out', required=True)
p.add_argument('--duration', type=float, default=15)
p.add_argument('--tempo', type=float, default=108)
p.add_argument('--mood', choices=['warm', 'bright', 'dark'], default='warm')
p.add_argument('--instruments', default='kick,snare,hat,bass,chords')
p.add_argument('--seed', type=int, default=42)
p.add_argument('--effects', help='JSON array: time, kind (tap/drop/swoosh), gain, pan, enabled')
a = p.parse_args()
instruments = set(a.instruments.split(','))
if not .1 <= a.duration <= 120 or not 30 <= a.tempo <= 240 or a.seed < 0:
    p.error('duration 0.1..120, tempo 30..240, seed >= 0 required')
if not instruments or not instruments <= {'kick', 'snare', 'hat', 'bass', 'chords'}:
    p.error('unknown instrument')
rate = 44100
n = int(rate * a.duration)
music, sfx = np.zeros((2, n, 2))
rng, fxrng = np.random.default_rng(a.seed), np.random.default_rng(100)
beat = 60 / a.tempo


def put(track, at, sound, gain, pan=0):
    start = int(at * rate)
    if start >= n:
        return
    count = min(len(sound), n - start)
    track[start:start+count] += sound[:count, None] * gain * np.sqrt([(1-pan)/2, (1+pan)/2])


def tone(freq, seconds):
    t = np.arange(int(seconds * rate)) / rate
    return (np.sin(2*np.pi*freq*t) + .14*np.sin(4*np.pi*freq*t)) * (1-np.exp(-40*t)) * np.exp(-4*t/seconds)


def noise(seconds, generator):
    t = np.arange(int(seconds * rate)) / rate
    return t, generator.standard_normal(len(t))


roots = {'warm': [55, 65.41, 73.42, 49], 'bright': [65.41, 87.31, 98, 65.41], 'dark': [55, 51.91, 43.65, 41.2]}[a.mood]
for k in range(int(a.duration / beat) + 1):
    at = k * beat
    root = roots[(k // 4) % 4]
    if 'kick' in instruments:
        t = np.arange(int(.28*rate))/rate
        put(music, at, np.sin(2*np.pi*(52*t+95*(1-np.exp(-28*t))/28))*np.exp(-19*t), .16)
    if 'snare' in instruments and k % 4 in (1, 3):
        t, raw = noise(.16, rng)
        put(music, at, (.6*np.diff(raw, prepend=raw[0])+.24*np.sin(2*np.pi*185*t))*np.exp(-27*t), .068, .1)
    if 'hat' in instruments:
        t, raw = noise(.055, rng)
        put(music, at+beat/2, np.diff(raw, prepend=raw[0])*np.exp(-72*t), .035, .25*(-1 if k % 2 else 1))
    if 'bass' in instruments:
        put(music, at, tone(root, min(.44, beat)), .1)
    if 'chords' in instruments and k % 4 == 0:
        for j, semitone in enumerate([0, 4 if a.mood == 'bright' else 3, 7]):
            put(music, at, tone(root*4*2**(semitone/12), min(2.2, beat*4)), .015, (j-1)*.35)

cues = json.loads(Path(a.effects).read_text(encoding='utf-8')) if a.effects else [
    dict(time=a.duration*f, kind=kind, gain=.12, pan=pan) for f, kind, pan in [(.15, 'tap', -.2), (.45, 'drop', .1), (.7, 'swoosh', .2)]]
components = []
for cue in cues:
    at, gain, pan = float(cue['time']), float(cue.get('gain', .12)), float(cue.get('pan', 0))
    kind = cue['kind']
    if not 0 <= at < a.duration or not 0 <= gain <= 1 or not -1 <= pan <= 1 or kind not in ['tap', 'drop', 'swoosh']:
        p.error('invalid effect time/gain/pan/kind')
    if not cue.get('enabled', True):
        continue
    seconds = {'tap': .12, 'drop': .26, 'swoosh': .46}[kind]
    t, raw = noise(seconds, fxrng)
    sound = np.diff(raw, prepend=raw[0]) * (.4+.4*np.sin(2*np.pi*37*t)**2)
    sound *= np.sin(np.linspace(0, np.pi, len(t)))**1.7 if kind == 'swoosh' else np.exp(-t*30)
    if kind == 'drop':
        sound += .3*np.sin(2*np.pi*115*t)*np.exp(-21*t)
    sound *= gain * np.minimum(1, np.linspace(1, 0, len(t))*20)
    put(sfx, at, sound, 1, pan)
    components.append((cue, sound))

fade = min(int(1.35*rate), n//3)
music[-fade:] *= np.linspace(1, 0, fade)[:, None]**1.4
attack = min(441, n)
music[:attack] *= np.linspace(0, 1, attack)[:, None]
sfx[-attack:] *= np.linspace(1, 0, attack)[:, None]
mix = music+sfx
scale = min(1, .83/max(float(np.max(np.abs(mix))), 1e-8))
out = Path(a.out)
root = Path('projects').resolve()
if root not in out.resolve().parents:
    p.error('out must be a new directory inside projects/<title>')
out.mkdir(parents=True, exist_ok=False)


def save(name, data):
    with wave.open(str(out/name), 'wb') as w:
        w.setnchannels(1 if data.ndim == 1 else 2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((np.clip(data*scale, -1, 1)*32767).astype('<i2').tobytes())


for name, data in [('music.wav', music), ('sfx.wav', sfx), ('mix.wav', mix)]:
    save(name, data)
events = []
for i, (cue, data) in enumerate(components):
    name = f'effect-{i+1:02d}.wav'
    save(name, data)
    events.append(dict(cue, path=name, gain=1, enabled=True))
(out/'recipe.json').write_text(json.dumps(dict(settings=vars(a), effects=events, fadeSeconds=fade/rate, peak=float(np.max(np.abs(mix*scale)))), indent=2), encoding='utf-8')
print(out)
