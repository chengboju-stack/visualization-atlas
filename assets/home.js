/* ==========================================================================
   home.js · 门户页交互
   1) 深浅色切换   2) 知识地图的连线与悬停隔离   3) 图表选型器
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
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  /* ---------------------------- 主题 ---------------------------- */
  document.documentElement.dataset.theme = store.get('vis-theme') || 'dark';
  const themeBtn = $('#theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('vis-theme', next);
  });

  /* ---------------------------- 知识地图 ---------------------------- */
  // 前置关系：1→2, 1→4, 2→4, 3→4, 3→5, 4→5
  const EDGES = [[1, 2], [1, 4], [2, 4], [3, 4], [3, 5], [4, 5]];
  const mapWrap = $('#map-wrap');
  const mapSvg = $('#map-edges');
  const mapNodes = $$('.map-node');

  function drawMap() {
    if (!mapWrap || !mapSvg || !mapNodes.length) return;
    const wr = mapWrap.getBoundingClientRect();
    const W = wr.width, H = wr.height;
    mapSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    mapSvg.setAttribute('width', W);
    mapSvg.setAttribute('height', H);
    mapSvg.innerHTML = '';

    const box = {};
    mapNodes.forEach(n => {
      const a = n.querySelector('a');
      const r = a.getBoundingClientRect();
      box[n.dataset.ch] = { x: r.left - wr.left + r.width / 2, y: r.top - wr.top, el: n };
    });

    EDGES.forEach(([from, to]) => {
      const a = box[from], b = box[to];
      if (!a || !b) return;
      // 向上起拱，跨度越大拱得越高，避免和卡片、以及彼此压线
      const lift = 30 + Math.abs(to - from) * 22 + (from === 3 ? 8 : 0);
      const cy = Math.min(a.y, b.y) - lift;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M ${a.x} ${a.y} C ${a.x} ${cy}, ${b.x} ${cy}, ${b.x} ${b.y}`);
      p.dataset.from = from;
      p.dataset.to = to;
      mapSvg.appendChild(p);
    });
  }

  function isolate(ch) {
    const chs = String(ch || '');
    const related = new Set([chs]);
    EDGES.forEach(([a, b]) => {
      if (String(a) === chs) related.add(String(b));
      if (String(b) === chs) related.add(String(a));
    });
    $$('path', mapSvg).forEach(p => {
      const hit = p.dataset.from === chs || p.dataset.to === chs;
      p.classList.toggle('lit', hit);
      p.classList.toggle('dim', !!chs && !hit);
    });
    mapNodes.forEach(n => {
      const on = !chs || related.has(n.dataset.ch);
      n.classList.toggle('lit', !!chs && n.dataset.ch === chs);
      n.classList.toggle('dim', !on);
    });
  }

  mapNodes.forEach(n => {
    n.addEventListener('mouseenter', () => isolate(n.dataset.ch));
    n.addEventListener('mouseleave', () => isolate(null));
    n.addEventListener('focusin', () => isolate(n.dataset.ch));
    n.addEventListener('focusout', () => isolate(null));
  });

  let raf = 0;
  const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawMap); };
  window.addEventListener('resize', redraw);
  window.addEventListener('load', drawMap);
  document.addEventListener('wbl:localechange', () => setTimeout(drawMap, 60));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawMap);
  drawMap();

  /* ---------------------------- 图表选型器 ---------------------------- */
  const S = (inner) => `<svg viewBox="0 0 46 40" fill="none">${inner}</svg>`;
  const ACC = 'var(--accent)', INK = 'var(--ink-3)', LN = 'var(--line-2)', D2 = 'var(--d2)', D1 = 'var(--d1)', D3 = 'var(--d3)';

  const RELATIONS = [
    {
      key: 'change', zh: '随时间变化', en: 'Change over time',
      zhDesc: '一个量在时间轴上怎么走', enDesc: 'How a value moves over time',
      icon: S(`<path d="M4 32h38" stroke="${LN}" stroke-width="1"/>
        <path d="M5 27 L14 20 L22 24 L31 12 L41 16" stroke="${ACC}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`),
      types: ['折线图', '面积图', '斜率图', '日历热图', '螺旋图', '动画散点'],
      zhWhen: '时间连续、关注趋势与拐点。点少看折线，点多看面积，周期性强看日历或螺旋。',
      enWhen: 'Continuous time, trend and inflection. Few points → line; many → area; strong periodicity → calendar or spiral.',
      zhAvoid: '不要把时间当分类变量画成普通柱状图——那会丢掉"相邻时刻"这个最重要的信息。',
      enAvoid: 'Do not treat time as a plain category and draw vertical bars — you lose adjacency, which is the whole point.',
      to: ['lesson-05/', '第 5 章 时序数据可视化', 'Chapter 5 · Time series'],
    },
    {
      key: 'corr', zh: '相关', en: 'Correlation',
      zhDesc: '两个变量是否同向变化', enDesc: 'Whether two variables move together',
      icon: S(`<path d="M4 32h38M10 34V8" stroke="${LN}" stroke-width="1"/>
        ${[[13,27],[19,23],[24,20],[28,15],[33,13],[37,9]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.2" fill="${D2}"/>`).join('')}
        <path d="M11 29 L38 8" stroke="${ACC}" stroke-width="1.4" stroke-dasharray="3 3"/>`),
      types: ['散点图', '气泡图', '连接散点', '热力矩阵'],
      zhWhen: '两个数值变量，想看是否存在关系、有没有离群点。第三个变量用大小或颜色表示。',
      enWhen: 'Two numeric variables: is there a relationship, and where are the outliers? Encode a third variable with size or hue.',
      zhAvoid: '相关不等于因果；不要在散点图上直接下结论，先看离群点和样本密度。',
      enAvoid: 'Correlation is not causation. Check outliers and density before drawing conclusions.',
      to: ['lesson-04/', '第 4 章 低维数据可视化', 'Chapter 4 · Low-dimensional'],
    },
    {
      key: 'dist', zh: '分布', en: 'Distribution',
      zhDesc: '一组数值铺开是什么形状', enDesc: 'The shape of a set of values',
      icon: S(`<path d="M4 32h38" stroke="${LN}" stroke-width="1"/>
        ${[6,11,16,21,26,31,36].map((x,i)=>`<rect x="${x}" y="${8+Math.abs(i-3)*5}" width="3.6" height="${24-Math.abs(i-3)*5}" rx="1" fill="${D3}" opacity=".85"/>`).join('')}`),
      types: ['直方图', '箱线图', '小提琴图', '密度曲线', '蜂群图'],
      zhWhen: '关心集中趋势、离散程度、偏态与多峰，而不是某一个具体值。',
      enWhen: 'You care about centre, spread, skew and multiple modes — not one specific value.',
      zhAvoid: '分箱数会显著改变直方图的形状。换几个分箱数再下判断。',
      enAvoid: 'Bin count changes the shape a lot. Try several before concluding.',
      to: ['lesson-04/', '第 4 章 低维数据可视化', 'Chapter 4 · Low-dimensional'],
    },
    {
      key: 'rank', zh: '排序', en: 'Ranking',
      zhDesc: '谁大谁小、排第几', enDesc: 'Which is larger, and by how much',
      icon: S(`${[[26,8],[20,14],[15,20],[11,26],[7,32]].map(([w,y],i)=>`<rect x="6" y="${y-4}" width="${w}" height="5.4" rx="1.6" fill="${[D1,D2,D3,'var(--d7)','var(--d8)'][i]}"/>`).join('')}`),
      types: ['条形图', '棒棒糖图', '点图', '排序表'],
      zhWhen: '类别名较长、类别数较多时，横向条形比竖向柱子更好读。',
      enWhen: 'Many categories or long labels — horizontal bars beat vertical ones.',
      zhAvoid: '类别很多时全部画出来会变成一片噪点，先取前 N 再归并"其他"。',
      enAvoid: 'Too many categories becomes noise. Take the top N and merge the rest.',
      to: ['lesson-04/', '第 4 章 低维数据可视化', 'Chapter 4 · Low-dimensional'],
    },
    {
      key: 'part', zh: '部分与整体', en: 'Part-to-whole',
      zhDesc: '各部分占整体的比例', enDesc: 'How parts make up a whole',
      icon: S(`<rect x="6" y="12" width="16" height="9" rx="1.6" fill="${D2}"/>
        <rect x="22" y="12" width="10" height="9" rx="1.6" fill="${D1}"/>
        <rect x="32" y="12" width="7" height="9" rx="1.6" fill="${D3}"/>
        <rect x="6" y="24" width="9" height="9" rx="1.6" fill="${D3}"/>
        <rect x="15" y="24" width="14" height="9" rx="1.6" fill="${D2}"/>
        <rect x="29" y="24" width="10" height="9" rx="1.6" fill="${D1}"/>`),
      types: ['堆叠柱', '百分比堆叠', '环形图', '矩形树', '桑基图'],
      zhWhen: '部分加起来确实等于整体（份额、构成）。堆叠柱比饼图更容易跨组比较。',
      enWhen: 'Parts genuinely sum to a whole. Stacked bars compare across groups better than pies.',
      zhAvoid: '饼图超过 4–5 块就不可读；也别用饼图比较两组数据的构成。',
      enAvoid: 'Pies break beyond 4–5 slices; never use them to compare composition across groups.',
      to: ['lesson-04/', '第 4 章 低维数据可视化', 'Chapter 4 · Low-dimensional'],
    },
    {
      key: 'dev', zh: '偏离', en: 'Deviation',
      zhDesc: '相对某个基准偏了多少', enDesc: 'How far from a baseline',
      icon: S(`<path d="M4 20h38" stroke="${LN}" stroke-width="1" stroke-dasharray="3 3"/>
        ${[[9,12],[16,-9],[23,7],[30,-12],[37,5]].map(([x,d])=>`<rect x="${x}" y="${d>0?20-d:20}" width="4.4" height="${Math.abs(d)}" rx="1" fill="${d>0?D2:D1}"/>`).join('')}`),
      types: ['发散柱', '背离线图', '差异面积图', '正负色阶热力'],
      zhWhen: '有一个明确的零点或目标值（预算、上期、均值），关注"超过/没达到"。',
      enWhen: 'A clear baseline exists (budget, last period, mean) and the story is above/below.',
      zhAvoid: '没有基准时不要硬造一个，否则正负号会误导。',
      enAvoid: 'Do not invent a baseline — the signs will mislead.',
      to: ['lesson-04/', '第 4 章 低维数据可视化', 'Chapter 4 · Low-dimensional'],
    },
    {
      key: 'mag', zh: '量级', en: 'Magnitude',
      zhDesc: '哪一项更大', enDesc: 'Which item is bigger',
      icon: S(`<path d="M4 32h38" stroke="${LN}" stroke-width="1"/>
        <rect x="9" y="12" width="7" height="20" rx="1.4" fill="${D2}"/>
        <rect x="21" y="19" width="7" height="13" rx="1.4" fill="${D1}"/>
        <rect x="33" y="24" width="7" height="8" rx="1.4" fill="${D3}"/>`),
      types: ['柱状图', '面积图', '气泡大小'],
      zhWhen: '只需要比较大小，不需要精确到个位。',
      enWhen: 'Comparing size only — no need to read exact values.',
      zhAvoid: '柱子的长度从 0 起算；截断坐标轴会放大差异。',
      enAvoid: 'Bars must start at zero; a truncated axis exaggerates differences.',
      to: ['lesson-04/', '第 4 章 低维数据可视化', 'Chapter 4 · Low-dimensional'],
    },
    {
      key: 'spatial', zh: '空间', en: 'Spatial',
      zhDesc: '位置本身是信息', enDesc: 'Where things are is the data',
      icon: S(`<rect x="5" y="9" width="36" height="24" rx="2" stroke="${LN}"/>
        <path d="M8 24 C 16 14, 20 26, 26 20 S 34 12, 39 18" stroke="${ACC}" stroke-width="1.6"/>
        <path d="M8 29 C 16 22, 22 30, 28 26 S 35 21, 39 25" stroke="${D2}" stroke-width="1.2" opacity=".7"/>`),
      types: ['分级统计图', '等值线图', '热力地图', '点密度图'],
      zhWhen: '数据带经纬度或网格坐标，且位置和数值本身相关。',
      enWhen: 'Data carries coordinates and location itself matters.',
      zhAvoid: '面积大的地区会在视觉上被放大，考虑用每平方公里的密度而非总量。',
      enAvoid: 'Large areas get over-weighted; map density per unit area instead of totals.',
      to: ['lesson-04/', '第 4 章 低维数据可视化', 'Chapter 4 · Low-dimensional'],
    },
    {
      key: 'flow', zh: '流向', en: 'Flow',
      zhDesc: '从哪来、到哪去、中间损耗多少', enDesc: 'Where it comes from, where it goes',
      icon: S(`<rect x="4" y="8" width="8" height="24" rx="1.6" fill="${D2}" opacity=".5"/>
        <rect x="34" y="8" width="8" height="24" rx="1.6" fill="${D1}" opacity=".5"/>
        <path d="M12 12 C 22 12, 24 14, 34 14" stroke="${D2}" stroke-width="4" opacity=".7"/>
        <path d="M12 21 C 22 21, 24 24, 34 24" stroke="${D3}" stroke-width="3" opacity=".7"/>
        <path d="M12 29 C 22 29, 24 30, 34 30" stroke="${D1}" stroke-width="2.4" opacity=".7"/>`),
      types: ['桑基图', '和弦图', '漏斗图', '弧线流向图'],
      zhWhen: '有明确的方向与守恒量（人数、金额、能量），关注转换与损耗。',
      enWhen: 'Direction plus a conserved quantity (people, money, energy) — you care about conversion and loss.',
      zhAvoid: '流向图的线宽必须正比于数值，否则只是在画装饰。',
      enAvoid: 'Link width must be proportional to the value, otherwise it is decoration.',
      to: ['lesson-02/', '第 2 章 数据可视化流程', 'Chapter 2 · Pipeline'],
    },
  ];

  const grid = $('#chooser-grid');
  const detail = $('#chooser-detail');
  let openKey = null;

  function renderChooser() {
    if (!grid) return;
    grid.innerHTML = '';
    RELATIONS.forEach(r => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ch-card' + (r.key === openKey ? ' is-open' : '');
      b.dataset.key = r.key;
      b.innerHTML = `<span class="ch-icon">${r.icon}</span>
        <span class="ch-body"><b>${pick(r.zh, r.en)}</b><span>${pick(r.zhDesc, r.enDesc)}</span></span>`;
      b.addEventListener('click', () => {
        openKey = openKey === r.key ? null : r.key;
        renderChooser();
        renderDetail();
      });
      grid.appendChild(b);
    });
  }

  function renderDetail() {
    if (!detail) return;
    const r = RELATIONS.find(x => x.key === openKey);
    if (!r) { detail.hidden = true; detail.innerHTML = ''; return; }
    detail.hidden = false;
    const to = lang() === 'en' ? [r.to[0], r.to[2]] : [r.to[0], r.to[1]];
    detail.innerHTML = `
      <div class="cd-head">
        <h3>${pick(r.zh, r.en)}</h3>
        <code>${r.en.toLowerCase().replace(/\s+/g, '-')}</code>
      </div>
      <div class="cd-grid">
        <div>
          <h4>${pick('推荐图形', 'Good matches')}</h4>
          <div class="cd-types">${r.types.map(t => `<span>${t}</span>`).join('')}</div>
        </div>
        <div>
          <h4>${pick('什么时候用', 'When to use')}</h4>
          <p>${pick(r.zhWhen, r.enWhen)}</p>
        </div>
        <div>
          <h4>${pick('常见误用', 'Common mistake')}</h4>
          <p class="cd-warn">${pick(r.zhAvoid, r.enAvoid)}</p>
        </div>
        <div>
          <h4>${pick('去哪一章读', 'Read more')}</h4>
          <p>${pick(r.zh, r.en)} →</p>
          <a class="cd-go" href="${to[0]}">${to[1]}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
        </div>
      </div>`;
  }

  renderChooser();
  renderDetail();
  document.addEventListener('wbl:localechange', () => { renderChooser(); renderDetail(); setTimeout(drawMap, 60); });
})();
