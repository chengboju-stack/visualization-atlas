/* ==========================================================================
   shell.js · 课程页的新外壳
   职责：把老师的原内容重新组织成「更好读、更好找、更知道自己在哪」的样子。
   原则：只读不改内容 —— 所有操作都是「包裹 / 加标签 / 加导航」，
        不删除、不改写任何正文、代码或公式。
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const L = (zh, en) => (lang() === 'en' ? en : zh);

  /* ------------------------------------------------------------------
     1) 主题：默认跟随系统，可手动切换并记住
     ------------------------------------------------------------------ */
  function initTheme() {
    const saved = store.get('vis-theme');
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (sysDark ? 'dark' : 'dark');   // 首次访问用深色（本课的视觉基调）
    document.documentElement.dataset.theme = theme;
    const btn = $('#theme-btn');
    if (btn) btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      store.set('vis-theme', next);
    });
  }

  /* ------------------------------------------------------------------
     2) 小节头：把「1.1 数据生成」拆成编号 + 标题，并补元信息
     ------------------------------------------------------------------ */
  function splitHeading(chapter) {
    const h2 = chapter.querySelector(':scope > h2');
    if (!h2) return;
    if (h2.dataset.split === '1') return;
    const raw = (h2.textContent || '').trim();
    const m = raw.match(/^(\d+(?:\.\d+)?)\s+(.*)$/);
    if (!m) return;
    h2.textContent = '';
    const num = document.createElement('span');
    num.className = 'sec-num';
    num.textContent = m[1];
    const name = document.createElement('span');
    name.className = 'sec-name';
    name.textContent = m[2];
    h2.append(num, name);
    h2.dataset.split = '1';
    h2.dataset.raw = raw;
  }

  function addMeta(chapter) {
    if (chapter.querySelector(':scope > .sec-meta')) return;
    const html = chapter.innerHTML;
    const has = {
      theory: /嵌入理论|Embedded Theory|理论核心|Theory Core/.test(html),
      patch: /理论补丁|Theory Patch/.test(html),
      demo: /demo-mount/.test(html),
    };
    const keys = (html.match(/key-point/g) || []).length;

    const meta = document.createElement('div');
    meta.className = 'sec-meta';
    const add = (cls, dot, zh, en) => {
      const el = document.createElement('span');
      el.className = 'chip ' + cls;
      if (dot) el.appendChild(document.createElement('i'));
      const z = document.createElement('span'); z.dataset.lang = 'zh-CN'; z.textContent = zh;
      const e = document.createElement('span'); e.dataset.lang = 'en-US'; e.hidden = true; e.textContent = en;
      el.append(z, e);
      meta.appendChild(el);
    };
    if (has.theory) add('theory', true, '含理论框架', 'Theory');
    if (has.patch) add('patch', false, '含扩展阅读', 'Extension');
    if (keys) add('keys', false, `${keys} 个关键点`, `${keys} key points`);
    if (has.demo) add('demo', true, '可运行演示', 'Live demo');

    const sub = chapter.querySelector(':scope > .chapter-subtitle');
    if (sub) sub.after(meta);
    else chapter.querySelector(':scope > h2').after(meta);
  }

  /* ------------------------------------------------------------------
     3) 内容分层：按原 h3 标记把「案例 / 理论 / 补丁」切块
        不新增任何文字 —— 块标题就用老师原有的 h3
     ------------------------------------------------------------------ */
  const CASE_RE = /^(你的原案例|Your Original Case)/i;
  const THEORY_RE = /^(嵌入理论|Embedded Theory|理论核心|Theory Core)/i;
  const PATCH_RE = /^(理论补丁|Theory Patch)/i;

  function classifyExplain(panel) {
    if (panel.dataset.layered === '1') return;
    panel.dataset.layered = '1';

    const kids = Array.from(panel.children);
    let target = panel;

    const biSpan = (zh, en, attr) => {
      const z = document.createElement('span');
      z.dataset.lang = 'zh-CN'; z.textContent = zh;
      const e = document.createElement('span');
      e.dataset.lang = 'en-US'; e.hidden = true; e.textContent = en;
      if (attr) { z.setAttribute(attr, ''); e.setAttribute(attr, ''); }
      return [z, e];
    };

    // 案例 / 理论：不另造标签 —— 老师原本的 h3（「你的原案例」「嵌入理论」）就是最准确的块标题，
    // 直接用它做块头，既不多一层文字，也自带双语。
    const newCaseOrTheory = (type, marker) => {
      const wrap = document.createElement('section');
      wrap.className = 'blk blk--' + type;
      marker.before(wrap);
      return { el: wrap, target: wrap };
    };

    const newPatch = marker => {
      const d = document.createElement('details');
      d.className = 'blk blk--patch';
      const summary = document.createElement('summary');
      const [z, e] = biSpan('扩展阅读', 'EXTENSION');
      summary.append(z, e);
      d.appendChild(summary);
      const body = document.createElement('div');
      body.className = 'patch-body';
      d.appendChild(body);
      marker.before(d);
      body.appendChild(marker);
      return { el: d, target: body };
    };

    for (const node of kids) {
      if (node.tagName !== 'H3') {
        if (target !== panel) target.appendChild(node);
        continue;
      }
      const text = (node.textContent || '').trim();
      // 原站双语文案是「成对 h3」：<h3 data-lang=zh>…</h3><h3 data-lang=en hidden>…</h3>。
      // 英文那一个必须并进同一块，否则会生成一个只剩边框的空卡片。
      const isPairedEn = node.dataset && node.dataset.lang === 'en-US';
      let type = null;
      if (!isPairedEn) {
        if (CASE_RE.test(text)) type = 'case';
        else if (THEORY_RE.test(text)) type = 'theory';
        else if (PATCH_RE.test(text)) type = 'patch';
      }
      if (!type) { if (target !== panel) target.appendChild(node); continue; }

      const blk = type === 'patch' ? newPatch(node) : newCaseOrTheory(type, node);
      if (type !== 'patch') blk.target.appendChild(node);   // 保留老师的原 h3 作为块内小标题
      target = blk.target;
    }
  }

  /* ------------------------------------------------------------------
     4) 代码面板：每个「关键代码 ① xxx」包成一张代码卡
     ------------------------------------------------------------------ */
  function cardsForCode(panel) {
    if (panel.dataset.carded === '1') return;
    panel.dataset.carded = '1';
    const kids = Array.from(panel.children);
    let card = null, body = null;

    kids.forEach(node => {
      if (node.tagName === 'H3') {
        // 又是成对 h3：中文那个开一张卡，英文那个并进同一张卡的标题
        const isEn = node.dataset && node.dataset.lang === 'en-US';
        if (isEn && card) { card.querySelector('.cc-titles').appendChild(node); return; }

        card = document.createElement('div');
        card.className = 'code-card';
        const head = document.createElement('div');
        head.className = 'cc-head';
        const badge = document.createElement('span');
        badge.className = 'cc-badge';
        badge.textContent = L('代码', 'CODE');
        const titles = document.createElement('div');
        titles.className = 'cc-titles';
        head.append(badge, titles);
        body = document.createElement('div');
        body.className = 'cc-body';
        card.append(head, body);

        // 先把卡插到原标题的位置，再把标题移进卡里 —— 顺序反了会让卡片脱锚
        node.parentNode.insertBefore(card, node);
        titles.appendChild(node);
        return;
      }
      if (card && body) body.appendChild(node);
    });
  }

  /* ------------------------------------------------------------------
     5) 演示面板：套一层仪器外壳，标出实时运行
     ------------------------------------------------------------------ */
  function frameDemo(panel) {
    if (panel.dataset.framed === '1') return;
    panel.dataset.framed = '1';
    const mount = panel.querySelector('.demo-mount, [id^="demo-mount-"]');
    if (!mount) return;
    const frame = document.createElement('div');
    frame.className = 'demo-frame';
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    const dot = document.createElement('span'); dot.className = 'live';
    const label = document.createElement('span');
    label.textContent = L('实时运行', 'LIVE');
    const name = document.createElement('span');
    name.className = 'df-name';
    name.textContent = mount.dataset.demo || mount.id.replace(/^demo-mount-/, '');
    bar.append(dot, label, name);
    frame.appendChild(bar);
    mount.before(frame);
    frame.appendChild(mount);
  }

  /* ------------------------------------------------------------------
     6) 标签页：去掉 emoji，换成一致的文字 + 序号
     ------------------------------------------------------------------ */
  const TAB_LABEL = {
    explain: () => ['讲解', 'Explanation'],
    code: () => ['代码', 'Code'],
    demo: () => ['演示', 'Live demo'],
  };
  function relabelTabs() {
    $$('.tab-btn').forEach((btn, i) => {
      const key = btn.dataset.tab || 'explain';
      btn.removeAttribute('data-i18n');
      btn.setAttribute('role', 'tab');
      const pair = TAB_LABEL[key] ? TAB_LABEL[key]() : [key, key];
      btn.textContent = '';
      const n = document.createElement('span');
      n.className = 'tb-n';
      n.textContent = String(i + 1).padStart(2, '0');
      const t = document.createElement('span');
      t.textContent = pair[lang() === 'en' ? 1 : 0];
      btn.append(n, t);
    });
  }


  function stripRailNumbers() {
    $$('.rail-item').forEach(a => {
      const numEl = a.querySelector('.ri-num');
      const t = a.querySelector('.ri-title');
      if (!numEl || !t) return;
      const num = numEl.textContent.trim();
      const raw = t.textContent.trim();
      if (num && raw.startsWith(num)) t.textContent = raw.slice(num.length).trim();
    });
  }

  /* ------------------------------------------------------------------
     7) 进度、当前小节、翻页
     ------------------------------------------------------------------ */
  function initProgress() {
    const fill = $('#readbar-fill');
    const railFill = $('#rail-progress-fill');
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? Math.min(1, h.scrollTop / max) : 0;
      if (fill) fill.style.width = (p * 100).toFixed(2) + '%';
      if (railFill) railFill.style.width = (p * 100).toFixed(2) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function currentChapterId() {
    const el = $('.chapter.active');
    return el ? el.id : null;
  }

  function syncRail() {
    const id = currentChapterId();
    if (!id) return;
    $$('.rail-item').forEach(a => a.classList.toggle('is-current', a.dataset.chapter === id));
    // 让当前项留在可视范围内
    const cur = $('.rail-item.is-current');
    const nav = $('#rail-nav');
    if (cur && nav) {
      const nr = nav.getBoundingClientRect(), cr = cur.getBoundingClientRect();
      if (cr.top < nr.top || cr.bottom > nr.bottom) cur.scrollIntoView({ block: 'nearest' });
    }
    renderPager(id);
  }

  function renderPager(id) {
    const host = $('#pager');
    if (!host) return;
    const items = $$('.rail-item');
    const idx = items.findIndex(a => a.dataset.chapter === id);
    if (idx < 0) return;
    const mk = (a, dir, isNext) => {
      const el = document.createElement('a');
      el.href = '#' + a.dataset.chapter;
      el.className = 'pager-link' + (isNext ? ' pg-next' : '');
      const d = document.createElement('span'); d.className = 'pg-dir'; d.textContent = dir;
      const t = document.createElement('span'); t.className = 'pg-title';
      const src = a.querySelector('.ri-title');
      t.textContent = src ? src.textContent : '';
      el.append(d, t);
      return el;
    };
    host.textContent = '';
    if (items[idx - 1]) host.appendChild(mk(items[idx - 1], L('上一节', 'Previous'), false));
    else {
      const sp = document.createElement('span'); sp.className = 'pg-empty';
      sp.innerHTML = `<span class="pg-dir">${L('本章开始', 'Chapter start')}</span><span class="pg-title">${L('已经是第一节', 'You are at the first section')}</span>`;
      host.appendChild(sp);
    }
    if (items[idx + 1]) host.appendChild(mk(items[idx + 1], L('下一节', 'Next'), true));
    else {
      const sp = document.createElement('span'); sp.className = 'pg-empty pg-next';
      sp.innerHTML = `<span class="pg-dir">${L('本章结束', 'Chapter end')}</span><span class="pg-title">${L('返回知识地图 →', 'Back to the map →')}</span>`;
      sp.style.cursor = 'pointer';
      sp.addEventListener('click', () => { location.href = '../#map'; });
      host.appendChild(sp);
    }
  }

  function initNavSync() {
    // lesson.js 通过给 .chapter 加 .active 来切换小节；这里观察它、同步目录与翻页
    const host = $('#article-host');
    if (host) {
      const obs = new MutationObserver(() => syncRail());
      obs.observe(host, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('click', e => {
      if (e.target.closest('[data-chapter]')) setTimeout(() => { syncRail(); scrollContentTop(); }, 70);
    });
    window.addEventListener('hashchange', () => setTimeout(syncRail, 70));
    setTimeout(syncRail, 150);
  }

  function scrollContentTop() {
    const host = $('#article-host');
    if (!host) return;
    const y = host.getBoundingClientRect().top + window.scrollY - 80;
    if (window.scrollY > y + 40) window.scrollTo({ top: y, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------
     8) 键盘：← / → 切小节（输入框内不拦截）
     ------------------------------------------------------------------ */
  function initKeys() {
    document.addEventListener('keydown', e => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const items = $$('.rail-item');
      const idx = items.findIndex(a => a.dataset.chapter === currentChapterId());
      const next = e.key === 'ArrowRight' ? items[idx + 1] : items[idx - 1];
      if (next) { e.preventDefault(); next.click(); }
    });
  }

  /* ------------------------------------------------------------------
     9) 装配
     ------------------------------------------------------------------ */
  function build() {
    initTheme();
    relabelTabs();

    $$('.chapter').forEach(ch => {
      splitHeading(ch);
      addMeta(ch);
      const ex = ch.querySelector('[data-panel="explain"]');
      if (ex) classifyExplain(ex);
      const cd = ch.querySelector('[data-panel="code"]');
      if (cd) cardsForCode(cd);
      const dm = ch.querySelector('[data-panel="demo"]');
      if (dm) frameDemo(dm);
    });

    stripRailNumbers();
    initProgress();
    initNavSync();
    initKeys();
  }

  document.addEventListener('wbl:localechange', () => {
    // 语言切换后：h2 被 i18n 重写过，需要重新拆分；标签与块标题也要跟着换
    $$('.chapter').forEach(ch => {
      const h2 = ch.querySelector(':scope > h2');
      if (h2) h2.dataset.split = '';
      splitHeading(ch);
      const pat = ch.querySelector('.blk--patch > summary');
      if (pat) pat.textContent = L('扩展阅读', 'Extension');
      $$('.cc-badge', ch).forEach(b => (b.textContent = L('代码', 'CODE')));
      const live = ch.querySelector('.demo-bar span:nth-child(2)');
      if (live && /实时运行|LIVE/.test(live.textContent)) live.textContent = L('实时运行', 'LIVE');
    });
    stripRailNumbers();
    relabelTabs();
    syncRail();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
