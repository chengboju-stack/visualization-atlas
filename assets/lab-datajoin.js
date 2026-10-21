/* ==========================================================================
   lab-datajoin.js · enter / update / exit 的真实差分与补间
   ========================================================================== */
(function () {
  'use strict';
  const { el, svg, lin, tween, ease, scrolly } = window.LabKit;
  const $ = s => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  const W = 460, H = 300;
  const P = { t: 30, b: 52, l: 34, r: 18 };
  const UNIT = 28;
  const BAR_W = 46;

  const host = $('#stage');
  const stage = svg(W, H);
  host.replaceWith(stage);
  stage.id = 'stage';

  const g = el('g');
  stage.appendChild(g);

  // x 轴基线
  g.appendChild(el('line', {
    x1: P.l - 8, x2: W - P.r, y1: H - P.b, y2: H - P.b, class: 'ax',
  }));

  const slots = 8;                       // 最多 8 个槽位，位置按槽算，便于观察 enter/exit
  const sx = i => P.l + i * ((W - P.l - P.r) / slots) + ((W - P.l - P.r) / slots - BAR_W) / 2;
  const baseline = H - P.b;

  let keyMode = 'index';
  let cur = [];                          // [{ v, node }]
  let anims = [];

  function stopAnims() { anims.forEach(a => a.cancel()); anims = []; }

  function setCounts({ enter, update, exit }) {
    $('#n-enter').textContent = enter;
    $('#n-update').textContent = update;
    $('#n-exit').textContent = exit;
    $('#n-total').textContent = cur.length;
  }

  function caption(arr) {
    $('#cap-data').textContent = '[' + arr.join(', ') + ']';
    $('#cap-mode').textContent = pick('enter · update · exit', 'enter · update · exit');
  }

  function render(next) {
    stopAnims();
    const data = next.map(Number).filter(n => Number.isFinite(n) && n >= 0).slice(0, slots);
    const old = cur;
    const maxV = Math.max(1, ...data, ...old.map(d => d.v));
    const sy = v => baseline - (v / maxV) * (baseline - P.t);

    // ---- 差分：按索引或按值配对 ----
    const matched = new Array(data.length).fill(null);
    const usedOld = new Array(old.length).fill(false);

    if (keyMode === 'value') {
      data.forEach((v, i) => {
        const j = old.findIndex((o, k) => !usedOld[k] && o.v === v);
        if (j >= 0) { matched[i] = j; usedOld[j] = true; }
      });
    } else {
      data.forEach((v, i) => {
        if (i < old.length) { matched[i] = i; usedOld[i] = true; }
      });
    }

    const enters = [], updates = [], exits = [];
    data.forEach((v, i) => (matched[i] == null ? enters : updates).push(i));
    old.forEach((o, j) => { if (!usedOld[j]) exits.push(j); });

    // ---- exit：缩回基线后移除 ----
    exits.forEach(j => {
      const o = old[j];
      const h0 = Math.abs(+o.node.getAttribute('height') || 0);
      const y0 = +o.node.getAttribute('y') || baseline;
      anims.push(tween(360, (t) => {
        o.node.setAttribute('height', Math.max(0, h0 * (1 - t)));
        o.node.setAttribute('y', baseline - h0 * (1 - t));
        o.node.setAttribute('opacity', String(1 - t * .9));
        o.node.style.fill = 'var(--d6)';
      }, ease.cubicInOut, () => o.node.remove()));
      // 数值标签也要跟着走，否则会留下孤零零的数字
      const lab0 = g.querySelector(`text[data-for="${o.node.dataset.id}"]`);
      if (lab0) {
        anims.push(tween(360, t => { lab0.setAttribute('opacity', String(1 - t)); },
          ease.cubicInOut, () => lab0.remove()));
      }
    });

    // ---- update：位置与高度同时补间 ----
    const nextNodes = new Array(data.length).fill(null);
    updates.forEach(i => {
      const o = old[matched[i]];
      nextNodes[i] = o.node;
      const x0 = +o.node.getAttribute('x'), y0 = +o.node.getAttribute('y');
      const h0 = +o.node.getAttribute('height');
      const x1 = sx(i), h1 = baseline - sy(data[i]);
      const y1 = sy(data[i]);
      anims.push(tween(520, (t) => {
        o.node.setAttribute('x', x0 + (x1 - x0) * t);
        o.node.setAttribute('y', y0 + (y1 - y0) * t);
        o.node.setAttribute('height', Math.max(0, h0 + (h1 - h0) * t));
      }, ease.cubicInOut));
      o.v = data[i];
      // 值标签
      const lab = o.node.parentNode.querySelector(`text[data-for="${o.node.dataset.id}"]`);
      if (lab) {
        lab.setAttribute('x', x1 + BAR_W / 2);
        lab.setAttribute('y', y1 - 7);
        lab.textContent = String(data[i]);
      }
    });

    // ---- enter：从基线长出来 ----
    enters.forEach(i => {
      const node = el('rect', {
        x: sx(i), y: baseline, width: BAR_W, height: 0, rx: 3,
        fill: 'var(--d1)', class: 'fade-in',
        'data-id': 'bar-' + Math.random().toString(36).slice(2, 7),
      });
      g.insertBefore(node, g.querySelector('text'));
      nextNodes[i] = node;
      const h1 = baseline - sy(data[i]);
      node.style.fill = 'var(--d1)';       // 新元素先橙
      node.style.transition = 'fill .5s ease';
      setTimeout(() => { node.style.fill = 'var(--d2)'; }, 80);   // 再落回默认蓝
      anims.push(tween(520, (t) => {
        node.setAttribute('height', Math.max(0, h1 * t));
        node.setAttribute('y', baseline - h1 * t);
      }, ease.backOut));

      const lab = el('text', {
        x: sx(i) + BAR_W / 2, y: sy(data[i]) - 7, class: 'ax-t',
        'text-anchor': 'middle', 'data-for': node.dataset.id, text: String(data[i]),
      });
      g.appendChild(lab);
    });

    // 重建 cur（保序）
    cur = data.map((v, i) => ({ v, node: nextNodes[i] })).filter(d => d.node);
    setCounts({ enter: enters.length, update: updates.length, exit: exits.length });
    caption(data);

    // 标签随 update 一起移动（enter 的标签已经建好）
    requestAnimationFrame(() => {
      cur.forEach((o, i) => {
        const lab = g.querySelector(`text[data-for="${o.node.dataset.id}"]`);
        if (lab) { lab.setAttribute('x', sx(i) + BAR_W / 2); }
      });
    });
  }

  /* ---------------------------- 交互 ---------------------------- */
  const parse = s => s.split(/[,，\s]+/).map(Number).filter(n => Number.isFinite(n) && n >= 0);

  $('#arr-apply').addEventListener('click', () => {
    const arr = parse($('#arr-input').value);
    if (arr.length) render(arr);
  });
  $('#arr-random').addEventListener('click', () => {
    const n = 2 + Math.floor(Math.random() * 6);
    const arr = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 9));
    $('#arr-input').value = arr.join(', ');
    render(arr);
  });
  $('#arr-reset').addEventListener('click', () => {
    $('#arr-input').value = '3, 5, 2';
    render([3, 5, 2]);
  });
  document.querySelectorAll('#key-mode button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#key-mode button').forEach(x => x.classList.toggle('active', x === b));
      keyMode = b.dataset.key;
      // 用当前数据重放一次，让 key 的影响可见
      const arr = cur.map(o => o.v);
      render(arr);
    });
  });

  /* ---------------------------- 滚动叙事 ---------------------------- */
  const SCENES = [[3, 5, 2], [3, 5, 2, 7, 4], [4, 6, 3], [3, 5, 2]];
  scrolly($('#scrolly'), {
    onStep(i) {
      const arr = SCENES[Math.min(i, SCENES.length - 1)];
      $('#arr-input').value = arr.join(', ');
      render(arr);
    },
  });

  // 初始
  render([3, 5, 2]);

  document.addEventListener('wbl:localechange', () => caption(cur.map(o => o.v)));
})();
