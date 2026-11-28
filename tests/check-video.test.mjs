import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const cli = resolve('.agents/skills/motionlab/scripts/check-video.mjs');
const run = (bin, args) => spawnSync(bin, args, {encoding:'utf8', windowsHide:true, timeout:15000});

test('video check detects a lone flash, full black, and missing evidence', t => {
  const root = mkdtempSync(join(tmpdir(), 'motionlab-check-video-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const source = join(root, 'sequence.mp4');
  const create = run(process.env.MOTIONLAB_FFMPEG || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', "color=red:s=64x64:r=10:d=0.7",
    '-vf', "drawbox=color=white:t=fill:enable='eq(n,2)',drawbox=color=black:t=fill:enable='eq(n,5)'",
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source,
  ]);
  assert.equal(create.status, 0, create.stderr);
  const check = run(process.execPath, [cli, '--in', source]);
  assert.equal(check.status, 1, check.stderr);
  const result = JSON.parse(check.stdout);
  assert.equal(result.status, 'problem');
  assert.deepEqual(result.black, [6]);
  assert.ok(result.isolated.includes(3));
  const missing = run(process.execPath, [cli, '--in', join(root, 'missing.mp4')]);
  assert.equal(missing.status, 2);
  assert.equal(JSON.parse(missing.stdout).status, 'not-run');
});
