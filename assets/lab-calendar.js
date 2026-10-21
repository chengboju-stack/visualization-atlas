/* ==========================================================================
   lab-calendar.js · van Wijk 日历热图 + 年趋势线，两者 brushing & linking
   数据为确定性生成（同一天永远同一个值），不涉及任何真实统计。
   ========================================================================== */
(function () {
  'use strict';
  const { el, svg, lin, fmt } = window.LabKit;
  const $ = s => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const COLS = 53, ROWS = 7;
  const P = { t: 22, l: 34, r: 16, b: 24 };
  const CW = 640, CH = 230;
  const cw = (CW - P.l - P.r) / COLS;
  const chh = (CH - P.t - P.b) / ROWS;

  const TW = 640, TH = 120;
  const TP = { t: 14, l: 34, r: 16, b: 22 };

  // 确定性伪随机
  const mulberry = seed => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function series(year) {
    const rnd = mulberry(year * 7919);
    const start = Date.UTC(year, 0, 1);
    const days = (year % 4 === 0) ? 366 : 365;
    const out = [];
    for (let d = 0; d < days; d++) {
      const dt = new Date(start + d * 86400000);
      const doy = d / days * Math.PI * 2;
      const weekday = dt.getUTCDay();
      // 季节 + 周内节律 + 噪声
      const seasonal = 0.5 + 0.32 * Math.sin(doy - 1.1);
      const weekly = weekday === 0 || weekday === 6 ? -0.16 : 0.05;
      const v = Math.max(0, Math.min(1, seasonal + weekly + (rnd() - .5) * .18));
      out.push({ d, date: dt, v, weekday });
    }
    return out;
  }

  let year = 2024;
  let data = series(year);
  let firstDow = data[0].date.getUTCDay();
  let sel = null;                       // [i0, i1]

  const cal = svg(CW, CH);
  $('#cal').replaceWith(cal);
  cal.id = 'cal';
  const G = el('g'); cal.appendChild(G);

  const trend = svg(TW, TH);
  $('#trend').replaceWith(trend);
  trend.id = 'trend';
  const G2 = el('g'); trend.appendChild(G2);

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

  function drawCalendar() {
    G.innerHTML = '';
    const firstDow = data[0].date.getUTCDay();
    // 每个月起点画分隔线
    const monthStart = new Set();
    data.forEach(o => { if (o.date.getUTCDate() === 1) monthStart.add(o.d); });

    data.forEach(o => {
      const col = Math.floor((o.d + firstDow) / 7);
      const row = (o.d + firstDow) % 7;
      const x = P.l + col * cw, y = P.t + row * chh;
      const inSel = sel && o.d >= sel[0] && o.d <= sel[1];
      const r = el('rect', {
        x, y, width: Math.max(2, cw - 1.2), height: Math.max(2, chh - 1.2),
        rx: 1.6, fill: color(o.v),
        stroke: inSel ? 'var(--accent)' : 'none', 'stroke-width': inSel ? 1.2 : 0,
      });
      window.LabKit.tip(r, () => `<b>${o.date.toISOString().slice(0, 10)}</b>　${o.v.toFixed(2)}`);
      G.appendChild(r);
      if (monthStart.has(o.d)) {
        G.appendChild(el('line', {
          x1: x - .5, x2: x - .5, y1: P.t - 6, y2: P.t + ROWS * chh + 2,
          stroke: 'var(--line-2)', 'stroke-width': 1, opacity: .8,
        }));
        G.appendChild(el('text', {
          x: x + 2, y: P.t - 9, class: 'ax-t', 'font-size': 8.5,
          text: pick((o.date.getUTCMonth() + 1) + '月', 'M' + (o.date.getUTCMonth() + 1)),
        }));
      }
    });

    // 星期标签
    ['日', '一', '二', '三', '四', '五', '六'].forEach((t, i) => {
      G.appendChild(el('text', {
        x: P.l - 8, y: P.t + i * chh + chh * .7, class: 'ax-t', 'text-anchor': 'end',
        text: pick(t, ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i]),
      }));
    });

  }

  /* 框选：事件只绑定一次，重绘只换格子，避免监听器越绑越多 */
  function initBrush() {
    let down = null;
    const toIndex = e => {
      const r = cal.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * CW;
      const col = Math.floor((px - P.l) / cw);
      const py = (e.clientY - r.top) / r.height * CH;
      const row = Math.floor((py - P.t) / chh);
      if (col < 0 || col >= COLS || row < 0 || row > 6) return null;
      const idx = col * 7 + row - firstDow;
      return Math.max(0, Math.min(data.length - 1, idx));
    };
    cal.addEventListener('pointerdown', e => {
      down = toIndex(e);
      if (down != null) { cal.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    cal.addEventListener('pointermove', e => {
      if (down == null) return;
      const cur = toIndex(e);
      if (cur == null) return;
      sel = [Math.min(down, cur), Math.max(down, cur)];
      drawCalendar();
      drawTrend();
    });
    const up = () => { down = null; };
    cal.addEventListener('pointerup', up);
    cal.addEventListener('pointercancel', up);
    cal.addEventListener('pointerleave', up);
  }

  function drawTrend() {
    G2.innerHTML = '';
    const n = data.length;
    const sx = lin(0, n - 1, TP.l, TW - TP.r);
    const ys = lin(0, 1, TH - TP.b, TP.t);
    // 网格
    [0, .5, 1].forEach(v => {
      G2.appendChild(el('line', { x1: TP.l, x2: TW - TP.r, y1: ys(v), y2: ys(v), class: 'grid-l' }));
      G2.appendChild(el('text', { x: TP.l - 6, y: ys(v) + 3, class: 'ax-t', 'text-anchor': 'end', text: v.toFixed(1) }));
    });
    // 选中区间底色
    if (sel) {
      G2.appendChild(el('rect', {
        x: sx(sel[0]), y: TP.t, width: Math.max(1, sx(sel[1]) - sx(sel[0])),
        height: TH - TP.t - TP.b, fill: 'var(--accent)', opacity: '.14',
      }));
    }
    // 折线
    const d = data.map((o, i) => `${i ? 'L' : 'M'} ${sx(i)} ${ys(o.v)}`).join(' ');
    G2.appendChild(el('path', { d, fill: 'none', stroke: 'var(--accent-2)', 'stroke-width': 1.6, opacity: .9 }));

    // 按月标签
    for (let m = 0; m < 12; m++) {
      const i = data.findIndex(o => o.date.getUTCMonth() === m && o.date.getUTCDate() === 1);
      if (i < 0) continue;
      G2.appendChild(el('text', {
        x: sx(i), y: TH - 6, class: 'ax-t', 'text-anchor': 'middle',
        text: pick((m + 1) + '月', 'M' + (m + 1)),
      }));
    }

    // 读值
    if (sel) {
      const arr = data.slice(sel[0], sel[1] + 1);
      const mean = arr.reduce((a, o) => a + o.v, 0) / arr.length;
      $('#sel').textContent = `${arr[0].date.toISOString().slice(5, 10)} → ${arr[arr.length - 1].date.toISOString().slice(5, 10)}`;
      $('#mean').textContent = mean.toFixed(2);
    } else {
      $('#sel').textContent = '—';
      const mean = data.reduce((a, o) => a + o.v, 0) / data.length;
      $('#mean').textContent = mean.toFixed(2);
    }
  }

  $('#year').addEventListener('change', e => {
    year = +e.target.value;
    data = series(year);
    firstDow = data[0].date.getUTCDay();
    sel = null;
    drawCalendar();
    drawTrend();
  });

  initBrush();
  drawCalendar();
  drawTrend();
  document.addEventListener('wbl:localechange', () => { drawCalendar(); drawTrend(); });
})();
