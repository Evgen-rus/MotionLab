import {brandMorph, focusView, liftCard, lineCarry, matchCut, placeRect, revealGroups, voiceLevels} from '../shot-motion.mjs';

const portrait = document.documentElement.dataset.format === 'portrait';
const size = portrait ? [480, 854] : [854, 480];
const [width, height] = size;
document.head.insertAdjacentHTML('beforeend', `<style>
@font-face {font-family:Manrope;src:url('./demos/fonts/Manrope-Variable.ttf') format('truetype');font-weight:200 800;font-display:block}
* {box-sizing:border-box}
body {margin:0;background:#ede5d6;color:#292329;font-family:Manrope,sans-serif;font-synthesis:none}
main {position:relative;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(ellipse at 80% 80%,#d9bba9,transparent 75%),#f3e7d1}
section,svg.overlay {position:absolute;inset:0}
h1,p {margin:0}
header {position:absolute;left:${portrait ? 36 : 56}px;top:${portrait ? 89 : 90}px}
h1 {font-size:${portrait ? 68 : 63}px;line-height:1.04;letter-spacing:-.075em;font-weight:800}
header p {margin-top:14px;font-size:19px;font-weight:600}
.panel {position:absolute;inset:0;transform-origin:0 0;will-change:transform}
.shell {position:absolute;display:flex;align-items:flex-start;padding:20px;border:1px solid #6a464e;border-radius:16px;background:#fff1d9;box-shadow:0 8px 32px #764f4226;font-size:15px;font-weight:800}
.card,.token {position:absolute;display:grid;place-content:center;color:#fff5e6;border-radius:14px;background:#552b3e;font-weight:800;font-size:24px;text-align:center}
.token {background:#a34945;font-size:32px}
.token span {grid-area:1/1;align-self:center;white-space:nowrap}
.results {position:absolute;left:${portrait ? 70 : 74}px;top:${portrait ? 495 : 267}px}
.results p {font-size:22px;margin:8px 0;font-weight:700}
.voice {position:absolute;left:${portrait ? 80 : 497}px;bottom:${portrait ? 72 : 46}px;font-size:13px;font-weight:700;text-align:center}
.bars {height:38px;display:flex;gap:4px;align-items:center;justify-content:center}
.bars i {display:block;width:3px;height:27px;transform-origin:center;background:#7b4355;border-radius:99px}
[hidden] {display:none !important}
</style>`);

document.body.innerHTML = `<main>
<section id="before" data-scene-id="before" data-scene-name="Приём сигнала" data-start="0" data-end="5.5">
  <header data-qa-safe><h1>Сигнал<br>найден</h1><p>Выделяем важное</p></header>
  <div class="panel"><div class="shell">Диспетчерская</div><div class="card original">Ответ получен</div></div>
  <div class="card lifted" data-element-id="lifted" data-element-name="Карточка ответа" data-element-type="Текст" data-start="3.1" data-end="5.5" data-motion="Отделяется от панели">Ответ получен</div>
</section>
<section id="after" data-scene-id="after" data-scene-name="Передача сигнала" data-start="5.5" data-end="10">
  <header data-qa-safe><h1>Сигнал<br>передан</h1><p>Собираем итог</p></header>
  <div class="results" data-qa-safe><p>Канал открыт</p><p>Получатель на связи</p></div>
  <div class="voice" data-qa-safe><div class="bars"></div>Учебная кривая без аудио</div>
</section>
<svg class="overlay" width="${width}" height="${height}" aria-hidden="true"><path fill="none" stroke="#a34945" stroke-width="3"/><circle r="6" fill="#552b3e"/></svg>
<div class="token"><span>Принято</span><span>Маяк</span></div>
</main>`;

const get = selector => document.querySelector(selector);
const before = get('#before');
const after = get('#after');
const panel = get('.panel');
const original = get('.original');
const lifted = get('.lifted');
const path = get('path');
const token = get('.token');
const [stamp, brand] = token.children;
const bars = get('.bars');
bars.innerHTML = '<i></i>'.repeat(25);

const card = portrait ? {x: 111, y: 376, width: 257, height: 81} : {x: 499, y: 231, width: 249, height: 73};
const eyebrow = portrait ? {x: 70, y: 309, width: 340, height: 193} : {x: 453, y: 160, width: 341, height: 186};
const note = portrait ? {x: 61, y: 532, width: 358, height: 111} : {x: 469, y: 156, width: 314, height: 124};
const cutRect = portrait ? {x: 95, y: 321, width: 290, height: 97} : {x: 492, y: 149, width: 268, height: 96};
const endRect = portrait ? {x: 70, y: 313, width: 340, height: 146} : {x: 462, y: 145, width: 321, height: 136};
const center = [card.x + card.width / 2, card.y + card.height / 2];
placeRect(get('.shell'), eyebrow);
placeRect(original, card);
path.setAttribute('d', portrait ? 'M240 653 C450 650 458 370 385 370' : 'M618 301 C805 310 840 194 760 196');
const carry = lineCarry(path, get('circle'), {start: 4.48, cut: 5.5, end: 6.27});
const fonts = document.fonts.load('800 63px Manrope', 'Съёмка и приём');
const fixture = {step: 0.04, values: Array.from({length: 85}, (_, index) => (index % 22 < 15 ? Math.sin(index * 0.71) ** 2 : 0))};

window.__video = {duration: 10, fps: 24, size, async seek(time) {
  if (!(await fonts).length) throw new Error('No Manrope font');
  const cut = matchCut(time, {cut: 5.5, outgoingEnd: 5.5, rect: cutRect, velocity: [16, 0]});
  before.hidden = cut.incoming;
  after.hidden = !cut.incoming;
  panel.style.transform = focusView(time, {start: 0.6, arrive: 1.25, leave: 2.65, end: 3.1, target: center, anchor: center, zoom: 1.2}).transform;
  placeRect(lifted, liftCard(time, {start: 3.1, end: 4.15, from: card, to: note}).rect);
  original.hidden = time >= 3.1;
  lifted.hidden = time < 3.1 || time >= 5.3;
  get('.shell').style.opacity = time >= 4.2 ? '0.28' : '1';
  carry(time);
  revealGroups(get('.results').children, cut.localTime, {starts: [0.24, 0.83]});
  voiceLevels(cut.localTime - 0.55, fixture).forEach((level, index) => {
    bars.children[index].style.transform = `scaleY(${0.07 + level * 0.93})`;
  });
  const motion = brandMorph(time, {start: 7.4, end: 8.35, from: cut.rect, to: endRect, radiusFrom: 14, radiusTo: 44});
  placeRect(token, motion.rect);
  token.hidden = time < 5.3;
  token.style.borderRadius = `${motion.radius}px`;
  stamp.style.opacity = motion.uiOpacity;
  brand.style.opacity = motion.brandOpacity;
}};
