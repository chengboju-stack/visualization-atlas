/* ==========================================================================
   lab-spiral.js · 时间轴 → 阿基米德螺旋
   折叠参数 f ∈ [0,1]：0 是一条水平时间轴，1 是完整螺旋，中间做线性插值。
   ========================================================================== */
(function () {
  'use strict';
  const { el, svg, lin } = window.LabKit;
  const $ = s => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const W = 520, H = 400;
  const cx = W / 2, cy = H / 2 + 8;
  const stage = svg(W, H);
  $('#stage').replaceWith(stage);
  stage.id = 'stage';

  const G = el('g');
  stage.appendChild(G);

  // 确定性生成的每日值（季节 + 噪声）
  const N = 365;
  const mulberry = seed => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rnd = mulberry(2024);
  const VALS = Array.from({ length: N }, (_, i) => {
    const s = 0.5 + 0.34 * Math.sin((i / N) * Math.PI * 2 - 1.1);
    return Math.max(0, Math.min(1, s + (rnd() - .5) * .16));
  });

  const STOPS = ['#0d1b2a', '#1b3a5c', '#2f6f8f', '#5aa9a3', '#a8cf7f', '#f0e442'];
  const hex2rgb = window.LabKit.hex2rgb;
  const lerp = (a, b, t) => a + (b - a) * t;
  function color(v) {
    const t = Math.max(0, Math.min(1, v)) * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(t));
    const f = t - i;
    const a = hex2rgb(STOPS[i]), b = hex2rgb(STOPS[i + 1]);
    return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`;
  }

  let fold = 0;          // 0..1
  let turns = 6;

  function draw() {
    G.innerHTML = '';

    // 平铺状态下的水平轴位置（留出边距）
    const x0 = 34, x1 = W - 34;
    const baseY = cy;   // 展开态也用中心线，折叠时绕中心卷起
    const RMAX = Math.min(W, H) / 2 - 26;

    const pts = [];
    for (let i = 0; i < N; i++) {
      // 线性位置
      const lx = lin(0, N - 1, x0, x1)(i);
      const ly = baseY;

      // 螺旋位置：r = a + bθ，θ 从 0 到 turns*2π
      const th = (i / N) * turns * Math.PI * 2;
      const r = (RMAX / (turns * 2 * Math.PI)) * th + 10;
      const sx = cx + Math.cos(th - Math.PI / 2) * r;
      const sy = cy + Math.sin(th - Math.PI / 2) * r;

      // 折叠插值
      const x = lx + (sx - lx) * fold;
      const y = ly + (sy - ly) * fold;
      pts.push([x, y, VALS[i]]);
    }

    // 展开时的数值条：每条代表一天的取值，折叠后收回
    const stem = 1 - fold;
    if (stem > 0.02) {
      pts.forEach(([x, y, v]) => {
        const h = v * 44 * stem;
        G.appendChild(el('line', {
          x1: x, x2: x, y1: y, y2: y - h,
          stroke: color(v), 'stroke-width': 2, opacity: .85 * stem, 'stroke-linecap': 'round',
        }));
      });
    }

    // 相邻点连线，颜色取起点
    for (let i = 1; i < pts.length; i++) {
      const [x1p, y1p, v] = pts[i - 1];
      const [x2p, y2p] = pts[i];
      G.appendChild(el('line', {
        x1: x1p, y1: y1p, x2: x2p, y2: y2p,
        stroke: color(v), 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: .92,
      }));
    }
    // 每个月起点加一个刻度
    for (let m = 1; m <= 12; m++) {
      const i = Math.round((m - 1) / 12 * N);
      const [x, y] = pts[Math.min(N - 1, i)];
      G.appendChild(el('circle', { cx: x, cy: y, r: 3.4, fill: '#fff', opacity: .9 }));
      if (fold > .55) {
        G.appendChild(el('text', {
          x: x + 7, y: y + 4, class: 'ax-t', 'font-size': 9,
          text: pick((m) + '月', 'M' + m),
        }));
      }
    }
    // 密度提示
    if (fold < .2) {
      G.appendChild(el('text', {
        x: (x0 + x1) / 2, y: baseY + 66, class: 'ax-t', 'text-anchor': 'middle',
        text: pick('展开：时间是一条线，看不出周期', 'Unfolded: a straight line, no period visible'),
      }));
    }
  }

  $('#fold').addEventListener('input', e => {
    fold = +e.target.value / 100;
    $('#fold-v').textContent = Math.round(fold * 100) + '%';
    draw();
  });
  $('#turns').addEventListener('input', e => {
    turns = +e.target.value;
    $('#turns-v').textContent = String(turns);
    draw();
  });

  let playing = false, raf = 0;
  $('#play').addEventListener('click', () => {
    playing = !playing;
    $('#play').textContent = playing ? pick('暂停','Pause') : pick('播放','Play');
    if (!playing) { cancelAnimationFrame(raf); return; }
    let dir = 1;
    const step = () => {
      fold += dir * .012;
      if (fold >= 1) { fold = 1; dir = 0; }
      $('#fold').value = String(Math.round(fold * 100));
      $('#fold-v').textContent = Math.round(fold * 100) + '%';
      draw();
      if (dir) raf = requestAnimationFrame(step);
      else { playing = false; $('#play').textContent = pick('播放','Play'); }
    };
    raf = requestAnimationFrame(step);
  });
  $('#reset').addEventListener('click', () => {
    playing = false; cancelAnimationFrame(raf);
    $('#play').textContent = pick('播放','Play');
    fold = 0; $('#fold').value = '0'; $('#fold-v').textContent = '0%';
    draw();
  });

  { const btn = $('#play'); if (btn) btn.textContent = pick('播放', 'Play'); }
  draw();
  document.addEventListener('wbl:localechange', () => {
    const btn = $('#play');
    if (btn) btn.textContent = playing ? pick('暂停', 'Pause') : pick('播放', 'Play');
    draw();
  });
})();
