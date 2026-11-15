# SPDX-License-Identifier: GPL-3.0-or-later
"""Surge XT host: plays one part through the Surge XT plugin with pedalboard and writes a 32-bit float WAV.

Unlike the rest of the skill (MIT), this program is GPL-3.0-or-later, the licence of the two programs it loads.  The
skill runs it as a separate program and exchanges only files with it: a job file in (the plugin, the patch, the
part's timed MIDI events, its macros and bend range), a WAV out.  No GPL code runs in the skill's own processes.

It uses one helper from the skill, musiclib.surge.with_patch (MIT, which this licence allows), to write the patch
into the plugin's saved state.  Surge loads that patch on its first audio block and sets its parameters from it there,
so a silent block is played first; the part's macros and bend range (both scenes, up and down, in semitones) are set
after it, then the events play.

Speed: pedalboard describes every parameter of a plugin it loads by asking for its text at 1001 points (twice when the
first answers look wrong), and goes through that description again whenever a plugin attribute such as `raw_state`
is set.  Surge XT has 2855 parameters, so loading took one to five minutes and setting the patch as long again, while
the synthesis itself runs about a hundred times faster than real time.  The host needs a few parameters, so it skips
that description (pedalboard 0.9.26, pinned): it sets the state through the plugin class's own property and the
parameters it needs through the plugin's parameter objects, found by name before the patch loads (a patch's macro
labels rename its macros).  Measured: loading 0.3 s, the patch
0.07 s.  Where pedalboard lacks these internals, the host falls back to its public interface.

The licence text is in ../LICENSES/GPL-3.0-or-later.txt.

Usage: python surge_host.py <job.json>
"""
import json
import struct
import sys
from pathlib import Path


def write_float_wav(path, x, rate):
    raw = x.astype('<f4').tobytes()
    fmt = struct.pack('<HHIIHH', 3, x.shape[1], rate, rate * x.shape[1] * 4, x.shape[1] * 4, 32)
    with Path(path).open('wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(raw)) + b'WAVEfmt ' + struct.pack('<I', 16) + fmt
                + b'data' + struct.pack('<I', len(raw)) + raw)


def main(job_file):
    job = json.loads(Path(job_file).read_text(encoding='utf-8'))
    sys.path.insert(0, job['pylib'])
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import numpy as np
    import pedalboard
    from musiclib.surge import with_patch
    try:  # no description of all parameters at load (no initial values are given here)
        from pedalboard import _pedalboard as pb
        describe = pb._PythonExternalPluginMixin.__set_initial_parameter_values__
        pb._PythonExternalPluginMixin.__set_initial_parameter_values__ = (
            lambda self, values: describe(self, values) if values else None)
        name_of = pb.to_python_parameter_name
    except AttributeError:
        name_of = None
    rate = job['rate']
    synth = pedalboard.load_plugin(job['plugin'])
    # Found by name before the patch loads: a patch's macro labels rename its macros ("M1" becomes "M1: Cutoff").
    try:
        named = {name_of(p): p for p in synth._parameters} if name_of else None
    except AttributeError:
        named = None
    state = next((k.__dict__['raw_state'] for k in type(synth).__mro__ if 'raw_state' in k.__dict__), None)
    patch = Path(job['patch']).read_bytes()
    if state is not None:
        state.__set__(synth, with_patch(state.__get__(synth), patch))
    else:
        synth.raw_state = with_patch(synth.raw_state, patch)
    synth([], duration=512 / rate, sample_rate=rate, num_channels=2, buffer_size=512, reset=True)

    def set_raw(name, value):
        (named[name] if named else synth.parameters[name]).raw_value = value
    for k, v in job['macros'].items():
        set_raw(f'm{k}', float(v))
    for scene in 'ab':
        for way in ('up', 'down'):
            set_raw(f'{scene}_pitch_bend_{way}_range', job['bend_range'] / 24)
    events = [(bytes.fromhex(data), seconds) for data, seconds in job['events']]
    out = synth(events, duration=job['duration'], sample_rate=rate, num_channels=2, buffer_size=512, reset=False)
    x = np.asarray(out, dtype=np.float32).T[job['trim']:]
    if not np.isfinite(x).all():
        raise SystemExit('non-finite samples')
    write_float_wav(job['out'], x, rate)


if __name__ == '__main__':
    main(sys.argv[1])
