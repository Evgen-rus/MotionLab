# Typography

Рецепты адаптации, а не готовые модули. Общие функции и ограничения — в [README](README.md).

## 1. Smear Slam

**Результат:** Удар слова с тремя шлейфами. **Когда:** акцент первого слова.

**Пример MotionLab:** Акцент первого слова в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
e=expo(p); scale=1.6-.6*e; xGhost=-W*.06*j*(1-e); alpha=[.35,.2,.1][j-1]*max(0,1-dt/.1)
```

**Параметры и тайминг источника:** A word hits center from scale 1.6 with 3 trailing ghosts (offset −6/−12/−18% W, alpha .35/.2/.1) that collapse into it. 8 fr outExpo, ghosts gone by fr 6, 1 fr flash `post.flash=0.08`. _Use:_ the first word of a hook line, or chant words.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 2. Directional Blur Slide

**Результат:** Скольжение с направленным размытием. **Когда:** ответная реплика.

**Пример MotionLab:** Ответная реплика в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
x=-W*(1-out4(p)); нарисовать 8 копий x(t-j/480) с alpha=1/8, затем чёткий финальный текст
```

**Параметры и тайминг источника:** Slides in from off-frame with motion blur made of 8 stacked draws at 1/8 alpha, spaced by `v*dt`. 6 fr outQuart. _Use:_ call-and-response words.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 3. Letter Rise Stagger

**Результат:** Буквы поднимаются из маски строки. **Когда:** появление заголовка.

**Пример MotionLab:** Появление заголовка в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
p=clamp((dt-i*2/60)/(14/60)); y=cap*(1-out5(p)); clip прямоугольником строки перед translate
```

**Параметры и тайминг источника:** Letters rise from a baseline clip mask. 14 fr per letter outQuint, stagger 2 fr (1 fr for fast words). _JS:_ `ctx.rect(0,base-cap*1.1,W,cap*1.1); ctx.clip(); y=base+cap*(1-e)`.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 4. Wave Drop

**Результат:** Буквы падают с вращением. **Когда:** игривое слово.

**Пример MotionLab:** Игривое слово в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
e=spring(max(0,dt-i*1.5/60),600,.35); y=-H*.3*(1-e); angle=15*sin(i*7)*(1-e)
```

**Параметры и тайминг источника:** Letters fall in with ±15° rotation and land on a spring k=600 z=0.35, stagger 1.5 fr. _Use:_ "falling" or "dropping" lyrics.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 5. Variable-Width Wave

**Результат:** Волна ширины букв. **Когда:** длинное протяжное слово.

**Пример MotionLab:** Длинное протяжное слово в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
wdth=93.5+31.5*sin(2*PI*(dt/beat-i*.12)); fontVariationSettings задавать каждой букве; заранее измерить крайние ширины
```

**Параметры и тайминг источника:** A traveling wave through `wdth` 62→125, period 1 beat, phase 0.12 beat per letter. Pre-rasterize width steps in `load()`. _Use:_ "breathe", "stretch", held notes.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Нужен локальный шрифт с осью wdth; у Manrope её нет. scaleX — только визуальная аппроксимация. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 6. Echo Wall

**Результат:** Стена контурных повторов. **Когда:** скандирование.

**Пример MotionLab:** Скандирование в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Для 6 строк x=((dt*.35*W*(row%2?1:-1))%W+W)%W; повторять текст за обеими границами; центральную строку залить
```

**Параметры и тайминг источника:** The center row is solid and 4-6 outline rows scroll in alternating directions at ±0.35 W/s. Add a row every 8th in a chant.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 7. Punctuation Portal

**Результат:** Точка раскрывает следующий фон. **Когда:** переход из заголовка.

**Пример MotionLab:** Переход из заголовка в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
r=r0+(hypot(W,H)-r0)*inExpo(clamp(dt/.1)); сначала увести слово за 4/60 с, точку рисовать поверх следующей сцены
```

**Параметры и тайминг источника:** The final "." (or an i-dot or a cursor) scales to fill the screen and becomes the next background. 6 fr inExpo, while the word whips away 4 fr earlier.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 8. Color-Field Flip

**Результат:** Инверсия цветовых полей. **Когда:** удары музыки.

**Пример MotionLab:** Удары музыки в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
i=lastIndex(kicks,t); bg=fields[i%fields.length]; ink=contrasting[i%fields.length]; scale=1+.04*(1-clamp((t-kicks[i])/(2/60)))
```

