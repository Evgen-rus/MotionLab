# Shapes & 2D

Рецепты адаптации, а не готовые модули. Общие функции и ограничения — в [README](README.md).

## 16. Dot-Collapse → Nested Iris

**Результат:** Схлопывание в точку и двойная диафрагма. **Когда:** смена раздела.

**Пример MotionLab:** Смена раздела в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
r=R*(1-in4(clamp(dt/.2))); после .2+1/60 rA=R*expo(p); rB=R*expo(clamp((dt-.2-4/60)/.2))
```

**Параметры и тайминг источника:** Collapse to a dot (12 fr inQuart), hold 1 fr, then two discs burst out, the second lagging 3 fr. _Use:_ section changes.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 17. Spring Morph + Ghost Outlines

**Результат:** Пружинный морф с контурными следами. **Когда:** переход формы в форму.

**Пример MotionLab:** Переход формы в форму в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Одинаковые 128 точек по длине периметра и одинаковый обход; P=A+(B-A)*spring(dt,267,.30); четыре контура вычислить заново при t-j/60
```

**Параметры и тайминг источника:** A shape morphs polygon→polygon each beat (k=267 z=0.30), with 4 lagging outline echoes and orbiting satellites. Resample to 128 pts and recompute the echoes from `t − k/60`.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 18. Truchet Wave Field

**Результат:** Поле вращающихся дуг Truchet. **Когда:** фоновая волна.

**Пример MotionLab:** Фоновая волна в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Для плитки row,col delay=(row+col)*.02; angle=PI/2*out3(clamp((dt-delay)/.3)); повтор волны раз в bar, к кульминации раз в beat
```

**Параметры и тайминг источника:** A tile field of quarter-arcs that waves rotate 90°. 1 wave per bar, rising to 1 per beat in a build.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 19. Gooey Pills

**Результат:** Сливающиеся вязкие плашки. **Когда:** объединение тегов.

**Пример MotionLab:** Объединение тегов в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Canvas SDF: d1=roundedBox(p-c1),d2=roundedBox(p-c2); h=max(k-abs(d1-d2),0)/k; d=min(d1,d2)-h*h*k/4; заполнить d<0; центры сближать out3 за .4 с
```

**Параметры и тайминг источника:** UI chips joined by metaball necks (SDF `smin`), with flicker and scramble, merging into one blob.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 20. Single-Line Draw

**Результат:** Непрерывная рисующая линия. **Когда:** скетч или схема.

**Пример MotionLab:** Скетч или схема в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
SVG getTotalLength L; dasharray=L; dashoffset=L-min(L,.8*H*dt); морфировать равночисленные точки за .4 с inOut3; точка пера getPointAtLength
```

**Параметры и тайминг источника:** One continuous pen line draws and morphs scribble → object → object at about 0.8 H/s, with a 24 fr inOutCubic morph and a leading pen dot. _Use:_ "sketch", "draw", "line".

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 21. Line-Icon Draw-On

**Результат:** Прорисовка линейных иконок. **Когда:** подписи поверх видео.

**Пример MotionLab:** Подписи поверх видео в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Для каждого SVG path dasharray=L; dashoffset=L*(1-clamp(dt/.2)); strokeWidth=2; копии 1,3,6 включать на выбранных ударах
```

**Параметры и тайминг источника:** 2 px SVG icons stroke on over footage (12 fr linear dash offset), then multiply 1→3→6.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 22. Tumbling Square → Object Pop

**Результат:** Кувыркающийся квадрат превращается в объект. **Когда:** предметная анимация.

**Пример MotionLab:** Предметная анимация в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
x=lerp(-W*.2,W*.5,out3(p)); angle=2*PI*p; при ударе sy=1-.2*sin(PI*p); детали объекта scale=spring(max(0,dt-i*.05),400,.5)
```

**Параметры и тайминг источника:** A square rolls in with squash on landing, then pops into an object (k=400 z=0.5) with sub-parts lagging 3 fr.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 23. Liquid Splat Wipe

**Результат:** Жидкий всплеск открывает фон. **Когда:** органический переход.

**Пример MotionLab:** Органический переход в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
Для 128 углов r=R*expo(clamp(dt/.2))*(1+.12*sin(5*a)+.08*sin(9*a+2)); капли p=p0+v*dt+g*dt*dt/2; внутренний радиус кольца растёт позже внешнего
```

**Параметры и тайминг источника:** A noise-perturbed SDF blob splats (12 fr outExpo), flings droplets and thins into a ring that reveals the next color.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 24. Falling Drop Beat-Marker

**Результат:** Капля отбивает три удара. **Когда:** спокойная пауза.

**Пример MotionLab:** Спокойная пауза в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
На интервалах между тремя beatTimes y=base-height[j]*4*u*(1-u), height=[.25,.14,.07]*H; squash при abs(u-1)<.1; после последнего приземления фиксировать
```

**Параметры и тайминг источника:** A drop bounces three times, each on a beat. A calm breath moment.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 25. Confetti Burst

**Результат:** Взрыв конфетти. **Когда:** финальный акцент.

**Пример MotionLab:** Финальный акцент в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
40–80 частиц; v и цвет из hash(i); x=x0+vx*(1-exp(-drag*dt))/drag; y=y0+vy*(1-exp(-drag*dt))/drag+g*dt*dt/2; angle=spin*dt; alpha=1-clamp(dt/(70/60))
```

**Параметры и тайминг источника:** 40-80 primitives with closed-form drag and gravity, spin ±360°/s, fading over 70 fr. _Use:_ celebrations and the final lock-up.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 26. Starburst + Orbit Text

**Результат:** Звезда и орбитальный текст. **Когда:** энергичный бейдж.

**Пример MotionLab:** Энергичный бейдж в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
12 лучей angle=i*2*PI/12; length=L*outBack(clamp((dt-i*.015)/.2)); круглые концы strokeLinecap=round; кольцо текста вращать .1 оборота/beat
```

**Параметры и тайминг источника:** A 12-spoke rounded burst whose spokes grow staggered, with a ring and orbiting mono text, plus a kick pulse.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 27. Easing-Race Chart

**Результат:** Гонка кривых easing. **Когда:** сравнение скорости.

**Пример MotionLab:** Сравнение скорости в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
u=clamp(dt/bar); x=A+(B-A)*ease[row](u); следы вычислять ease[row](clamp((dt-j/60)/bar)); нанести график x(u)
```

**Параметры и тайминг источника:** Balls race A→B with onion-skin ghosts over graph lines, lasting exactly 1 bar. _Use:_ "rising", "falling", comparisons.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 28. Halftone Dissolve

**Результат:** Полутоновое растворение. **Когда:** переход графика-видео.

**Пример MotionLab:** Переход графика-видео в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
На сетке шаг s радиус=s*.72*inOut4(clamp((dt/.333-col/cols*.4)/.6)); маской открыть следующий слой; при p=1 заменить сплошной заливкой
```

**Параметры и тайминг источника:** A dot grid whose radius is driven by wipe progress, used to transition from footage into graphics. 20 fr inOutQuart. It touches the transition, never the subject at rest.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 29. Kaleidoscope / Mirror Tile

**Результат:** Калейдоскоп из зеркальных секторов. **Когда:** абстрактная графика.

**Пример MotionLab:** Абстрактная графика в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
n=[4,6,8,12][section]; a=atan2(y,x); a=abs(((a%(2*PI/n))+2*PI/n)%(2*PI/n)-PI/n); sample(r*cos(a),r*sin(a)); менять n на downbeat
```

**Параметры и тайминг источника:** Fold UV into 4→6→8→12 wedges on downbeats. Graphics only.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.
