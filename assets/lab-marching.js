/* ==========================================================================
   lab-marching.js · Marching Squares 逐格生成等值线
   网格 12×8，四角按 1/2/4/8 编号，得到 0–15 的 case，再按查表连线。
   ========================================================================== */
(function () {
  'use strict';
  const { el, svg, tween, ease } = window.LabKit;
  const $ = s => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const W = 520, H = 340;
  const GX = 12, GY = 8;
  const PAD = 34;
  const cw = (W - PAD * 2) / GX;
  const ch = (H - PAD * 2) / GY;

  // 一个平滑标量场：两个高斯峰相加再归一化
  const field = (x, y) => {
    const g = (cx, cy, s) => Math.exp(-(((x - cx) ** 2) + ((y - cy) ** 2)) / (2 * s * s));
    // 两个峰刻意分开一点，默认阈值下能看到两条独立的闭合等值线
    return Math.min(1, 0.92 * g(0.30, 0.36, 0.145) + 0.86 * g(0.72, 0.64, 0.135) + 0.03);
  };
  const V = [];
  for (let j = 0; j <= GY; j++) {
    V[j] = [];
    for (let i = 0; i <= GX; i++) V[j][i] = field(i / GX, j / GY);
  }

  const stage = svg(W, H);
  $('#stage').replaceWith(stage);
  stage.id = 'stage';
  const gGrid = el('g'), gCont = el('g'), gHot = el('g'), gLabels = el('g');
  stage.append(gGrid, gCont, gHot, gLabels);

  let thr = 0.5;
  let processed = 0;
  const total = GX * GY;

  /* ---------------- 查表：case → 线段（边的组合） ---------------- */
  // 边：0=上 1=右 2=下 3=左
  const CASES = {
    0: [], 15: [],
    1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
    5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]],
    9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]],
    13: [[0, 1]], 14: [[3, 0]],
  };

  const corner = (i, j) => ({ tl: V[j][i], tr: V[j][i + 1], br: V[j + 1][i + 1], bl: V[j + 1][i] });

  function caseOf(c) {
    return (c.tl >= thr ? 1 : 0) | (c.tr >= thr ? 2 : 0) | (c.br >= thr ? 4 : 0) | (c.bl >= thr ? 8 : 0);
  }

  function edgePoint(c, e, x0, y0, w, h) {
    const t = (a, b) => {
      const d = b - a;
      return Math.abs(d) < 1e-9 ? 0.5 : Math.max(0, Math.min(1, (thr - a) / d));
    };
    if (e === 0) return [x0 + w * t(c.tl, c.tr), y0];
    if (e === 1) return [x0 + w, y0 + h * t(c.tr, c.br)];
    if (e === 2) return [x0 + w * t(c.bl, c.br), y0 + h];
    return [x0, y0 + h * t(c.tl, c.bl)];
  }

  /* ---------------- 绘制 ---------------- */
  function drawGrid() {
    gGrid.innerHTML = '';
    // 每个格子的底色：用亮度表示值（帮助看场形）
    for (let j = 0; j < GY; j++) {
      for (let i = 0; i < GX; i++) {
        const c = corner(i, j);
        const v = (c.tl + c.tr + c.br + c.bl) / 4;
        gGrid.appendChild(el('rect', {
          x: PAD + i * cw, y: PAD + j * ch, width: cw, height: ch,
          fill: `rgba(226,120,90,${0.03 + v * 0.16})`,
          stroke: 'var(--line)', 'stroke-width': .6,
        }));
      }
    }
    // 等值点用小圆点标出来
    for (let j = 0; j <= GY; j++) {
      for (let i = 0; i <= GX; i++) {
        const v = V[j][i];
        gGrid.appendChild(el('circle', {
          cx: PAD + i * cw, cy: PAD + j * ch, r: 2.4,
          fill: v >= thr ? 'var(--accent)' : 'var(--ink-4)',
          opacity: .85,
        }));
      }
    }
    // 边框
    gGrid.appendChild(el('rect', {
      x: PAD, y: PAD, width: cw * GX, height: ch * GY,
      fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 1,
    }));
  }

  function cellIndex(n) { return { i: n % GX, j: Math.floor(n / GX) }; }

  function drawContours(n) {
    gCont.innerHTML = '';
    gLabels.innerHTML = '';
    for (let k = 0; k < Math.min(n, total); k++) {
      const { i, j } = cellIndex(k);
      const c = corner(i, j);
      const cs = caseOf(c);
      const x0 = PAD + i * cw, y0 = PAD + j * ch;
      (CASES[cs] || []).forEach(([e1, e2]) => {
        const p1 = edgePoint(c, e1, x0, y0, cw, ch);
        const p2 = edgePoint(c, e2, x0, y0, cw, ch);
        gCont.appendChild(el('line', {
          x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
          stroke: 'var(--accent)', 'stroke-width': 2.4, 'stroke-linecap': 'round',
        }));
      });
    }

    // 高亮当前格：只在这一格里标四个角的值，否则整屏都是数字
    gHot.innerHTML = '';
    if (n > 0 && n <= total) {
      const { i, j } = cellIndex(n - 1);
      const hx = PAD + i * cw, hy = PAD + j * ch;
      gHot.appendChild(el('rect', {
        x: hx, y: hy, width: cw, height: ch,
        fill: 'var(--gold)', 'fill-opacity': .08,
        stroke: 'var(--gold)', 'stroke-width': 2,
      }));
      const c = corner(i, j);
      const putCorner = (x, y, v, anchor) => {
        gHot.appendChild(el('text', {
          x, y, class: 'ax-t', 'font-size': 10.5,
          'text-anchor': anchor || 'middle', 'font-weight': 600,
          fill: v >= thr ? 'var(--gold)' : 'var(--ink-3)',
          text: v.toFixed(2),
        }));
      };
      putCorner(hx + cw / 2, hy - 4, c.tl);
      putCorner(hx + cw + 2, hy + ch / 2 + 3, c.tr, 'start');
      putCorner(hx + cw / 2, hy + ch + 11, c.br);
      putCorner(hx - 2, hy + ch / 2 + 3, c.bl, 'end');
      $('#cell-id').textContent = `${i},${j}`;
      $('#cell-case').textContent = String(caseOf(c)) + ' (' + ['tl', 'tr', 'br', 'bl']
        .map((k, b) => (c[k] >= thr ? String(1 << b) : '')).filter(Boolean).join('+') + ')';
    } else {
      $('#cell-id').textContent = '—';
      $('#cell-case').textContent = '—';
    }
  }

  function setProcessed(n) {
    processed = Math.max(0, Math.min(total, n));
    $('#cells').value = String(processed);
    $('#cells-v').textContent = String(processed);
    drawContours(processed);
  }

  /* ---------------- 交互 ---------------- */
  $('#th').addEventListener('input', e => {
    thr = +e.target.value;
    $('#th-v').textContent = thr.toFixed(2);
    drawGrid();
    drawContours(processed);
  });
  $('#cells').max = String(total);
  $('#cells').addEventListener('input', e => setProcessed(+e.target.value));

  let playing = false, timer = null;
  $('#play').addEventListener('click', () => {
    playing = !playing;
    $('#play').textContent = playing ? pick('暂停','Pause') : pick('播放','Play');
    $('#play').classList.toggle('primary', !playing);
    clearInterval(timer);
    if (playing) {
      if (processed >= total) setProcessed(0);
      timer = setInterval(() => {
        if (processed >= total) { clearInterval(timer); playing = false; $('#play').textContent = pick('播放','Play'); $('#play').classList.add('primary'); return; }
        setProcessed(processed + 1);
      }, 90);
    }
  });
  $('#step').addEventListener('click', () => setProcessed(processed + 1));
  $('#reset').addEventListener('click', () => setProcessed(0));

  { const btn = $('#play'); if (btn) btn.textContent = pick('播放', 'Play'); }
  drawGrid();
  setProcessed(0);
  document.addEventListener('wbl:localechange', () => {
    const btn = $('#play');
    if (btn) btn.textContent = playing ? pick('暂停', 'Pause') : pick('播放', 'Play');
    drawGrid(); drawContours(processed);
  });
})();
