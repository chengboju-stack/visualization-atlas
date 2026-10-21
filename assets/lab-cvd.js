/* ==========================================================================
   lab-cvd.js · 色觉缺陷模拟
   模型：Machado, Oliveira & Fernandes (2009), IEEE TVCG 15(6)
   使用 severity = 1.0 的 3×3 矩阵，与 Chrome DevTools 的「模拟视觉缺陷」一致。
   流程：sRGB → 去 gamma（线性化）→ 矩阵变换 → 回 gamma。
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const M = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
  };

  const hex2rgb = h => {
    const s = h.replace('#', '');
    const n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  };
  const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map(v =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toSrgb = v => {
    const x = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return x * 255;
  };

  function simulate(hex, type) {
    if (!type || type === 'normal') return hex;
    const m = M[type];
    if (!m) return hex;
    const [r, g, b] = hex2rgb(hex);
    const lin = [toLin(r), toLin(g), toLin(b)];
    const out = m.map(row => toSrgb(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]));
    return rgb2hex(out);
  }

  /* ---------------------------- 色板 ---------------------------- */
  const PALETTES = {
    site: {
      zh: '本网站默认分类色板', en: 'Site categorical palette',
      colors: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999'],
      okabe: true,
    },
    naive: {
      zh: '常见错误：红绿对比 + 黄', en: 'Common mistake: red / green / yellow',
      colors: ['#ff3b30', '#34c759', '#ffcc00', '#5856d6'],
      okabe: false,
    },
    rainbow: {
      zh: '彩虹色阶（连续量却用色相编码）', en: 'Rainbow scale for a continuous value',
      colors: ['#6b1fbf', '#2b6cff', '#22c1c3', '#8bd450', '#ffd400', '#ff8a00', '#e01b1b'],
      okabe: false,
    },
  };

  const OKABE = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999'];

  const MODES = [
    { key: 'normal', zh: '正常视觉', en: 'Normal vision' },
    { key: 'protan', zh: '红色盲', en: 'Protanopia' },
    { key: 'deutan', zh: '绿色盲', en: 'Deuteranopia' },
    { key: 'tritan', zh: '蓝色盲', en: 'Tritanopia' },
  ];

  let mode = 'normal';
  let paletteKey = 'naive';

  function renderSeg() {
    const host = $('#cvd-seg');
    if (!host) return;
    host.innerHTML = '';
    MODES.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = m.key === mode ? 'active' : '';
      b.textContent = pick(m.zh, m.en);
      b.addEventListener('click', () => { mode = m.key; render(); });
      host.appendChild(b);
    });
  }

  function swatches(host, colors, sim, labelFn) {
    if (!host) return;
    host.innerHTML = colors.map((c, i) => {
      const shown = sim ? simulate(c, mode) : c;
      const rgb = hex2rgb(shown);
      const lum = (0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2]));
      const ink = lum > 0.35 ? '#111' : '#fff';
      return `<div class="cvd-swatch" style="background:${shown};color:${ink}">
        <b>${labelFn ? labelFn(i) : 'C' + (i + 1)}</b>
        <code>${shown.toUpperCase()}</code>
      </div>`;
    }).join('');
  }

  /* ---------------------------- 图形 ---------------------------- */
  const SERIES_A = [0.35, 0.62, 0.48, 0.8, 0.55];
  const SERIES_B = [0.5, 0.44, 0.7, 0.52, 0.72];
  const SERIES_C = [0.28, 0.7, 0.36, 0.66, 0.42];

  function bars(svg, colors, sim) {
    if (!svg) return;
    let x = 6;
    let out = '';
    SERIES_A.forEach((v, i) => {
      const c = sim ? simulate(colors[i % colors.length], mode) : colors[i % colors.length];
      const h = v * 80;
      out += `<rect x="${x}" y="${88 - h}" width="26" height="${h}" rx="2" fill="${c}"/>`;
      x += 32;
    });
    svg.innerHTML = out;
  }

  function lines(svg, colors, sim) {
    if (!svg) return;
    const cs = [0, 1, 2].map(i => sim ? simulate(colors[i % colors.length], mode) : colors[i % colors.length]);
    const path = arr => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${10 + i * 72} ${86 - v * 74}`).join(' ');
    svg.innerHTML = [SERIES_A, SERIES_B, SERIES_C].map((arr, i) =>
      `<path d="${path(arr)}" fill="none" stroke="${cs[i]}" stroke-width="2.6" stroke-linecap="round"/>`).join('')
      + [SERIES_A, SERIES_B, SERIES_C].map((arr, i) =>
        arr.map((v, j) => `<circle cx="${10 + j * 72}" cy="${86 - v * 74}" r="2.6" fill="${cs[i]}"/>`).join('')).join('');
  }

  function renderNote() {
    const el = $('#cvd-note');
    if (!el) return;
    const map = {
      normal: ['正常视觉下这些颜色可以区分。问题在于——这只是你的视觉。',
        'Under normal vision these colours are separable. The catch: that is your vision.'],
      protan: ['红色盲把红、橙、黄压成了同一类。原本靠红/绿区分的两条序列，现在几乎重合。',
        'Protanopia collapses red, orange and yellow into one family. Series that relied on red versus green now nearly coincide.'],
      deutan: ['绿色盲最常见（约 6% 男性）。红绿对比失效，但蓝色/橙色仍然可分——这就是为什么配色要拉开明度，而不只是换色相。',
        'Deuteranopia is the most common (~6% of men). Red–green contrast fails while blue/orange survives — which is why palettes must vary lightness, not just hue.'],
      tritan: ['蓝色盲罕见，但会让「蓝-绿」和「黄-粉」这类组合失效。彩虹色阶在这里几乎完全失去顺序信息。',
        'Tritanopia is rare but breaks blue–green and yellow–pink pairs. A rainbow scale loses almost all of its order.'],
    };
    const [zh, en] = map[mode] || map.normal;
    el.textContent = pick(zh, en);
  }

  function render() {
    renderSeg();
    const pal = PALETTES[paletteKey].colors;
    swatches($('#cvd-normal'), pal, false, i => 'C' + (i + 1));
    swatches($('#cvd-sim'), pal, true, i => 'C' + (i + 1));
    swatches($('#cvd-okabe'), OKABE, true, i => 'C' + (i + 1));
    bars($('#bars-normal'), pal, false);
    bars($('#bars-sim'), pal, true);
    lines($('#line-normal'), pal, false);
    lines($('#line-sim'), pal, true);
    renderNote();

    const cap = $('#cvd-sim-cap');
    if (cap) {
      const m = MODES.find(x => x.key === mode);
      cap.textContent = pick('模拟结果 · ', 'Simulated · ') + pick(m.zh, m.en);
    }
  }

  render();
  document.addEventListener('wbl:localechange', render);
})();
