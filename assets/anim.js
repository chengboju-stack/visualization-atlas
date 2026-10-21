/* ==========================================================================
   anim.js · 全站轻量动效层
   只做两类：进场（滚动到视口才出现）与数字递增。
   动画只用来解释层级与顺序，不参与信息表达。
   ========================================================================== */
(function () {
  'use strict';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1) 进场：给主要区块加 .reveal，进入视口后加 .is-in */
  const targets = document.querySelectorAll(
    'main > section, .lab-card, .chap-card, .map-node, .ch-card, .sec-head'
  );
  if (!reduce && 'IntersectionObserver' in window) {
    targets.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(i, 6) * 40 + 'ms';
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    targets.forEach(el => io.observe(el));
  }

  /* 2) 数字递增：hero-stats 里的数字 */
  const stats = document.querySelectorAll('.hero-stats b');
  if (!reduce && stats.length) {
    const countUp = (node) => {
      const raw = node.textContent.trim();
      const end = parseInt(raw, 10);
      if (!Number.isFinite(end)) return;
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / 900);
        node.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step); else node.textContent = raw;
      };
      requestAnimationFrame(step);
    };
    const io2 = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { countUp(e.target); io2.unobserve(e.target); } });
    }, { threshold: 0.6 });
    stats.forEach(s => io2.observe(s));
  }

  /* 3) 卡片轻微跟随鼠标（只在指针设备上） */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.lab-card, .chap-card, .map-node > a').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - .5;
        const dy = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `translate(${dx * 3}px, ${dy * 3 - 2}px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }
})();
