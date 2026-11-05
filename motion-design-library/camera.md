# Camera & Post

Рецепты адаптации, а не готовые модули. Общие функции и ограничения — в [README](README.md).

## 37. Kick Scale-Punch

**Результат:** Масштабный удар камеры. **Когда:** акцент бочки.

**Пример MotionLab:** Акцент бочки в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
pulse=sum(kicks.filter(k<=t).map(k=>exp(-(t-k)/.09))); scale=1+.035*pulse; shake=A*sin(90*dt)*exp(-dt/.09); использовать overscan
```

**Параметры и тайминг источника:** `E.post.punch = 0.035*E.pulse('kicks',t,0.09)`, plus small shake on snares.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 38. Whip Pan with Smear Frame

**Результат:** Резкая панорама с растянутым кадром. **Когда:** смена сцены.

**Пример MotionLab:** Смена сцены в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
За 5/60 с xA=-W*in4(p); следующий 1/60 с рисовать широкую растянутую копию; затем за 6/60 с xB=W*(1-out4(p)); клип по кадру
```

**Параметры и тайминг источника:** Exit 5 fr inQuart, 1 smear frame (a stretched copy), then entry 6 fr outQuart, centered on the kick.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 39. HUD Frame

**Результат:** Информационная рамка HUD. **Когда:** контекст и прогресс.

**Пример MotionLab:** Контекст и прогресс в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
progress=clamp(t/duration); barIndex=floor(t/bar); beatIndex=floor(t/beat)%beatsPerBar; длина линии W*progress; подписи и угловые скобы в безопасных полях
```

**Параметры и тайминг источника:** Corner brackets, title, section code, bar and beat squares, a spine counter and a progress line, for the whole video (`scenes/hud.js`).

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.

## 40. Chant Metronome Grid

**Результат:** Метрономная сетка скандирования. **Когда:** визуализация слогов.

**Пример MotionLab:** Визуализация слогов в авторской HTML-сцене; вычислить следующий рецепт внутри `seek(t)`, привязав `dt=t-start` к началу элемента.

**Алгоритм / JS-псевдокод:**

```js
16 ячеек 4x4; count=onsets.filter(s<=t).length; заполнить i<count; цвет ячейки инвертировать по числу kicks; последнее слово открывает wipe out3 за .3 с
```

**Параметры и тайминг источника:** Each chant syllable fills the next cell of a 4×4 grid on its onset, a kick inverts a cell, and the last word wipes the grid with a progress bar.

**Совместимость и зависимости:** Дополнительных пакетов нет: DOM/CSS/SVG/Canvas текущего браузера. Все состояния вычислять из t; значения кадра источника делить на 60, а не на fps экспорта. Для 3D вручную вызвать renderer.render(scene,camera) в seek.
