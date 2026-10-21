/* ==========================================================================
   lab-colormap.js · 三种数据语义 × 三种色阶族
   重点不是"哪个好看"，而是配对错误时图形会说错话。
   ========================================================================== */
(function () {
  'use strict';
  const { el, svg, cvd } = window.LabKit;
  const $ = s => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const W = 520, H = 340;
  const COLS = 13, ROWS = 8;
  const P = { t: 16, b: 46, l: 16, r: 16 };
  const cw = (W - P.l - P.r) / COLS;
  const chh = (H - P.t - P.b) / ROWS;

  const STOPS = {
    seq: ['#00204d', '#00306f', '#39486b', '#576d6e', '#7c8f61', '#b4a94f', '#fee838'],
    div: ['#542788', '#8073ac', '#b2abd2', '#f7f7f7', '#fdb863', '#e08214', '#b35806'],
    cat: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999'],
  };

  const hex2rgb = window.LabKit.hex2rgb;
  const lerp = (a, b, t) => a + (b - a) * t;
  function ramp(stops, t) {
    t = Math.max(0, Math.min(1, t));
    const s = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(s));
    const f = s - i;
    const a = hex2rgb(stops[i]), b = hex2rgb(stops[i + 1]);
    return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`;
  }

  // 三种语义的数据：同一张网格，三种含义
  const DATA = {
    seq: Array.from({ length: ROWS }, (_, j) => Array.from({ length: COLS }, (_, i) => {
      const d = Math.hypot((i - 3) / COLS, (j - 2) / ROWS);
      return Math.max(0, 1 - d * 1.5) ** 1.6;
    })),
    div: Array.from({ length: ROWS }, (_, j) => Array.from({ length: COLS }, (_, i) => {
      // 以中列为 0 的发散场
      const x = (i - (COLS - 1) / 2) / ((COLS - 1) / 2);
      const y = (j - (ROWS - 1) / 2) / ((ROWS - 1) / 2);
      return Math.max(-1, Math.min(1, x * (1 - Math.abs(y) * .35)));
    })),
    cat: Array.from({ length: ROWS }, (_, j) => Array.from({ length: COLS }, (_, i) =>
      (i < 4 ? 0 : i < 7 ? 1 : i < 10 ? 2 : 3))),
  };

  const stage = svg(W, H);
  $('#stage').replaceWith(stage);
  stage.id = 'stage';

  let semantic = 'seq';
  let family = 'seq';
  let vision = '';

  function colorFor(v, i, j) {
    let c;
    if (family === 'cat') c = STOPS.cat[Math.abs(v * 97 + i * 7 + j * 3) % STOPS.cat.length | 0];
    else if (family === 'div') c = ramp(STOPS.div, (v + 1) / 2);
    else c = ramp(STOPS.seq, v);
    if (vision) c = cvd(c.startsWith('#') ? c : rgbToHex(c), vision);
    return c;
  }
  const rgbToHex = s => {
    const m = s.match(/\d+/g).map(Number);
    return window.LabKit.rgb2hex(m);
  };


  /* 下拉选项跟随语言 */
  function relabelOptions() {
    const sel = $('#semantic');
    if (!sel) return;
    const opts = [
      ['seq', pick('顺序：0 → 1 单调增长', 'Sequential: 0 → 1')],
      ['div', pick('发散：−1 → 0 → 1（有零点）', 'Diverging: −1 → 0 → 1')],
      ['cat', pick('定性：互不相干的类别', 'Categorical: unordered classes')],
    ];
    opts.forEach(([v, t], i) => { if (sel.options[i]) sel.options[i].textContent = t; });
    const sel2 = $('#cvd2');
    if (sel2) {
      const o2 = [
        ['', pick('正常视觉', 'Normal vision')],
        ['protan', pick('红色盲', 'Protanopia')],
        ['deutan', pick('绿色盲', 'Deuteranopia')],
        ['tritan', pick('蓝色盲', 'Tritanopia')],
      ];
      o2.forEach(([v, t], i) => { if (sel2.options[i]) sel2.options[i].textContent = t; });
    }
    const fam = document.querySelectorAll('#family button');
    ['seq', 'div', 'cat'].forEach((k, i) => {
      if (fam[i]) fam[i].textContent = pick(['顺序', '发散', '定性'][i], ['Seq', 'Div', 'Cat'][i]);
    });
  }

  function draw() {
    stage.innerHTML = '';
    const grid = DATA[semantic];
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const v = grid[j][i];
        const fill = colorFor(v, i, j);
        const r = el('rect', {
          x: P.l + i * cw, y: P.t + j * chh, width: cw - 1, height: chh - 1,
          fill, rx: 1.5,
        });
        window.LabKit.tip(r, () => `<b>${semantic === 'cat' ? '类别 ' + (v + 1) : v.toFixed(2)}</b>`);
        stage.appendChild(r);
      }
    }
    // 色阶条
    const barY = H - 30, barH = 10, barW = W - P.l - P.r - 70;
    const n = 60;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const v = semantic === 'cat' ? t : (semantic === 'div' ? t * 2 - 1 : t);
      stage.appendChild(el('rect', {
        x: P.l + (k / n) * barW, y: barY, width: barW / n + .6, height: barH,
        fill: colorFor(v, 0, 0),
      }));
    }
    const lab = (x, txt, anchor) => stage.appendChild(el('text', {
      x, y: barY + barH + 15, class: 'ax-t', 'text-anchor': anchor || 'start', text: txt,
    }));
    if (semantic === 'cat') {
      lab(P.l, pick('类别 A', 'category A'), 'start');
      lab(P.l + barW, pick('类别 D', 'category D'), 'end');
    } else if (semantic === 'div') {
      lab(P.l, '−1', 'start');
      lab(P.l + barW / 2, '0', 'middle');
      lab(P.l + barW, '+1', 'end');
    } else {
      lab(P.l, '0', 'start');
      lab(P.l + barW, '1', 'end');
    }
    stage.appendChild(el('text', {
      x: W - P.r, y: barY + barH + 15, class: 'ax-t', 'text-anchor': 'end',
      text: pick('合计 104 格', '104 cells'),
    }));

    verdict();
  }

  function verdict() {
    const el2 = $('#verdict');
    if (!el2) return;
    const ok = semantic === family;
    const map = {
      'seq-div': ['顺序数据配发散色阶：中间值被画成一个显眼的浅色带，读者会以为那里有特殊含义。', 'Sequential data on a diverging ramp: the middle becomes a bright band, implying a meaningful midpoint that does not exist.'],
      'seq-cat': ['顺序数据配定性色阶：颜色之间没有顺序关系，读者无法从颜色读出大小。', 'Sequential data on categorical colours: hue carries no order, so magnitude cannot be read.'],
      'div-seq': ['发散数据配顺序色阶：正负两侧被画成同一个方向，零点消失了。', 'Diverging data on a sequential ramp: both sides look like the same direction, and the zero point disappears.'],
      'div-cat': ['发散数据配定性色阶：既没有零点也没有方向，正负完全读不出。', 'Diverging data on categorical colours: no zero, no direction.'],
      'cat-seq': ['定性数据配顺序色阶：类别之间被暗示出大小关系，这是最常犯的错。', 'Categorical data on a sequential ramp: it implies an order between categories — the most common mistake.'],
      'cat-div': ['定性数据配发散色阶：同样凭空造出了一个"中间类别"。', 'Categorical data on a diverging ramp: it invents a middle category out of nothing.'],
    };
    if (ok) {
      el2.textContent = pick('配对正确：色阶族的语义和数据类型一致。', 'Correct pairing: the colormap semantics match the data.');
      el2.style.color = 'var(--accent-2-ink)';
    } else {
      const t = map[semantic + '-' + family];
      el2.textContent = t ? pick(t[0], t[1]) : '';
      el2.style.color = 'var(--accent-ink)';
    }
  }

  /* ---------------- 交互 ---------------- */
  $('#semantic').addEventListener('change', e => {
    semantic = e.target.value;
    // 语义变了，对应色阶族自动跟上（作为"正确示范"）
    family = semantic;
    document.querySelectorAll('#family button').forEach(b => b.classList.toggle('active', b.dataset.f === family));
    draw();
  });
  document.querySelectorAll('#family button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#family button').forEach(x => x.classList.toggle('active', x === b));
      family = b.dataset.f;
      draw();
    });
  });
  $('#cvd2').addEventListener('change', e => { vision = e.target.value; draw(); });

  relabelOptions();
  draw();
  document.addEventListener('wbl:localechange', () => { relabelOptions(); draw(); });
})();
