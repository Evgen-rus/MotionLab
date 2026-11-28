import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rate = 48000;
const root = resolve('projects');
mkdirSync(root, { recursive: true });
const folder = mkdtempSync(join(root, '.audio-cues-'));
after(() => rmSync(folder, { recursive: true }));

function fixture(name, levels) {
  const frames = levels.length * 960;
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 2, 40);
  for (let frame = 0; frame < frames; frame++) {
    const level = levels[Math.floor(frame / 960)];
    const sample = level * Math.sin(2 * Math.PI * 1000 * frame / rate);
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + frame * 2);
  }
  writeFileSync(join(folder, name), buffer);
}

function cli(...argv) {
  return spawnSync(process.execPath, ['motion-design-library/audio-cues.mjs', ...argv], { encoding: 'utf8' });
}

function audio(name) {
  const decoded = spawnSync(process.env.MOTIONLAB_FFMPEG || 'ffmpeg', ['-v', 'error', '-i', name, '-ac', '1', '-f', 's16le', 'pipe:1']);
  assert.equal(decoded.status, 0, decoded.stderr?.toString());
  return decoded.stdout;
}

test('audio effects align file start, measured peak and file end to named events', async () => {
  fixture('cue.wav', [0.2, 0.8, 0.2]);
  fixture('voice.wav', [0, 0.6, 0.3, 0]);
  const plan = {
    duration: 1,
    events: { start: 0.1, peak: 0.35, end: 0.6, say: 0.8 },
    narration: { event: 'say', file: 'voice.wav', gain: 0.8 },
    effects: ['start', 'peak', 'end'].map(anchor => ({ event: anchor, anchor, file: 'cue.wav', gain: 0.5 })),
  };
  const planPath = join(folder, 'plan.json');
  const out = join(folder, 'mix');
  writeFileSync(planPath, JSON.stringify(plan));
  const result = cli('mix', '--plan', planPath, '--out', out);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await import(pathToFileURL(join(out, 'events.mjs')))).default, plan.events);
  const audit = JSON.parse(readFileSync(join(out, 'mix.json'), 'utf8'));
  assert.deepEqual(audit.clips.map(clip => clip.position), [38400, 4800, 15360, 25920]);
  const mix = audio(join(out, 'mix.wav'));
  const voice = audio(join(out, 'narration.wav'));
  assert.equal(mix.length, rate * 2);
  assert.equal(voice.length, rate * 2);
  const sample = (track, time) => Math.abs(track.readInt16LE(2 * (Math.round(time * rate) + 12)));
  for (const time of [0.1, 0.35, 0.599, 0.821]) assert.ok(sample(mix, time) > 1000, `Missing cue at ${time}`);
  for (const time of [0.099, 0.3, 0.6, 0.81]) assert.ok(sample(mix, time) < 4, `Unexpected activity at ${time}`);
  assert.equal(sample(voice, 0.35), 0);
  assert.ok(sample(voice, 0.821) > 1000);
  assert.notEqual(cli('mix', '--plan', planPath, '--out', out).status, 0);

  plan.events.say = 0.95;
  writeFileSync(planPath, JSON.stringify(plan));
  const cut = cli('mix', '--plan', planPath, '--out', join(folder, 'cut'));
  assert.equal(cut.status, 1);
  assert.match(cut.stderr, /without trimming/);
});

test('speech envelope follows the source audio and refuses silence', async () => {
  fixture('envelope.wav', [0, 0.2, 0.8, 0.4, 0]);
  const out = join(folder, 'envelope');
  const result = cli('envelope', '--in', join(folder, 'envelope.wav'), '--out', out);
  assert.equal(result.status, 0, result.stderr);
  const data = (await import(pathToFileURL(join(out, 'speech-envelope.mjs')))).default;
  assert.deepEqual(data, { step: 0.02, duration: 0.1, values: [0, 0.25, 1, 0.5, 0] });
  fixture('silent.wav', [0, 0]);
  const silent = cli('envelope', '--in', join(folder, 'silent.wav'), '--out', join(folder, 'silent'));
  assert.equal(silent.status, 1);
  assert.match(silent.stderr, /audible source audio/);
});