**Параметры и тайминг источника:** Swap background and foreground on each kick with a hard cut, plus a 2 fr scale punch 1.04→1. `bg = FIELDS[E.last('kicks',t).i % n]`.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 9. Swiss Grid Slam

**Результат:** Слова занимают ячейки сетки. **Когда:** редакционный титр.

**Пример MotionLab:** Редакционный титр в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Для 12 колонок провести линии с длиной W*clamp(dt/(10/60)); затем scale=.94+.06*expo(clamp((dt-10/60+3/60)/(8/60)))
```

**Параметры и тайминг источника:** A 12-column grid: hairline rules draw first (10 fr linear), then words drop into cells (8 fr outExpo, from scale 0.94) at the onset minus 3 fr.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 10. Split-Flap Counter

**Результат:** Перекидной счётчик. **Когда:** год или число.

**Пример MotionLab:** Год или число в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Для цифры i lock=T-(n-1-i)*4/60; до lock брать hash(i,floor(t*30))%10; после lock целевую цифру; rotateX=180*(1-outBack(p))
```

**Параметры и тайминг источника:** Digits flip every 2 fr through hashed randoms and settle right to left, 4 fr apart, on outBack. _Use:_ times, years, counts, countdowns.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 11. Scramble Resolve

**Результат:** Шум символов собирается в слово. **Когда:** технологичный титр.

**Пример MotionLab:** Технологичный титр в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
lock=i*1.5/60+20/60; glyph=t>=lock?target[i]:pool[hash(i,floor(t*60))%pool.length]; общая длительность до 30/60 под длину
```

**Параметры и тайминг источника:** Glyph noise resolves left to right over 20-30 fr, each char locking at `i*1.5 fr`, from a themed glyph pool ("01ACGT#%").

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 12. Text Selection + Cursor

**Результат:** Выделение текста и курсор. **Когда:** интерфейсный акцент.

**Пример MotionLab:** Интерфейсный акцент в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
selectionWidth=textWidth*out4(clamp(dt/(10/60))); handles=clamp((dt-13/60)/.05); cursorVisible=floor(dt/beat)%2===0
```

**Параметры и тайминг источника:** A UI highlight box grows from the left (10 fr outQuart), its handles pop 3 fr later, and a block cursor blinks per beat.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 13. Type-on-Path Ring

**Результат:** Текст по кольцевому пути. **Когда:** круговая подпись.

**Пример MotionLab:** Круговая подпись в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
SVG textPath startOffset=(100*(.1*dt/beat+.05*kickCount))%100; замкнуть путь; повторить строку для бесшовности
```

**Параметры и тайминг источника:** Mono caps orbit a circle at 0.1 turn per beat, snapping +0.05 turn on each kick.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 14. Letters Bigger Than Frame

**Результат:** Буквы крупнее кадра. **Когда:** ритмичный крупный план.

**Пример MotionLab:** Ритмичный крупный план в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
glyph=word[floor(dt/(beat/2))%word.length]; fontSize=1.5*W; scale=1+.08*clamp(localTime/.2); clip по кадру
```

**Параметры и тайминг источника:** Single glyphs at 150% W, one per 8th, with a 12 fr linear push 1.0→1.08. The counters become windows.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 15. Weight Ladder

**Результат:** Лестница начертаний. **Когда:** демонстрация типографики.

**Пример MotionLab:** Демонстрация типографики в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Для 8 строк fontWeight=100+800*row/7; видимость row<=floor(dt/(beat/2)); стрелка y=activeRow*lineHeight
```

**Параметры и тайминг источника:** The same word in 8 rows from Thin to Black, one step per 8th, with an arrow stepping down.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Manrope покрывает 200–800; для полного Thin→Black нужен локальный variable font 100–900 с лицензией. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.
