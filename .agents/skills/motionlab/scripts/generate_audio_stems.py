"""Independent, reproducible stems for MotionLab Paper Beat (15 seconds).

Outputs music.wav, sfx.wav and mix_preview.wav. No external sound samples.
The five foley effects are synthetic drafts; real paper recordings can later
replace sfx.wav without changing music.wav or the animation.
"""
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

RATE=44100
DURATION=15.0
SAMPLES=int(RATE*DURATION)
BEAT=60/108
OUT=Path(__file__).parent
OUT.mkdir(parents=True,exist_ok=True)
music=np.zeros((SAMPLES,2),dtype=np.float64)
sfx=np.zeros_like(music)
music_rng=np.random.default_rng(20261031)
foley_rng=np.random.default_rng(31012026)

def put(track,at,sound,gain=1.0,pan=0.0):
    start=int(at*RATE)
    if start<0 or start>=SAMPLES:
        return
    count=min(len(sound),SAMPLES-start)
    part=sound[:count]*gain
    track[start:start+count,0]+=part*np.sqrt((1-pan)/2)
    track[start:start+count,1]+=part*np.sqrt((1+pan)/2)

def tone(freq,seconds,amp=1.0):
    t=np.arange(int(seconds*RATE))/RATE
    env=(1-np.exp(-t*30))*np.exp(-t/(seconds*.7))
    return amp*env*(.79*np.sin(2*np.pi*freq*t)+.14*np.sin(4*np.pi*freq*t)+.07*np.sin(6*np.pi*freq*t))

def kick():
    t=np.arange(int(.28*RATE))/RATE
    phase=2*np.pi*(52*t+95*(1-np.exp(-t*28))/28)
    return np.sin(phase)*np.exp(-t*19)

def snare():
    n=int(.16*RATE)
    t=np.arange(n)/RATE
    raw=music_rng.standard_normal(n)
    high=sosfilt(butter(2,900,btype='high',fs=RATE,output='sos'),raw)
    return .6*high*np.exp(-t*27)+.24*np.sin(2*np.pi*185*t)*np.exp(-t*22)

def hat():
    n=int(.055*RATE)
    t=np.arange(n)/RATE
    raw=music_rng.standard_normal(n)
    high=sosfilt(butter(2,6100,btype='high',fs=RATE,output='sos'),raw)
    return high*np.exp(-t*72)

def paper_texture(seconds,low_cut=550,high_cut=8500):
    n=int(seconds*RATE)
    raw=foley_rng.standard_normal(n)
    filt=sosfilt(butter(2,[low_cut,high_cut],btype='bandpass',fs=RATE,output='sos'),raw)
    t=np.arange(n)/RATE
    # Irregular real-paper-like bursts rather than pitched digital beeps.
    flutter=.25+.25*np.sin(2*np.pi*37*t)**2+.40*np.sin(2*np.pi*71*t)**2
    return filt*flutter

def paper_tap():
    t=np.arange(int(.12*RATE))/RATE
    return paper_texture(.12,1000,9500)*np.exp(-t*45)

def paper_drop():
    t=np.arange(int(.26*RATE))/RATE
    scratch=paper_texture(.26,400,7000)*np.exp(-t*12)
    thud=np.sin(2*np.pi*115*t)*np.exp(-t*21)
    return .8*scratch+.3*thud

def paper_swoosh():
    t=np.arange(int(.46*RATE))/RATE
    wave=paper_texture(.46,550,9000)
    envelope=np.sin(np.pi*np.linspace(0,1,len(t)))**1.7
    return wave*envelope

def paper_flick():
    t=np.arange(int(.19*RATE))/RATE
    return paper_texture(.19,800,9000)*np.exp(-t*18)

def soft_logo():
    t=np.arange(int(.32*RATE))/RATE
    bass=np.sin(2*np.pi*(78*t+25*(1-np.exp(-t*20))/20))*np.exp(-t*15)
    texture=paper_texture(.32,350,5000)*np.exp(-t*26)
    return .55*bass+.35*texture

# Music-only: the same Paper Beat composition as the first sound sketch.
roots=[55,65.4,73.42,49]
for k in range(int(DURATION/BEAT)+2):
    at=k*BEAT
    put(music,at,kick(),.16)
    if k%4 in (1,3):
        put(music,at,snare(),.068,pan=.1)
    put(music,at,tone(roots[(k//4)%4],.44),.10)
    put(music,at+.5*BEAT,hat(),.035,pan=(-.25 if k%2 else .25))
    put(music,at,hat(),.024,pan=.1)

chords=[
    (220,261.6,329.6),(174.6,220,261.6),
    (196,246.9,293.7),(164.8,196,246.9)
]
for k in range(7):
    for j,freq in enumerate(chords[k%4]):
        put(music,k*4*BEAT,tone(freq,2.2,.32),.045,pan=[-.35,0,.35][j])

ambient=music_rng.standard_normal(SAMPLES)
ambient=sosfilt(butter(2,3900,btype='low',fs=RATE,output='sos'),ambient)
music+=ambient[:,None]*.0019

# Exactly five independent foley cues.
cues=[
    (.35,paper_tap,.17,-.13,'ВЗЯЛ — лёгкий бумажный щелчок'),
    (2.53,paper_drop,.17,.10,'Скриншот — мягкий удар бумаги'),
    (4.01,paper_swoosh,.15,.20,'Зум к титрам — шелест'),
    (9.55,paper_flick,.16,-.10,'СВОЙ РЕЗУЛЬТАТ — взмах бумаги'),
    (13.61,soft_logo,.16,0.0,'Логотип MotionLab — мягкий акцент')
]
for when,make,gain,pan,_ in cues:
    put(sfx,when,make(),gain,pan)

# Keep stems at fixed independent gains so they can be recombined later.
music*=.86
sfx*=.76
fade_start=13.65
fade_samples=SAMPLES-int(fade_start*RATE)
music[-fade_samples:]*=np.linspace(1,0,fade_samples)[:,None]**1.4
combined=music+sfx
peak=np.max(np.abs(combined))
scale=.83/max(peak,1e-8)
music*=scale
sfx*=scale
combined*=scale

def save(path,signal):
    wavfile.write(OUT/path,RATE,(np.clip(signal,-1,1)*32767).astype(np.int16))

save('music_only_15s.wav',music)
save('sfx_only_15s.wav',sfx)
save('mix_clean_15s.wav',combined)

for when,_,_,_,description in cues:
    print(f'{when:05.2f}s {description}')
print(f'Peak mix {np.max(np.abs(combined)):.3f}, 15.000s at {RATE} Hz, 2 channels')
