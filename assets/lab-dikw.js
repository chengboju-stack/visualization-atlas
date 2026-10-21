/* ==========================================================================
   lab-dikw.js · DIKW 金字塔 + 每层「看到什么 / 丢掉了什么」
   ========================================================================== */
(function () {
  'use strict';
  const { el, svg, scrolly } = window.LabKit;
  const $ = s => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const W = 460, H = 400;
  const stage = svg(W, H);
  $('#stage').replaceWith(stage);
  stage.id = 'stage';

  const G = el('g');
  stage.appendChild(G);

  // 四层金字塔：底宽顶窄
  const LAYERS = [
    { zh: 'Data 数据', en: 'Data', w: 380, y: 300, h: 72, color: 'var(--d5)' },
    { zh: 'Information 信息', en: 'Information', w: 296, y: 228, h: 70, color: 'var(--d2)' },
    { zh: 'Knowledge 知识', en: 'Knowledge', w: 212, y: 158, h: 68, color: 'var(--d3)' },
    { zh: 'Wisdom 智慧', en: 'Wisdom', w: 132, y: 90, h: 66, color: 'var(--d1)' },
  ];

  const CAPS = [
    {
      see: ['631 行 × 11 列', '631 rows × 11 cols'],
      lose: ['任何含义', 'all meaning'],
      note: ['一行 2026-01-01,East,120', 'row: 2026-01-01,East,120'],
    },
    {
      see: ['平均年龄 17.8 岁', 'mean age 17.8'],
      lose: ['单个学生的差异', 'individual variation'],
      note: ['口径：全部 80 条记录', 'scope: all 80 records'],
    },
    {
      see: ['年龄集中在 17–18', 'ages cluster at 17–18'],
      lose: ['反例与边界', 'counter-examples'],
      note: ['为什么：这是大一新生', 'why: these are first-years'],
    },
    {
      see: ['这是合成数据，不可外推', 'synthetic data, do not generalise'],
      lose: ['—', '—'],
      note: ['决定：只用于教学演示', 'decision: teaching only'],
    },
  ];

  let active = 0;

  function draw() {
    G.innerHTML = '';
    LAYERS.forEach((l, i) => {
      const isOn = i === active;
      const isBelow = i < active;
      const x = (W - l.w) / 2;
      G.appendChild(el('rect', {
        x, y: l.y, width: l.w, height: l.h, rx: 10,
        fill: isOn ? l.color : 'var(--bg-2)',
        'fill-opacity': isOn ? .9 : (isBelow ? .5 : .25),
        stroke: isOn ? l.color : 'var(--line)',
        'stroke-width': isOn ? 2 : 1,
        style: 'transition: all .35s ease',
      }));
      G.appendChild(el('text', {
        x: W / 2, y: l.y + l.h / 2 + 5,
        'text-anchor': 'middle',
        'font-size': isOn ? 17 : 14,
        'font-weight': isOn ? 650 : 500,
        fill: isOn ? '#fff' : 'var(--ink-3)',
        style: 'transition: all .35s ease',
        text: pick(l.zh, l.en),
      }));
    });

    // 左侧"箭头"：信息量/价值 递增
    G.appendChild(el('text', {
      x: 24, y: 200, class: 'ax-t', 'font-size': 10,
      transform: 'rotate(-90 24 200)',
      'text-anchor': 'middle',
      text: pick('价值 ↑   数据量 ↓', 'value ↑   volume ↓'),
    }));

    const c = CAPS[active];
    $('#cap-layer').textContent = pick(LAYERS[active].zh, LAYERS[active].en);
    $('#cap-see').textContent = pick(c.see[0], c.see[1]);
    $('#cap-lost').textContent = pick(c.lose[0], c.lose[1]);
    $('#cap-note').textContent = pick(c.note[0], c.note[1]);
  }

  scrolly($('#scrolly'), {
    onStep(i) { active = Math.max(0, Math.min(3, i)); draw(); },
  });

  draw();
  document.addEventListener('wbl:localechange', draw);
})();
