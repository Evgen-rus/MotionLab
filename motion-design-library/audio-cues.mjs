import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { args, freshOutput, json, localFile, number, run } from '../.agents/skills/motionlab/scripts/lib.mjs';

const rate = 48000;
const binSize = 960;
const maxSeconds = 120;

function analyze(file) {
  const result = spawnSync(process.env.MOTIONLAB_FFMPEG || 'ffmpeg', [
    '-hide_banner', '-nostdin', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe',
    '-i', file, '-map', '0:a:0', '-t', String(maxSeconds + 1), '-ac', '2', '-ar', String(rate),
    '-f', 'f32le', 'pipe:1',
  ], { timeout: 120000, maxBuffer: rate * (maxSeconds + 1) * 8 + 1024, windowsHide: true });
  if (result.error || result.status !== 0) {
    throw Error(`Could not decode ${file}: ${result.error?.message || result.stderr?.toString() || result.status}`);
  }
  const frames = result.stdout.length / 8;
  if (!frames || frames > maxSeconds * rate || !Number.isInteger(frames)) {
    throw Error(`Audio must contain at most ${maxSeconds} seconds of samples: ${file}`);
  }

  const rms = [];
  let maximum = 0;
  let peakFrame = 0;
  for (let start = 0; start < frames; start += binSize) {
    const end = Math.min(frames, start + binSize);
    let squares = 0;
    for (let offset = start * 8; offset < end * 8; offset += 4) {
      const sample = result.stdout.readFloatLE(offset);
      squares += sample * sample;
    }
    const level = Math.sqrt(squares / ((end - start) * 2));
    if (!Number.isFinite(level)) throw Error(`Invalid audio samples: ${file}`);
    rms.push(level);
    if (level > maximum) {
      maximum = level;
      peakFrame = Math.floor((start + end) / 2);
    }
  }
  return { frames, rms, maximum, peakFrame };
}

function writeModule(file, value) {
  writeFileSync(file, `export default ${JSON.stringify(value)};\n`, { flag: 'wx' });
}

function envelope(options) {
  const voice = analyze(localFile(options.in));
  if (voice.maximum < 0.000001) throw Error('Speech envelope needs audible source audio');
  const out = freshOutput(options.out);
  writeModule(join(out, 'speech-envelope.mjs'), {
    step: binSize / rate,
    duration: voice.frames / rate,
    values: voice.rms.map(level => Number((level / voice.maximum).toFixed(4))),
  });
  console.log(join(out, 'speech-envelope.mjs'));
}

function configureClips(plan, folder) {
  const duration = number(plan.duration, undefined, 0.1, maxSeconds);
  const frames = Math.round(duration * rate);
  if (!plan.events || typeof plan.events !== 'object' || Array.isArray(plan.events)) {
    throw Error('Use an events object containing named times in seconds');
  }
  for (const [name, time] of Object.entries(plan.events)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name) || typeof time !== 'number') {
      throw Error(`Invalid event: ${name}`);
    }
    number(time, undefined, 0, duration);
  }
  const effects = plan.effects ?? [];
  if (!Array.isArray(effects)) throw Error('Use an effects array');

  const clips = [];
  const analyzed = new Map();
  function add(track, kind, time, anchor) {
    if (typeof track.file !== 'string' || !track.file) throw Error(`${kind} needs a local file`);
    const file = localFile(resolve(folder, track.file));
    if (!analyzed.has(file)) analyzed.set(file, analyze(file));
    const audio = analyzed.get(file);
    if (anchor === 'peak' && audio.maximum < 0.000001) throw Error(`Cannot align a silent peak: ${file}`);
    const anchorFrame = { start: 0, peak: audio.peakFrame, end: audio.frames }[anchor];
    const gain = number(track.gain, 1, 0, 1);
    const start = Math.round(time * rate) - anchorFrame;
    const sourceStart = Math.max(0, -start);
    const position = Math.max(0, start);
    const length = Math.min(audio.frames - sourceStart, frames - position);
    if (length <= 0) throw Error(`No ${kind} samples fit the timeline: ${file}`);
    if (kind === 'narration' && (length !== audio.frames || gain === 0 || audio.maximum < 0.000001)) {
      throw Error(`Narration must be audible and fit the timeline without trimming: ${file}`);
    }
    clips.push({ kind, file, event: track.event ?? null, anchor, anchorFrame, start,
      sourceFrames: audio.frames, sourceStart, position, length, gain });
  }

  function eventTime(track) {
    if (!track || typeof track.event !== 'string' || !Object.hasOwn(plan.events, track.event)) {
      throw Error(`Unknown audio event: ${track?.event}`);
    }
    return plan.events[track.event];
  }

  if (plan.music) add(plan.music, 'music', 0, 'start');
  if (plan.narration) add(plan.narration, 'narration', eventTime(plan.narration), 'start');
  for (const effect of effects) {
    if (effect?.enabled === false) continue;
    const anchor = effect?.anchor ?? 'start';
    if (!['start', 'peak', 'end'].includes(anchor)) throw Error(`Unknown audio anchor: ${anchor}`);
    add(effect, 'effect', eventTime(effect), anchor);
  }
  if (!clips.length) throw Error('The plan has no audio tracks');
  return { frames, clips };
}

function mix(options) {
  const path = localFile(options.plan);
  const plan = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const { frames, clips } = configureClips(plan, dirname(path));
  const out = freshOutput(options.out);
  const filters = [];
  const pads = [];
  for (const [index, clip] of clips.entries()) {
    const trimEnd = clip.sourceStart + clip.length;
    const source = `[${index}:a:0]aresample=${rate},aformat=sample_fmts=fltp:channel_layouts=stereo`;
    const placement = `atrim=start_sample=${clip.sourceStart}:end_sample=${trimEnd},asetpts=PTS-STARTPTS,volume=${clip.gain},adelay=${clip.position}S:all=1`;
    const narration = clip.kind === 'narration' ? `,apad=whole_len=${frames},asplit=2[narration]` : '';
    const pad = `[clip${index}]`;
    filters.push(`${source},${placement}${narration}${pad}`);
    pads.push(pad);
  }
  filters.push(`${pads.join('')}amix=inputs=${pads.length}:duration=longest:normalize=0,alimiter=limit=0.95:level=0:latency=1,apad=whole_len=${frames},atrim=end_sample=${frames}[mix]`);
  const output = join(out, 'mix.wav');
  const command = ['-n', ...clips.flatMap(clip => ['-i', clip.file]), '-filter_complex', filters.join(';'),
    '-map', '[mix]', '-c:a', 'pcm_s24le', output];
  if (plan.narration) command.push('-map', '[narration]', '-c:a', 'pcm_s24le', join(out, 'narration.wav'));
  run(command);
  writeModule(join(out, 'events.mjs'), plan.events);
  json(join(out, 'mix.json'), { sampleRate: rate, duration: frames / rate, events: plan.events, clips });
  console.log(output);
}

try {
  const mode = process.argv.splice(2, 1)[0];
  const options = args();
  const required = { envelope: ['in', 'out'], mix: ['plan', 'out'] };
  if (!Object.hasOwn(required, mode) || Object.keys(options).some(key => !required[mode].includes(key)) ||
      required[mode].some(key => !options[key])) {
    throw Error('Use envelope --in <voice> --out <new folder> or mix --plan <plan.json> --out <new folder>');
  }
  if (mode === 'envelope') envelope(options);
  else mix(options);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
