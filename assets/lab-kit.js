/* ==========================================================================
   lab-kit.js · 实验台通用工具（无依赖）
   - SVG/DOM 构造、比例尺、缓动、补间
   - 滚动叙事控制器（IntersectionObserver + sticky 舞台）
   - 播放/暂停/步进控制器
   - Machado 2009 色盲模拟（多个实验台共用）
   ========================================================================== */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  const el = (tag, attrs, kids) => {
    const isSvg = ['svg', 'g', 'path', 'rect', 'circle', 'line', 'text', 'polyline',
      'polygon', 'ellipse', 'defs', 'linearGradient', 'stop', 'clipPath', 'pattern', 'use'].includes(tag);
    const n = isSvg ? document.createElementNS(NS, tag) : document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else n.setAttribute(k, v);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.appendChild(c));
    return n;
  };

  const svg = (w, h, attrs) => el('svg', Object.assign({
    viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet',
  }, attrs || {}));

  const lin = (d0, d1, r0, r1) => v => r0 + ((v - d0) / ((d1 - d0) || 1)) * (r1 - r0);
  const fmt = (n, d = 0) => {
    if (!Number.isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return a < 10 && d ? n.toFixed(d) : String(Math.round(n * 10) / 10);
  };

  const ease = {
    linear: t => t,
    cubicOut: t => 1 - Math.pow(1 - t, 3),
    cubicInOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    backOut: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
    smooth: t => t * t * (3 - 2 * t),
  };

  // 基于 rAF 的补间；返回可取消的句柄
  function tween(ms, onFrame, easeFn = ease.cubicOut, onDone) {
    const t0 = performance.now();
    let raf = 0, cancelled = false;
    const step = now => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / Math.max(1, ms));
      onFrame(easeFn(t), t);
      if (t < 1) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    };
    raf = requestAnimationFrame(step);
    return { cancel() { cancelled = true; cancelAnimationFrame(raf); } };
  }

  /* ---------------------------- 滚动叙事 ---------------------------- */
  // 结构：.scrolly > .steps(li.step) + .stage
  function scrolly(root, { onStep, onProgress } = {}) {
    const steps = Array.from(root.querySelectorAll('.step'));
    const stage = root.querySelector('.stage');
    if (!steps.length || !stage) return;

    const setActive = (idx) => {
      steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      if (onStep) onStep(idx);
    };

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) setActive(steps.indexOf(e.target));
      });
    }, { root: null, rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    steps.forEach(s => io.observe(s));

    // 进度：在整个 scrolly 区块内 0→1
    if (onProgress) {
      const prog = () => {
        const r = root.getBoundingClientRect();
        const vh = window.innerHeight;
        const total = r.height - vh;
        const p = total > 0 ? Math.min(1, Math.max(0, (-r.top) / total)) : 0;
        onProgress(p);
      };
      window.addEventListener('scroll', prog, { passive: true });
      prog();
    }

    setActive(0);
    return {
      goto(i) {
        steps[Math.max(0, Math.min(steps.length - 1, i))].scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    };
  }

  /* ---------------------------- 播放控制 ---------------------------- */
  // 逐帧播放：[0..frames-1]，可暂停、拖拽
  function stepper({ frames, onFrame, button, range, label, auto = false, interval = 620 }) {
    let i = 0, timer = null, playing = false;
    const render = () => {
      onFrame(i);
      if (range) range.value = String(i);
      if (label) label.textContent = `${i + 1} / ${frames}`;
    };
    const tick = () => {
      i = (i + 1) % frames;
      render();
    };
    const play = () => {
      if (playing) return;
      playing = true;
      if (button) { button.textContent = '暂停'; button.classList.add('primary'); }
      timer = setInterval(tick, interval);
    };
    const pause = () => {
      playing = false;
      clearInterval(timer);
      if (button) { button.textContent = '播放'; button.classList.remove('primary'); }
    };
    if (button) button.addEventListener('click', () => (playing ? pause() : play()));
    if (range) {
      range.max = String(frames - 1);
      range.addEventListener('input', () => { pause(); i = +range.value; render(); });
    }
    render();
    if (auto) play();
    return { play, pause, goto(n) { pause(); i = n; render(); }, get index() { return i; } };
  }

  /* ---------------------------- 色盲模拟 ---------------------------- */
  const M = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
  };
  const hex2rgb = h => {
    const s = String(h).replace('#', '');
    const n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  };
  const rgb2hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toSrgb = v => {
    const x = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return x * 255;
  };
  function cvd(hex, type) {
    const m = M[type];
    if (!m) return hex;
    const [r, g, b] = hex2rgb(hex);
    const l = [toLin(r), toLin(g), toLin(b)];
    return rgb2hex(m.map(row => toSrgb(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])));
  }

  const OKABE = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999'];

  /* ---------------------------- 提示框 ---------------------------- */
  let tipEl = null;
  function tip(target, html) {
    const show = e => {
      if (!tipEl) { tipEl = el('div', { class: 'lab-tip' }); document.body.appendChild(tipEl); }
      tipEl.innerHTML = typeof html === 'function' ? html() : html;
      tipEl.style.opacity = '1';
      const r = tipEl.getBoundingClientRect();
      const x = Math.min(window.innerWidth - r.width - 10, Math.max(8, (e.clientX || 0) + 14));
      const y = Math.max(8, (e.clientY || 0) - r.height - 12);
      tipEl.style.transform = `translate(${x}px, ${y}px)`;
    };
    const hide = () => { if (tipEl) tipEl.style.opacity = '0'; };
    target.addEventListener('mouseenter', show);
    target.addEventListener('mousemove', show);
    target.addEventListener('mouseleave', hide);
  }

  /* ---------------------------- 动画 CSS 注入 ---------------------------- */
  // 提示框样式只在这里定义一次，避免每个页面重复
  const css = `
  .lab-tip{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;opacity:0;
    transition:opacity .12s;background:var(--bg-3);border:1px solid var(--line-2);
    border-radius:8px;padding:7px 10px;font:12px/1.6 var(--f-sans);color:var(--ink);
    box-shadow:var(--shadow-2);max-width:260px}
  .lab-tip b{font-family:var(--f-mono);color:var(--accent)}
  .fade-in{animation:fadeIn .4s ease both}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  window.LabKit = { el, svg, lin, fmt, ease, tween, scrolly, stepper, cvd, OKABE, tip, hex2rgb, rgb2hex };
})();
