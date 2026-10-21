/* ==========================================================================
   lab-channels.js · 视觉通道可用性实验
   数据依据：Mackinlay (1986) 对各视觉通道「感知精度」的排序，
   以及不同数据类型（定量 / 有序 / 定性）下可用的通道集合。
   分数是教学用的相对刻度，不是论文里的原始数值。
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const pick = (zh, en) => (lang() === 'en' ? en : zh);

  // q = 定量, o = 有序, n = 定性；0 表示该任务下不可用
  const CHANNELS = [
    { zh: '位置（共同尺度）', en: 'Position (common scale)', q: 10, o: 10, n: 10 },
    { zh: '位置（非共同尺度）', en: 'Position (non-common)', q: 9, o: 9, n: 9 },
    { zh: '长度', en: 'Length', q: 8, o: 8, n: 6 },
    { zh: '角度', en: 'Angle', q: 7, o: 6, n: 4 },
    { zh: '斜率', en: 'Slope', q: 6.4, o: 6, n: 3 },
    { zh: '面积', en: 'Area', q: 5, o: 5, n: 4 },
    { zh: '体积', en: 'Volume', q: 4, o: 4, n: 3 },
    { zh: '亮度 / 饱和度', en: 'Lightness / saturation', q: 0, o: 7, n: 6 },
    { zh: '色相', en: 'Hue', q: 0, o: 3, n: 8 },
    { zh: '形状', en: 'Shape', q: 0, o: 0, n: 7 },
  ];

  const TASKS = [
    { key: 'q', zh: '定量比较', en: 'Quantitative',
      zhNote: '要读出"多多少"时，颜色和形状基本不能用（人眼没有把色相映射成数值的能力），能用的只剩位置、长度、角度、斜率、面积、体积，而且精度依次下降。',
      enNote: 'When the reader must judge "how much more", hue and shape are unusable — the eye cannot map hue to magnitude. Only position, length, angle, slope, area and volume remain, in decreasing accuracy.' },
    { key: 'o', zh: '有序比较', en: 'Ordinal',
      zhNote: '只需要判断"谁大谁小"时，亮度/饱和度这类有序通道解禁了；它们能排序，但读不出具体差值。',
      enNote: 'When only order matters, ordered channels such as lightness/saturation become usable — they rank well but cannot convey exact differences.' },
    { key: 'n', zh: '定性区分', en: 'Nominal',
      zhNote: '只需要区分"是不是同一类"，色相和形状就够用了——这也解释了为什么类别用颜色、不用长度。',
      enNote: 'When you only need "same category or not", hue and shape suffice — which is why categories get colour, not length.' },
  ];

  let task = 'q';

  function renderSeg() {
    const host = $('#task-seg');
    if (!host) return;
    host.innerHTML = '';
    TASKS.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = t.key === task ? 'active' : '';
      b.textContent = pick(t.zh, t.en);
      b.addEventListener('click', () => { task = t.key; render(); });
      host.appendChild(b);
    });
  }

  function renderList() {
    const host = $('#chan-list');
    if (!host) return;
    const rows = CHANNELS.map(c => ({ ...c, score: c[task] }))
      .sort((a, b) => b.score - a.score);
    const max = 10;
    host.innerHTML = rows.map((c, i) => {
      const usable = c.score > 0;
      return `<div class="chan-row${usable ? '' : ' unusable'}${i === 0 && usable ? ' top' : ''}">
        <span class="cr-rank">${String(i + 1).padStart(2, '0')}</span>
        <span class="cr-name">${pick(c.zh, c.en)}</span>
        <span class="cr-track"><i class="cr-fill" style="width:${usable ? (c.score / max) * 100 : 0}%;animation-delay:${i * 40}ms"></i></span>
        <span class="cr-val">${usable ? c.score.toFixed(1) : pick('不可用', 'n/a')}</span>
      </div>`;
    }).join('');
  }

  function renderNote() {
    const el = $('#chan-note');
    if (!el) return;
    const t = TASKS.find(x => x.key === task);
    el.textContent = pick(t.zhNote, t.enNote);
  }

  /* 同一组数值的两种编码：长度 vs 面积 */
  const VALUES = [3, 5, 2, 7, 4];
  function renderEncodings() {
    const bars = $('#enc-length');
    if (bars) {
      const max = Math.max(...VALUES);
      bars.innerHTML = VALUES.map((v, i) =>
        `<i style="height:${(v / max) * 100}%;background:var(--d${(i % 8) + 1});opacity:.85"></i>`).join('');
    }
    const svg = $('#enc-area');
    if (svg) {
      const max = Math.max(...VALUES);
      const base = 40;                     // 最大值的半径
      let x = 40;
      svg.innerHTML = VALUES.map((v, i) => {
        const r = base * Math.sqrt(v / max);   // 面积正比于数值
        const cx = x; x += r * 2 + 14;
        return `<circle cx="${cx}" cy="${86 - r}" r="${r}" fill="var(--d${(i % 8) + 1})" opacity=".85"/>`;
      }).join('');
    }
  }

  function render() {
    renderSeg();
    renderList();
    renderNote();
    renderEncodings();
  }

  render();
  document.addEventListener('wbl:localechange', render);
})();
