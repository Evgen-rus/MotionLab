import {spawnSync} from 'node:child_process';
import {args, localFile} from './lib.mjs';

const side = 48;
const stride = side ** 2;
const maxFrames = 3600;

function difference(a, b) {
  let sum = 0;
  for (let index = 0; index < stride; index++) sum += Math.abs(a[index] - b[index]);
  return sum / (255 * stride);
}

try {
  const options = args();
  if (Object.keys(options).some(key => key !== 'in')) throw Error('Use --in with a local MP4');
  const source = localFile(options.in);
  const decode = spawnSync(process.env.MOTIONLAB_FFMPEG || 'ffmpeg', [
    '-hide_banner', '-nostdin', '-loglevel', 'error', '-protocol_whitelist', 'file,pipe', '-i', source,
    '-map', '0:v:0', '-fps_mode', 'passthrough', '-vf', `scale=${side}:${side}:flags=area,format=gray`,
    '-frames:v', String(maxFrames + 1), '-c:v', 'rawvideo', '-threads:v', '1', '-f', 'rawvideo', 'pipe:1',
  ], {maxBuffer: stride * (maxFrames + 1) + 4096, timeout: 120000, windowsHide: true});
  if (decode.error || decode.status !== 0) throw Error(decode.error?.message || decode.stderr.toString());
  const count = decode.stdout.length / stride;
  if (!Number.isInteger(count) || count < 3 || count > maxFrames) throw Error('Expected 3–3600 decoded frames');

  const black = [];
  const isolated = [];
  const frame = index => decode.stdout.subarray(index * stride, (index + 1) * stride);
  for (let index = 0; index < count; index++) {
    const current = frame(index);
    if (current.reduce((bright, value) => bright + Number(value > 15), 0) < stride * 0.02) {
      black.push(index + 1);
    }
    if (index === 0 || index === count - 1) continue;
    const previous = frame(index - 1);
    const next = frame(index + 1);
    const neighbors = difference(previous, next);
    const jump = Math.min(difference(previous, current), difference(current, next));
    if (neighbors <= 0.06 && jump >= 0.13 && jump > neighbors * 2.5) isolated.push(index + 1);
  }
  const status = black.length || isolated.length ? 'problem' : 'passed';
  console.log(JSON.stringify({status, frames: count, black, isolated, frameNumbers: 'one-based'}));
  process.exitCode = status === 'problem' ? 1 : 0;
} catch (error) {
  console.log(JSON.stringify({status:'not-run', error:error.message}));
  process.exitCode = 2;
}
