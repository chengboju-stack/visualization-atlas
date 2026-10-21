/* ==========================================================================
   lab-gamut.js · CIELAB 色域切片
   真正的色彩换算：sRGB → 线性 → XYZ(D65) → Lab；反向换算时判断是否落在 0..1 内。
   画面里每一个上色的点，都是「显示得出来」的颜色；留白的地方显示不出来。
   ========================================================================== */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const W = 440, H = 440;
  const A_MIN = -110, A_MAX = 110, B_MIN = -110, B_MAX = 110;

  const cvs = $('#gamut');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  /* ---------------- 色彩换算 ---------------- */
  const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toSrgb = v => {
    const x = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return x * 255;
  };
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const f1 = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const f1i = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);

  function labToRgb(L, a, b) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const X = Xn * f1i(fx), Y = Yn * f1i(fy), Z = Zn * f1i(fz);
    const r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    const g = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
    const bl = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    return [toSrgb(r), toSrgb(g), toSrgb(bl)];
  }
  function rgbToLab(r, g, b) {
    const R = toLin(r), G = toLin(g), B = toLin(b);
    const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
    const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
    const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B;
    const fx = f1(X / Xn), fy = f1(Y / Yn), fz = f1(Z / Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  const inGamut = rgb => rgb.every(v => v >= -0.6 && v <= 255.6);

  /* ---------------- 绘制 ---------------- */
  let L = 60;

  function draw() {
    const img = ctx.createImageData(W, H);
    const d = img.data;
    // 每 2×2 像素采一次样，画成 2×2 的块：足够平滑，又比逐像素快
    const STEP = 2;
    for (let py = 0; py < H; py += STEP) {
      const b = B_MAX - (py / H) * (B_MAX - B_MIN);
      for (let px = 0; px < W; px += STEP) {
        const a = A_MIN + (px / W) * (A_MAX - A_MIN);
        const rgb = labToRgb(L, a, b);
        let R, G, B;
        if (inGamut(rgb)) {
          R = Math.max(0, Math.min(255, Math.round(rgb[0])));
          G = Math.max(0, Math.min(255, Math.round(rgb[1])));
          B = Math.max(0, Math.min(255, Math.round(rgb[2])));
        } else {
          const g = 32; R = g; G = g + 3; B = g + 8;
        }
        for (let y = py; y < Math.min(H, py + STEP); y++) {
          for (let x = px; x < Math.min(W, px + STEP); x++) {
            const i = (y * W + x) * 4;
            d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // 坐标轴与标注
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zx = (0 - A_MIN) / (A_MAX - A_MIN) * W;
    const zy = H - (0 - B_MIN) / (B_MAX - B_MIN) * H;
    ctx.moveTo(zx, 0); ctx.lineTo(zx, H);
    ctx.moveTo(0, zy); ctx.lineTo(W, zy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '11px "Cascadia Mono", Consolas, monospace';
    const lab = (x, y, t, anchor) => { ctx.textAlign = anchor || 'left'; ctx.fillText(t, x, y); };
    lab(6, 14, '+b*  ' + pick('黄', 'yellow'));
    lab(6, H - 8, '−b*  ' + pick('蓝', 'blue'));
    lab(W - 6, zy - 8, '+a*  ' + pick('红', 'red'), 'right');
    lab(6, zy - 8, '−a*  ' + pick('绿', 'green'));
    ctx.restore();
  }

  /* ---------------- 取色 ---------------- */
  function sample(e) {
    const r = cvs.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    const py = (e.clientY - r.top) / r.height * H;
    const a = A_MIN + (px / W) * (A_MAX - A_MIN);
    const b = B_MAX - (py / H) * (B_MAX - B_MIN);
    const rgb = labToRgb(L, a, b);
    $('#lab-L').textContent = L.toFixed(0);
    $('#lab-a').textContent = a.toFixed(1);
    $('#lab-b').textContent = b.toFixed(1);
    if (inGamut(rgb)) {
      const hex = '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
      cvs.style.boxShadow = `0 0 0 3px ${hex}, 0 0 24px ${hex}`;
    } else {
      cvs.style.boxShadow = '0 0 0 3px #555, 0 0 24px rgba(0,0,0,.6)';
    }
  }
  cvs.addEventListener('click', sample);

  /* ---------------- 控件 ---------------- */
  $('#L').addEventListener('input', e => {
    L = +e.target.value;
    $('#L-v').textContent = String(L);
    draw();
  });

  let sweeping = false;
  $('#sweep').addEventListener('click', () => {
    if (sweeping) return;
    sweeping = true;
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / 3200);
      L = Math.round(15 + p * 80);
      $('#L').value = String(L);
      $('#L-v').textContent = String(L);
      draw();
      if (p < 1) requestAnimationFrame(step); else sweeping = false;
    };
    requestAnimationFrame(step);
  });

  draw();
  document.addEventListener('wbl:localechange', draw);
})();
