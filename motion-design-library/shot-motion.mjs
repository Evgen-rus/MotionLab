export const clamp = value => Math.max(0, Math.min(1, value));
export const lerp = (from, to, progress) => from + (to - from) * progress;
export const ease = progress => progress * progress * (3 - 2 * progress);

export function phase(time, start, end) {
  return start === end ? Number(time >= start) : clamp((time - start) / (end - start));
}

// Zoom toward a marked region, leave a reading interval, then return to the wide shot.
export function focusView(time, {start, arrive, leave, end, target, anchor, zoom}) {
  const progress = ease(phase(time, start, arrive)) * (1 - ease(phase(time, leave, end)));
  const scale = lerp(1, zoom, progress);
  const x = lerp(target[0], anchor[0], progress) - target[0] * scale;
  const y = lerp(target[1], anchor[1], progress) - target[1] * scale;
  return {scale, x, y, transform: `translate(${x}px, ${y}px) scale(${scale})`};
}

// Schedule each information group independently, with all settled groups remaining legible.
export function revealGroups(elements, time, {starts, duration = 0.4, distance = 16}) {
  if (starts.length !== elements.length) throw new Error('Each information group needs a start time');
  for (const [index, element] of Array.from(elements).entries()) {
    const progress = ease(phase(time, starts[index], starts[index] + duration));
    element.style.opacity = progress;
    element.style.transform = `translateY(${distance * (1 - progress)}px)`;
  }
}

// Reframe a card from screen coordinates to an independent reading position.
export function liftCard(time, {start, end, from, to, arc = 24}) {
  const progress = ease(phase(time, start, end));
  const rect = interpolateRect(from, to, progress);
  rect.y -= 4 * arc * progress * (1 - progress);
  return {rect, progress};
}

function interpolateRect(from, to, progress) {
  return Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, lerp(from[key], to[key], progress)]));
}

export function placeRect(element, {x, y, width, height}) {
  const style = element.style;
  style.left = `${x}px`;
  style.top = `${y}px`;
  style.width = `${width}px`;
  style.height = `${height}px`;
}

// Share the same anchor patch at the cut; each shot retains its own source clock.
export function matchCut(time, {cut, incomingStart = 0, outgoingEnd, velocity = [0, 0], rect}) {
  const offset = time - cut;
  const incoming = offset >= 0;
  const localTime = Math.max(0, (incoming ? incomingStart : outgoingEnd) + offset);
  return {
    incoming,
    localTime,
    rect: {...rect, x: rect.x + offset * velocity[0], y: rect.y + offset * velocity[1]},
  };
}

// Keep the connecting line in a shared layer so neither of the moving shots resets it.
export function lineCarry(path, marker, {start, cut, end}) {
  if (!(start < cut && cut < end)) throw new Error('A carried line needs time on both sides of the cut');
  const length = path.getTotalLength();
  if (!(length > 0)) throw new Error('A carried line needs a nonempty SVG path');
  path.style.strokeDasharray = `${length} ${length}`;
  return time => {
    const progress = phase(time, start, end);
    const point = path.getPointAtLength(length * progress);
    path.style.strokeDashoffset = `${length * (1 - progress)}`;
    path.style.visibility = time < start ? 'hidden' : 'visible';
    marker.setAttribute('cx', point.x);
    marker.setAttribute('cy', point.y);
    marker.style.visibility = time < start || time > end ? 'hidden' : 'visible';
    return {progress, incoming: time >= cut};
  };
}

// The shared shape carries the meaning of the UI element into the title/end card.
export function brandMorph(time, {start, end, from, to, radiusFrom, radiusTo}) {
  const progress = ease(phase(time, start, end));
  return {
    rect: interpolateRect(from, to, progress),
    radius: lerp(radiusFrom, radiusTo, progress),
    uiOpacity: 1 - phase(progress, 0.1, 0.42),
    brandOpacity: phase(progress, 0.56, 0.9),
  };
}

// Display measured RMS samples from the aligned voice stem (0–1), including silence.
export function voiceLevels(time, {step, values}, {count = 25, spacing = step, gain = 1} = {}) {
  return Array.from({length: count}, (_, index) => {
    const sample = (time + (index - (count - 1) / 2) * spacing) / step;
    if (sample < 0 || sample >= values.length) return 0;
    const left = Math.floor(sample);
    return clamp(lerp(values[left], values[left + 1] ?? 0, sample - left) * gain);
  });
}
