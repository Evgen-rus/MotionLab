import {test} from 'node:test';
import assert from 'node:assert/strict';
import {brandMorph, focusView, liftCard, lineCarry, matchCut, voiceLevels} from '../motion-design-library/shot-motion.mjs';
import {cameraRig, orbitPose} from '../motion-design-library/product-stage.mjs';

test('a focus hold and shared cut geometry depend only on the requested time', () => {
  const focus = time => focusView(time, {start: 1, arrive: 2, leave: 3, end: 4, target: [100, 200], anchor: [150, 200], zoom: 1.5});
  assert.deepEqual(focus(2), focus(2.9));
  assert.equal(focus(2).x + focus(2).scale * 100, 150);
  assert.equal(focus(4).scale, 1);
  const rect = {x: 30, y: 40, width: 120, height: 60};
  const options = {cut: 3, outgoingEnd: 5, incomingStart: 2, rect, velocity: [10, 0]};
  assert.deepEqual(matchCut(2.9, options), {incoming: false, localTime: 4.9, rect: {...rect, x: 29}});
  assert.deepEqual(matchCut(3, options), {incoming: true, localTime: 2, rect});
  assert.deepEqual(matchCut(3.1, options), {incoming: true, localTime: 2.1, rect: {...rect, x: 31}});
  const to = {...rect, x: 80, y: 100};
  assert.deepEqual(liftCard(0, {start: 1, end: 2, from: rect, to}).rect, rect);
  assert.deepEqual(liftCard(2, {start: 1, end: 2, from: rect, to}).rect, to);
  assert.deepEqual(brandMorph(2, {start: 1, end: 2, from: rect, to, radiusFrom: 8, radiusTo: 20}), {rect: to, radius: 20, uiOpacity: 0, brandOpacity: 1});
});

test('the same SVG line crosses a cut with continuing motion and can rewind', () => {
  const path = {style: {}, getTotalLength: () => 100, getPointAtLength: x => ({x, y: 12})};
  const marker = {style: {}, setAttribute(name, value) { this[name] = value; }};
  const seek = lineCarry(path, marker, {start: 1, cut: 2, end: 3});
  assert.deepEqual(seek(2), {progress: 0.5, incoming: true});
  assert.equal(marker.cx, 50);
  seek(2.5);
  assert.equal(marker.cx, 75);
  seek(2);
  assert.equal(marker.cx, 50);
  seek(0.5);
  assert.equal(marker.style.visibility, 'hidden');
});

test('camera poses including optional FOV can be sampled out of order', () => {
  const camera = {
    fov: 40,
    position: {set(...value) { this.vector = value; }},
    lookAt(...value) { this.target = value; },
    updateProjectionMatrix() {},
  };
  const seek = cameraRig(camera, [
    orbitPose(1, {azimuth: 0, elevation: 0, distance: 6}),
    orbitPose(3, {azimuth: 0, elevation: 0, distance: 4, fov: 30}),
  ]);
  seek(2);
  assert.equal(camera.fov, 35);
  assert.deepEqual(camera.position.vector, [0, 0, 5]);
  seek(6);
  assert.equal(camera.fov, 30);
  seek(1);
  assert.equal(camera.fov, 40);
  assert.deepEqual(camera.position.vector, [0, 0, 6]);
  seek(2);
  assert.equal(camera.fov, 35);
  assert.deepEqual(camera.position.vector, [0, 0, 5]);
});

test('the speech display interpolates measured samples and falls quiet outside the voice', () => {
  const envelope = {step: 0.125, values: [0, 0.5, 1, 0]};
  assert.deepEqual(voiceLevels(0.25, envelope, {count: 5}), [0, 0.5, 1, 0, 0]);
  assert.deepEqual(voiceLevels(0.1875, envelope, {count: 1}), [0.75]);
  assert.deepEqual(voiceLevels(5, envelope, {count: 3}), [0, 0, 0]);
});
