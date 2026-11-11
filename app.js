/* =========================================================
   健身记录 App — 纯前端 PWA，数据保存在手机浏览器本地
   ========================================================= */
'use strict';

const STORAGE_KEY = 'fitlog.v1';
const PRESET_EXERCISES = ['深蹲','硬拉','卧推','杠铃划船','哑铃弯举','肩推','引体向上','腿举','腿屈伸','腿弯举','侧平举','三头下压','绳索夹胸','臀推','箭步蹲','推举','拉力器划船','哑铃卧推'];

let state = null;
let tab = 'calendar';
let calYear, calMonth;
let chartExercise = '';
let chartMetric = 'max';   // 'max' | 'e1rm' | 'vol'
let chartSel = -1;
let chartRange = 'all';    // 'all' | '90' | '30'

/* ---------------- 主题 ---------------- */
const THEME_KEY = 'fitlog.theme';
let theme = 'dark';
try { theme = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
function applyTheme() {
  document.documentElement.classList.toggle('light', theme === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f7f9' : '#0b0c0f');
}
function setTheme(t) {
  theme = t === 'light' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  applyTheme();
  render();
}
applyTheme();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------------- 工具 ---------------- */
const pad = n => String(n).padStart(2, '0');
function isoDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
function todayISO() { return isoDate(new Date()); }
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const WEEK_CN = ['周日','周一','周二','周三','周四','周五','周六'];
function fmtDateCN(iso) {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_CN[d.getDay()]}`;
}
function fmtShort(iso) {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

const APP_VERSION = 'v10';

/* ---------------- 农历（1900-2099） ---------------- */
const LUNAR_INFO = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06aa0,0x1a6c4,0x0aae0,0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252];
const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
function lunarLeapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
function lunarLeapDays(y) { const l = lunarLeapMonth(y); return l ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0; }
function lunarMonthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function lunarYearDays(y) { let sum = 0; for (let m = 1; m <= 12; m++) sum += lunarMonthDays(y, m); return sum + lunarLeapDays(y); }
function solarToLunar(y, m, d) {
  if (y < 1900 || y > 2099) return null;
  let offset = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
  let year = 1900;
  while (year < 2100) {
    const days = lunarYearDays(year);
    if (offset < days) break;
    offset -= days; year++;
  }
  const leap = lunarLeapMonth(year);
  for (let month = 1; month <= 12; month++) {
    const len = lunarMonthDays(year, month);
    if (offset < len) return { year, month, day: offset + 1, isLeap: false };
    offset -= len;
    if (leap === month) {
      const ll = lunarLeapDays(year);
      if (offset < ll) return { year, month, day: offset + 1, isLeap: true };
      offset -= ll;
    }
  }
  return null;
}
function lunarOf(iso) {
  const d = parseISO(iso);
  return solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function lunarDayText(ld) {
  if (!ld) return '';
  if (ld.day === 1) return (ld.isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[ld.month - 1] + '月';
  return LUNAR_DAY_NAMES[ld.day - 1] || '';
}
function lunarFullText(ld) {
  if (!ld) return '';
  return (ld.isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[ld.month - 1] + '月' + LUNAR_DAY_NAMES[ld.day - 1];
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtKg(v) {
  if (v == null || isNaN(v)) return '—';
  return (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') + 'kg';
}
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ---------------- 数据 ---------------- */
function emptyState() { return { gymDays: {}, parts: {}, entries: [], metrics: [], meta: { createdAt: new Date().toISOString() } }; }

function normalizeState(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  if (raw.gymDays && typeof raw.gymDays === 'object') s.gymDays = raw.gymDays;
  if (raw.parts && typeof raw.parts === 'object') {
    s.parts = {};
    Object.keys(raw.parts).forEach(k => {
      if (Array.isArray(raw.parts[k])) s.parts[k] = raw.parts[k].filter(x => typeof x === 'string');
    });
  }
  if (Array.isArray(raw.entries)) {
    s.entries = raw.entries.filter(e => e && typeof e.date === 'string' && typeof e.exercise === 'string').map(e => ({
      id: e.id || uid(),
      date: e.date,
      exercise: e.exercise,
      sets: Array.isArray(e.sets) ? e.sets.map(x => ({ w: Number(x.w) || 0, r: Number(x.r) || 0 })) : [],
      note: e.note || ''
    }));
  }
  if (Array.isArray(raw.metrics)) {
    s.metrics = raw.metrics.filter(m => m && typeof m.date === 'string').map(m => ({
      id: m.id || uid(),
      date: m.date,
      weight: m.weight === '' || m.weight == null ? null : Number(m.weight),
      bodyFat: m.bodyFat === '' || m.bodyFat == null ? null : Number(m.bodyFat),
      note: m.note || ''
    })).filter(m => m.weight != null || m.bodyFat != null);
  }
  if (raw.meta) s.meta = Object.assign(s.meta, raw.meta);
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) { console.warn('读取数据失败', e); }
  return emptyState();
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('保存失败：存储空间可能已满'); }
}

function entriesOn(iso) { return state.entries.filter(e => e.date === iso); }

/* ---- 训练部位：显式记录 + 根据动作自动识别 ---- */
const PART_OPTIONS = ['胸', '背', '腿', '肩', '臂', '核心', '有氧'];
const PART_RULES = [
  ['胸', ['卧推', '飞鸟', '夹胸', '俯卧撑', '推胸']],
  ['背', ['硬拉', '划船', '引体', '下拉', '直臂下压', '面拉']],
  ['腿', ['深蹲', '腿举', '腿屈伸', '腿弯举', '箭步', '臀推', '保加利亚', '硬拉']],
  ['肩', ['肩推', '推举', '侧平举', '前平举', '反向飞鸟']],
  ['臂', ['弯举', '三头', '下压', '臂屈伸', '锤式', '曲伸']],
  ['核心', ['卷腹', '平板', '举腿', '腹']],
  ['有氧', ['跑步', '跑', '骑车', '椭圆', '划船机', '跳绳', '有氧']]
];
function inferParts(iso) {
  const parts = new Set();
  entriesOn(iso).forEach(e => {
    PART_RULES.forEach(([part, kws]) => {
      if (kws.some(k => e.exercise.includes(k))) parts.add(part);
    });
  });
  return PART_OPTIONS.filter(p => parts.has(p));
}
function explicitParts(iso) {
  const v = state.parts ? state.parts[iso] : undefined;
  return Array.isArray(v) ? v : [];
}
function dayParts(iso) {
  const ex = explicitParts(iso);
  if (ex.length) return ex;
  return inferParts(iso);
}
function allExercises() {
  const set = new Map();
  state.entries.forEach(e => set.set(e.exercise, (set.get(e.exercise) || 0) + 1));
  return Array.from(set.entries()).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
function mostCommonExercise() {
  const list = allExercises();
  return list.length ? list[0] : (PRESET_EXERCISES[0] || '深蹲');
}
function entryTopWeight(e) {
  return Math.max(0, ...e.sets.map(s => s.w || 0));
}
function entryVolume(e) {
  return e.sets.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0);
}
function entrySetsText(e) {
  if (!e.sets.length) return '—';
  const groups = [];
  e.sets.forEach(s => {
    const key = `${s.w}kg×${s.r}`;
    const g = groups.find(x => x.key === key);
    if (g) g.n++; else groups.push({ key, n: 1 });
  });
  return groups.map(g => g.n > 1 ? `${g.key}×${g.n}组` : g.key).join('  ');
}

/* ---------------- 底部弹层 ---------------- */
function openSheet(html, onMount) {
  const host = $('#sheetHost');
  host.innerHTML = `<div class="backdrop" data-act="close-sheet"></div><div class="sheet">${html}</div>`;
  host.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (onMount) onMount();
}
function closeSheet() {
  const host = $('#sheetHost');
  host.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { if (!host.classList.contains('open')) host.innerHTML = ''; }, 300);
}

/* ---------------- 日历 ---------------- */
function renderCalendar() {
  const first = new Date(calYear, calMonth, 1);
  const startIdx = (first.getDay() + 6) % 7;          // 周一为一周第一天
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayISO();

  const monthISO = `${calYear}-${pad(calMonth + 1)}`;
  const monthGym = Object.keys(state.gymDays).filter(d => d.startsWith(monthISO) && state.gymDays[d]).length;

  // 本周训练天数
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  let weekGym = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    if (state.gymDays[isoDate(d)]) weekGym++;
  }
  const totalGym = Object.keys(state.gymDays).filter(d => state.gymDays[d]).length;

  let cells = '';
  for (let i = 0; i < startIdx; i++) cells += '<div class="day blank"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    const gym = !!state.gymDays[iso];
    const hasEntry = state.entries.some(e => e.date === iso);
    const parts = dayParts(iso);
    const partText = parts.length ? parts.slice(0, 2).join('·') : '';
    const ld = solarToLunar(calYear, calMonth + 1, d);
    const lunarText = lunarDayText(ld);
    const cls = ['day', gym ? 'gym' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
    cells += `<button class="${cls}" data-act="open-day" data-date="${iso}">
      <span class="dnum">${d}</span>
      <span class="dlunar">${esc(lunarText)}</span>
      ${partText ? `<span class="dparts">${esc(partText)}</span>` : (hasEntry ? '<i class="dot"></i>' : '')}
    </button>`;
  }
  const trailing = (7 - ((startIdx + daysInMonth) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="day blank"></div>';

  $('#view').innerHTML = `
    <div class="page-cal">
    <div class="card cal-card">
      <div class="cal-head">
        <button class="cal-title-btn" data-act="open-month-picker" aria-label="选择月份">
          ${calYear}年${calMonth + 1}月 <span class="chev">▾</span>
        </button>
        <div class="cal-nav">
          <button class="nav-btn" data-act="prev-month" aria-label="上个月">‹</button>
          <button class="nav-btn" data-act="next-month" aria-label="下个月">›</button>
        </div>
      </div>
      <div class="cal-summary">
        <div class="sum-chip"><b>${monthGym}</b><span>本月训练</span></div>
        <div class="sum-chip"><b>${weekGym}</b><span>本周训练</span></div>
        <div class="sum-chip"><b>${totalGym}</b><span>累计训练日</span></div>
      </div>
      <div class="cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend">
        <span><i></i>训练日</span>
        <span><i class="dotline"></i>有记录</span>
        <span>下方：农历 · 训练部位</span>
      </div>
    </div>
    </div>
  `;
}

function openDaySheet(iso) {
  const gym = !!state.gymDays[iso];
  const list = entriesOn(iso).sort((a, b) => a.exercise.localeCompare(b.exercise, 'zh'));
  const chosen = explicitParts(iso);
  const auto = inferParts(iso);
  const html = `
    <div class="sheet-grab"></div>
    <h3>${esc(fmtDateCN(iso))}</h3>
    <div class="sub">${gym ? '已标记为训练日' : '还没有标记训练日'} · 农历${esc(lunarFullText(lunarOf(iso)))}</div>
    <div class="setting-row" style="border-bottom:0;padding:2px 2px 10px">
      <div><div class="t">今天去了健身房</div><div class="s">打开后日历上会显示红色标记</div></div>
      <label class="switch"><input type="checkbox" id="gymToggle" ${gym ? 'checked' : ''}><i></i></label>
    </div>
    <div class="field" style="margin:2px 0 8px">
      <label>今天练了哪些部位（可多选）</label>
      <div class="part-chips" id="partChips">
        ${PART_OPTIONS.map(p => `<button class="part-chip ${chosen.includes(p) ? 'active' : ''}" data-act="toggle-part" data-date="${iso}" data-part="${p}">${p}</button>`).join('')}
      </div>
      <div class="tiny muted" id="partHint" style="margin-top:6px">${chosen.length ? '已手动选择，会显示在日历上' : (auto.length ? '自动识别：' + auto.join(' · ') + '（点上面标签可手动调整）' : '选好后会显示在日历数字下方')}</div>
    </div>
    <div class="section-title" style="margin:0 0 8px">
      <h2 style="font-size:15px">当天训练</h2>
      <button class="link-btn" data-act="add-entry" data-date="${iso}">+ 添加动作</button>
    </div>
    ${list.length ? list.map(e => entryRowHTML(e)).join('') : `<div class="empty" style="padding:24px 0"><span class="big">🏋️</span>还没有训练记录<br><span class="tiny">点右上「+ 添加动作」开始记录</span></div>`}
  `;
  openSheet(html, () => {
    const tg = $('#gymToggle');
    if (tg) tg.addEventListener('change', () => {
      if (tg.checked) state.gymDays[iso] = true; else delete state.gymDays[iso];
      saveState();
      render();
      toast(tg.checked ? '已标记训练日 💪' : '已取消训练日标记');
    });
  });
}

function updatePartChipsUI(iso) {
  const chosen = explicitParts(iso);
  $$('#partChips .part-chip').forEach(b => b.classList.toggle('active', chosen.includes(b.dataset.part)));
  const hint = $('#partHint');
  if (hint) {
    const auto = inferParts(iso);
    hint.textContent = chosen.length ? '已手动选择：' + chosen.join(' · ') : (auto.length ? '自动识别：' + auto.join(' · ') + '（点上面标签可手动调整）' : '选好后会显示在日历数字下方');
  }
}

function togglePart(iso, part) {
  if (!state.parts) state.parts = {};
  const arr = explicitParts(iso).slice();
  const idx = arr.indexOf(part);
  if (idx >= 0) arr.splice(idx, 1); else arr.push(part);
  if (arr.length) state.parts[iso] = arr; else delete state.parts[iso];
  saveState();
  render();
  updatePartChipsUI(iso);
}

/* ---------------- 月份选择器 ---------------- */
let pickYear = calYear;
function monthGridHTML() {
  return Array.from({ length: 12 }, (_, i) => {
    const active = pickYear === calYear && i === calMonth;
    return `<button class="month-cell ${active ? 'active' : ''}" data-act="pick-month" data-month="${i}">${i + 1}月</button>`;
  }).join('');
}
function refreshMonthPicker() {
  const lbl = $('#pickYearLabel');
  if (lbl) lbl.textContent = pickYear + '年';
  const grid = $('#monthGrid');
  if (grid) grid.innerHTML = monthGridHTML();
}
function openMonthPicker() {
  pickYear = calYear;
  const html = `
    <div class="sheet-grab"></div>
    <h3>选择月份</h3>
    <div class="sub">可以自由跳到任意年月</div>
    <div class="month-nav">
      <button class="nav-btn" data-act="pick-year-prev" aria-label="上一年">‹</button>
      <b id="pickYearLabel">${pickYear}年</b>
      <button class="nav-btn" data-act="pick-year-next" aria-label="下一年">›</button>
    </div>
    <div class="month-grid" id="monthGrid">${monthGridHTML()}</div>
    <button class="link-btn" data-act="pick-this-month">回到本月</button>
  `;
  openSheet(html);
}

/* ---------------- 记录列表 ---------------- */
function entryRowHTML(e) {
  const top = entryTopWeight(e);
  return `<div class="entry" data-act="edit-entry" data-id="${e.id}">
    <div class="entry-main">
      <div class="entry-name">${esc(e.exercise)}</div>
      <div class="entry-sub">${esc(entrySetsText(e))}${e.note ? ' · ' + esc(e.note) : ''}</div>
    </div>
    <div class="entry-weight">${top ? fmtKg(top) : '—'}<span>最大重量</span></div>
  </div>`;
}

function renderRecords() {
  const byDate = new Map();
  state.entries.forEach(e => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });
  const dates = Array.from(byDate.keys()).sort().reverse();

  const groups = dates.map(iso => {
    const gym = !!state.gymDays[iso];
    const list = byDate.get(iso).sort((a, b) => entryTopWeight(b) - entryTopWeight(a));
    const volume = list.reduce((a, e) => a + entryVolume(e), 0);
    const parts = dayParts(iso);
    return `<div class="day-group">
      <div class="day-group-head">
        <b>${esc(fmtDateCN(iso))}</b>
        ${gym ? '<span class="badge">训练日</span>' : ''}
        ${parts.length ? `<span class="part-tag">${esc(parts.join('·'))}</span>` : ''}
        <span class="muted tiny" style="margin-left:auto">${list.length} 个动作 · 容量 ${Math.round(volume)}kg</span>
      </div>
      ${list.map(e => entryRowHTML(e)).join('')}
    </div>`;
  }).join('');

  $('#view').innerHTML = `
    ${dates.length ? groups : `<div class="empty"><span class="big">📋</span>还没有记录<br><span class="tiny">点右下角 + 添加第一条训练记录</span></div>`}
    <div class="fab" data-act="add-entry" data-date="${todayISO()}" role="button" aria-label="添加记录">+</div>
    <div style="height:96px"></div>
  `;
}

/* ---------------- 新增 / 编辑记录 ---------------- */
function openEntrySheet(dateISO, entryId) {
  const editing = entryId ? state.entries.find(e => e.id === entryId) : null;
  const date = editing ? editing.date : (dateISO || todayISO());
  const exercise = editing ? editing.exercise : '';
  const sets = editing && editing.sets.length ? editing.sets.map(s => ({ ...s })) : [{ w: '', r: '' }];
  const note = editing ? editing.note : '';
  const exList = Array.from(new Set([...PRESET_EXERCISES, ...allExercises(), ...(exercise ? [exercise] : [])]));

  const setRowsHTML = sets.map((s, i) => `
    <div class="set-row">
      <div class="n">${i + 1}</div>
      <input class="input" type="number" inputmode="decimal" step="0.5" min="0" placeholder="重量 kg" value="${s.w === '' ? '' : s.w}" data-set="w" data-i="${i}">
      <input class="input" type="number" inputmode="numeric" step="1" min="0" placeholder="次数" value="${s.r === '' ? '' : s.r}" data-set="r" data-i="${i}">
      <button class="del-x" data-act="del-set" data-i="${i}" aria-label="删除这一组">×</button>
    </div>`).join('');

  const html = `
    <div class="sheet-grab"></div>
    <h3>${editing ? '编辑记录' : '添加训练记录'}</h3>
    <div class="sub">${esc(fmtDateCN(date))}</div>
    <div class="field">
      <label>日期</label>
      <input class="input" type="date" id="fDate" value="${date}">
    </div>
    <div class="field">
      <label>动作名称</label>
      <input class="input" id="fExercise" list="exList" placeholder="例如：深蹲" value="${esc(exercise)}" autocomplete="off">
      <datalist id="exList">${exList.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
    </div>
    <div class="field">
      <label>组数 / 重量 / 次数</label>
      <div class="set-head"><span style="text-align:center">组</span><span style="text-align:center">重量</span><span style="text-align:center">次数</span><span></span></div>
      <div id="setRows">${setRowsHTML}</div>
      <button class="link-btn" data-act="add-set">+ 添加一组</button>
    </div>
    <div class="field">
      <label>备注（可选）</label>
      <textarea class="textarea" id="fNote" placeholder="状态、感受、RPE…">${esc(note)}</textarea>
    </div>
    <div class="btn-row">
      ${editing ? '<button class="btn danger" data-act="del-entry" data-id="' + editing.id + '">删除</button>' : ''}
      <button class="btn primary" data-act="save-entry" data-id="${editing ? editing.id : ''}">保存</button>
    </div>
  `;

  openSheet(html, () => {
    // 动态增删组
    const rerenderSets = () => {
      const rows = $$('#setRows .set-row');
      const current = rows.map(r => ({
        w: $('input[data-set="w"]', r).value,
        r: $('input[data-set="r"]', r).value
      }));
      const html2 = current.map((s, i) => `
        <div class="set-row">
          <div class="n">${i + 1}</div>
          <input class="input" type="number" inputmode="decimal" step="0.5" min="0" placeholder="重量 kg" value="${s.w}" data-set="w" data-i="${i}">
          <input class="input" type="number" inputmode="numeric" step="1" min="0" placeholder="次数" value="${s.r}" data-set="r" data-i="${i}">
          <button class="del-x" data-act="del-set" data-i="${i}" aria-label="删除这一组">×</button>
        </div>`).join('');
      $('#setRows').innerHTML = html2;
    };
    $$('#sheetHost [data-act="add-set"]').forEach(b => b.addEventListener('click', () => {
      const rows = $$('#setRows .set-row');
      const last = rows[rows.length - 1];
      const w = last ? $('input[data-set="w"]', last).value : '';
      const r = last ? $('input[data-set="r"]', last).value : '';
      $('#setRows').insertAdjacentHTML('beforeend', `
        <div class="set-row">
          <div class="n">${rows.length + 1}</div>
          <input class="input" type="number" inputmode="decimal" step="0.5" min="0" placeholder="重量 kg" value="${w}" data-set="w">
          <input class="input" type="number" inputmode="numeric" step="1" min="0" placeholder="次数" value="${r}" data-set="r">
          <button class="del-x" data-act="del-set" aria-label="删除这一组">×</button>
        </div>`);
    }));
    $$('#setRows [data-act="del-set"]').forEach(b => b.addEventListener('click', () => {
      const rows = $$('#setRows .set-row');
      if (rows.length <= 1) return;
      b.closest('.set-row').remove();
      $$('#setRows .set-row').forEach((row, i) => { $('.n', row).textContent = i + 1; });
    }));
  });
}

function saveEntryFromSheet(entryId) {
  const date = $('#fDate').value;
  const exercise = $('#fExercise').value.trim();
  const note = $('#fNote').value.trim();
  if (!date) { toast('请选择日期'); return; }
  if (!exercise) { toast('请填写动作名称'); return; }

  const sets = [];
  $$('#setRows .set-row').forEach(row => {
    const w = parseFloat($('input[data-set="w"]', row).value);
    const r = parseFloat($('input[data-set="r"]', row).value);
    if (!isNaN(w) && !isNaN(r) && (w > 0 || r > 0)) sets.push({ w: w || 0, r: r || 0 });
  });
  if (!sets.length) { toast('请至少填写一组重量/次数'); return; }

  if (entryId) {
    const e = state.entries.find(x => x.id === entryId);
    if (e) { e.date = date; e.exercise = exercise; e.sets = sets; e.note = note; }
  } else {
    state.entries.push({ id: uid(), date, exercise, sets, note });
    if (!state.gymDays[date]) { state.gymDays[date] = true; } // 有记录的当天默认标记训练日
  }
  saveState();
  closeSheet();
  render();
  toast('已保存 ✓');
}

/* ---------------- 曲线 ---------------- */
const METRIC_LABELS = { max: '最大重量', e1rm: '估算 1RM', vol: '训练容量' };
const RANGE_LABELS = [['all', '全部'], ['90', '近3月'], ['30', '近1月']];

function seriesFor(exercise) {
  const byDate = new Map();
  state.entries.filter(e => e.exercise === exercise).forEach(e => {
    let val;
    if (chartMetric === 'e1rm') {
      val = 0;
      e.sets.forEach(s => { if (s.w > 0 && s.r > 0) val = Math.max(val, s.w * (1 + s.r / 30)); });
    } else if (chartMetric === 'vol') {
      val = e.sets.reduce((a, s) => a + (s.w || 0) * (s.r || 0), 0);
    } else {
      val = Math.max(0, ...e.sets.map(s => s.w || 0));
    }
    val = Math.round(val * 10) / 10;
    const prev = byDate.get(e.date);
    if (chartMetric === 'vol') byDate.set(e.date, (prev || 0) + val);
    else byDate.set(e.date, prev === undefined ? val : Math.max(prev, val));
  });
  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function rangeCutoff() {
  if (chartRange === 'all') return null;
  const days = chartRange === '30' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoDate(d);
}

function fmtAxis(v, metric) {
  if (metric === 'vol') {
    if (v >= 10000) return (v / 1000).toFixed(v >= 20000 ? 0 : 1) + 't';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return Math.round(v);
  }
  return Math.round(v * 10) / 10;
}
function fmtMetric(v) {
  if (chartMetric === 'vol') return Math.round(v) + 'kg';
  return fmtKg(v);
}

function smoothPath(coords) {
  if (!coords.length) return '';
  if (coords.length === 1) return '';
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function buildChartSVG(points, fmt) {
  const F = fmt || { axis: v => Math.round(v * 10) / 10, value: v => fmtKg(v) };
  const W = 360, H = 240, L = 44, R = 14, T = 26, B = 36;
  const iw = W - L - R, ih = H - T - B;
  if (!points.length) return '';
  const vals = points.map(p => p.value);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  let lo = vMin, hi = vMax;
  const span = hi - lo;
  if (span < 1) { lo = Math.max(0, lo - 2); hi = hi + 2; }
  else { const padV = Math.max(0.5, span * 0.16); lo = Math.max(0, lo - padV); hi = hi + padV; }

  const t0 = parseISO(points[0].date).getTime();
  const t1 = parseISO(points[points.length - 1].date).getTime();
  const xAt = i => {
    if (points.length === 1 || t1 === t0) return L + iw / 2;
    return L + ((parseISO(points[i].date).getTime() - t0) / (t1 - t0)) * iw;
  };
  const yAt = v => T + ih - ((v - lo) / (hi - lo)) * ih;

  // 网格 + y 轴
  let grid = '';
  const gridN = 4;
  for (let i = 0; i <= gridN; i++) {
    const v = lo + (hi - lo) * i / gridN;
    const y = yAt(v);
    grid += `<line class="chart-grid" x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}"/>`;
    grid += `<text class="chart-axis" x="${L - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${F.axis(v)}</text>`;
  }

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value), p }));
  const lineD = smoothPath(coords);
  const baseY = (T + ih).toFixed(1);
  const areaD = lineD + ` L ${coords[coords.length - 1].x.toFixed(1)} ${baseY} L ${coords[0].x.toFixed(1)} ${baseY} Z`;

  // 最高点标记
  let prIdx = 0;
  points.forEach((p, i) => { if (p.value > points[prIdx].value) prIdx = i; });
  const pr = coords[prIdx];
  let prMark = '';
  if (points.length > 1) {
    prMark = `<circle class="chart-pr-ring" cx="${pr.x.toFixed(1)}" cy="${pr.y.toFixed(1)}" r="7"/>
      <text class="chart-pr-label" x="${Math.min(pr.x + 9, W - R - 20).toFixed(1)}" y="${Math.max(pr.y - 9, 12).toFixed(1)}">最高</text>`;
  }

  // 选中点
  let selMark = '';
  if (chartSel >= 0 && chartSel < coords.length) {
    const c = coords[chartSel];
    selMark = `<line class="chart-sel" x1="${c.x.toFixed(1)}" y1="${T}" x2="${c.x.toFixed(1)}" y2="${baseY}"/>
      <circle class="chart-dot sel" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="5.5" data-idx="${chartSel}"/>`;
  }

  const dots = coords.map((c, i) => {
    if (i === chartSel) return '';
    return `<circle class="chart-dot" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.6" data-idx="${i}"/>`;
  }).join('');

  const labels = [];
  const n = points.length;
  const idxs = n === 1 ? [0] : (n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1]);
  idxs.forEach(i => {
    const c = coords[i];
    labels.push(`<text class="chart-axis" x="${c.x.toFixed(1)}" y="${H - 12}" text-anchor="middle">${fmtShort(points[i].date)}</text>`);
  });

  // 选中值标签
  let tag = '';
  if (chartSel >= 0 && chartSel < coords.length) {
    const c = coords[chartSel];
    const tx = Math.min(Math.max(c.x, L + 34), W - R - 34);
    const label = `${fmtShort(c.p.date)} · ${F.value(c.p.value)}`;
    const ty = Math.max(c.y - 14, 16);
    const w = label.length * 5.6 + 16;
    tag = `<rect x="${(tx - w / 2).toFixed(1)}" y="${(ty - 12).toFixed(1)}" width="${w.toFixed(1)}" height="17" rx="8.5" class="chart-tag-bg"/>
      <text class="chart-tag" x="${tx.toFixed(1)}" y="${(ty).toFixed(1)}" text-anchor="middle">${label}</text>`;
  }

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" aria-label="进步曲线">
    <defs>
      <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color:var(--accent);stop-opacity:.35"/>
        <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0"/>
      </linearGradient>
    </defs>
    ${grid}
    <path class="chart-area" d="${areaD}"/>
    <path class="chart-line" d="${lineD}"/>
    ${prMark}
    ${dots}
    ${selMark}
    ${labels}
    ${tag}
  </svg>`;
}

function renderCharts() {
  const exercises = allExercises();
  if (!exercises.length) {
    $('#view').innerHTML = `<div class="empty"><span class="big">📈</span>还没有训练记录<br><span class="tiny">先在「记录」里添加几次训练，这里就会生成进步曲线</span></div>`;
    return;
  }
  if (!chartExercise || !exercises.includes(chartExercise)) chartExercise = exercises[0];
  const allPoints = seriesFor(chartExercise);
  const cutoff = rangeCutoff();
  const points = cutoff ? allPoints.filter(p => p.date >= cutoff) : allPoints;
  const values = points.map(p => p.value);
  const maxV = values.length ? Math.max(...values) : 0;
  const lastV = values.length ? values[values.length - 1] : 0;
  const firstV = values.length ? values[0] : 0;
  const delta = lastV - firstV;
  const isVol = chartMetric === 'vol';
  const prHit = values.length > 1 && lastV >= maxV - 0.001;
  const chartFmt = {
    axis: v => fmtAxis(v, chartMetric),
    value: v => isVol ? (Math.round(v) + 'kg') : fmtKg(v)
  };

  const rows = points.slice().reverse().slice(0, 10).map((p, i, arr) => {
    const prev = arr[i + 1];
    const d = prev ? Math.round((p.value - prev.value) * 10) / 10 : null;
    const arrow = d == null ? '' : (d > 0 ? `<span class="delta up">▲ ${isVol ? Math.round(d) : fmtKg(d)}</span>` : (d < 0 ? `<span class="delta down">▼ ${isVol ? Math.round(-d) : fmtKg(-d)}</span>` : `<span class="delta flat">—</span>`));
    return `<div class="chart-row">
      <span class="d">${esc(fmtShort(p.date))}</span>
      <span class="v">${isVol ? Math.round(p.value) + 'kg' : fmtKg(p.value)}</span>
      ${arrow}
    </div>`;
  }).join('');

  const rangeChips = RANGE_LABELS.map(([k, label]) =>
    `<button class="range-chip ${chartRange === k ? 'active' : ''}" data-act="range" data-range="${k}">${label}</button>`).join('');
  const metricBtns = [['max', '最大重量'], ['e1rm', '估算 1RM'], ['vol', '训练容量']].map(([k, label]) =>
    `<button class="${chartMetric === k ? 'active' : ''}" data-act="metric" data-metric="${k}">${label}</button>`).join('');

  $('#view').innerHTML = `
    <div class="chips">
      ${exercises.map(x => `<button class="chip ${x === chartExercise ? 'active' : ''}" data-act="pick-exercise" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}
    </div>
    <div class="seg">${metricBtns}</div>
    <div class="range-row">${rangeChips}</div>
    ${points.length ? `
    <div class="card chart-card">
      <div class="chart-head">
        <div>
          <div class="chart-title">${esc(chartExercise)}<span class="chart-metric">${METRIC_LABELS[chartMetric]}</span></div>
          <div class="chart-sub">${fmtShort(points[0].date)} – ${fmtShort(points[points.length - 1].date)} · 共 ${points.length} 次${prHit ? ' <span class="pr-pill">新纪录</span>' : ''}</div>
        </div>
        <div class="chart-big">${isVol ? Math.round(lastV) + '<i>kg</i>' : fmtKg(lastV).replace('kg', '<i>kg</i>')}</div>
      </div>
      <div class="chart-wrap">${buildChartSVG(points, chartFmt)}</div>
      <div class="chart-stats">
        <div class="stat"><b>${points.length}</b><span>训练次数</span></div>
        <div class="stat"><b>${isVol ? Math.round(maxV) : fmtKg(maxV)}</b><span>${isVol ? '最高容量(kg)' : '最重'}</span></div>
        <div class="stat"><b>${isVol ? Math.round(lastV) : fmtKg(lastV)}</b><span>最近</span></div>
        <div class="stat"><b class="${delta >= 0 ? 'accent' : 'muted'}">${delta > 0 ? '+' : ''}${isVol ? Math.round(delta) : fmtKg(delta)}</b><span>对比首次</span></div>
      </div>
    </div>
    <div class="card chart-list" style="margin-top:14px">
      <div class="section-title" style="margin:0 0 4px"><h2 style="font-size:15px">最近记录</h2><span class="muted tiny">点曲线上的点看数值</span></div>
      ${rows || '<div class="empty" style="padding:24px 0">这个时间段还没有记录</div>'}
    </div>` : `
    <div class="empty"><span class="big">📈</span>这个时间段还没有记录<br><span class="tiny">换一个时间范围，或先去记录一次训练</span></div>`}
    <div style="height:14px"></div>
  `;
}

/* ---------------- 身体数据（体重 / 体脂） ---------------- */
let bodyMetric = 'weight'; // 'weight' | 'fat'

function bodySeries(kind) {
  const key = kind === 'fat' ? 'bodyFat' : 'weight';
  return state.metrics
    .filter(m => m[key] != null && !isNaN(m[key]))
    .map(m => ({ date: m.date, value: Number(m[key]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fmtBody(v, kind) {
  if (v == null || isNaN(v)) return '--';
  return (Math.round(v * 10) / 10) + (kind === 'fat' ? '%' : 'kg');
}

function renderBody() {
  const list = state.metrics.slice().sort((a, b) => b.date.localeCompare(a.date));
  const latest = list[0];
  const points = bodySeries(bodyMetric);
  const vals = points.map(p => p.value);
  const maxV = vals.length ? Math.max(...vals) : 0;
  const minV = vals.length ? Math.min(...vals) : 0;
  const lastV = vals.length ? vals[vals.length - 1] : 0;
  const firstV = vals.length ? vals[0] : 0;
  const delta = lastV - firstV;
  const kind = bodyMetric === 'fat' ? 'fat' : 'weight';
  const fmt = { axis: v => Math.round(v * 10) / 10, value: v => fmtBody(v, kind) };

  const latestWeight = latest && latest.weight != null ? fmtBody(latest.weight, 'weight') : '--';
  const latestFat = latest && latest.bodyFat != null ? fmtBody(latest.bodyFat, 'fat') : '--';
  const prev = list[1];
  let wDelta = null;
  if (latest && latest.weight != null && prev && prev.weight != null) wDelta = latest.weight - prev.weight;
  const wDeltaText = wDelta == null ? '' : (wDelta > 0 ? '+' : '') + (Math.round(wDelta * 10) / 10) + 'kg';

  const rows = list.slice(0, 30).map(m => {
    const w = m.weight != null ? fmtBody(m.weight, 'weight') : '—';
    const f = m.bodyFat != null ? fmtBody(m.bodyFat, 'fat') : '';
    return `<div class="chart-row" data-act="edit-metric" data-id="${m.id}">
      <span class="d">${esc(fmtShort(m.date))}</span>
      <span class="v">${w}${f ? ' · ' + f : ''}</span>
      <span class="muted tiny">${m.note ? esc(m.note) : ''}</span>
    </div>`;
  }).join('');

  const seg = [['weight', '体重'], ['fat', '体脂率']].map(([k, label]) =>
    `<button class="${bodyMetric === k ? 'active' : ''}" data-act="body-metric" data-metric="${k}">${label}</button>`).join('');

  $('#view').innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="body-top">
        <div class="body-cell">
          <div class="body-label">最近体重</div>
          <div class="body-value">${latestWeight}</div>
          ${wDeltaText ? `<div class="body-delta ${wDelta > 0 ? 'up' : (wDelta < 0 ? 'down' : 'flat')}">${wDelta > 0 ? '▲' : (wDelta < 0 ? '▼' : '—')} ${wDeltaText} 较上次</div>` : '<div class="body-delta muted">还没有记录</div>'}
        </div>
        <div class="body-cell">
          <div class="body-label">最近体脂率</div>
          <div class="body-value">${latestFat}</div>
          <div class="body-delta muted">${latestFat === '--' ? '点右下角 + 添加' : '手动录入体脂秤读数'}</div>
        </div>
      </div>
    </div>
    <div class="seg">${seg}</div>
    ${points.length ? `
    <div class="card chart-card">
      <div class="chart-head">
        <div>
          <div class="chart-title">${bodyMetric === 'fat' ? '体脂率' : '体重'}<span class="chart-metric">变化趋势</span></div>
          <div class="chart-sub">${fmtShort(points[0].date)} – ${fmtShort(points[points.length - 1].date)} · 共 ${points.length} 次</div>
        </div>
        <div class="chart-big">${fmtBody(lastV, kind)}</div>
      </div>
      <div class="chart-wrap">${buildChartSVG(points, fmt)}</div>
      <div class="chart-stats">
        <div class="stat"><b>${points.length}</b><span>记录次数</span></div>
        <div class="stat"><b>${fmtBody(maxV, kind)}</b><span>最高</span></div>
        <div class="stat"><b>${fmtBody(minV, kind)}</b><span>最低</span></div>
        <div class="stat"><b class="${bodyMetric === 'weight' ? (delta <= 0 ? 'accent' : 'muted') : (delta <= 0 ? 'accent' : 'muted')}">${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}${kind === 'fat' ? '%' : 'kg'}</b><span>对比首次</span></div>
      </div>
    </div>
    <div class="card chart-list" style="margin-top:14px">
      <div class="section-title" style="margin:0 0 4px"><h2 style="font-size:15px">身体记录</h2><span class="muted tiny">点记录可修改</span></div>
      ${rows}
    </div>` : `
    <div class="empty"><span class="big">⚖️</span>还没有体重/体脂记录<br><span class="tiny">点右下角 + 添加第一条</span></div>`}
    <div class="fab" data-act="add-metric" data-date="${todayISO()}" role="button" aria-label="添加身体数据">+</div>
    <div style="height:96px"></div>
  `;
}

function openMetricSheet(dateISO, metricId) {
  const editing = metricId ? state.metrics.find(m => m.id === metricId) : null;
  const date = editing ? editing.date : (dateISO || todayISO());
  const weight = editing && editing.weight != null ? editing.weight : '';
  const bodyFat = editing && editing.bodyFat != null ? editing.bodyFat : '';
  const note = editing ? editing.note : '';
  const html = `
    <div class="sheet-grab"></div>
    <h3>${editing ? '编辑身体数据' : '记录体重 / 体脂'}</h3>
    <div class="sub">${esc(fmtDateCN(date))}</div>
    <div class="field">
      <label>日期</label>
      <input class="input" type="date" id="mDate" value="${date}">
    </div>
    <div class="metric-grid">
      <div class="field">
        <label>体重 (kg)</label>
        <input class="input" type="number" inputmode="decimal" step="0.1" id="mWeight" placeholder="例如 65.5" value="${weight}">
      </div>
      <div class="field">
        <label>体脂率 (%)</label>
        <input class="input" type="number" inputmode="decimal" step="0.1" id="mFat" placeholder="例如 18.5" value="${bodyFat}">
      </div>
    </div>
    <div class="field">
      <label>备注（可选）</label>
      <input class="input" id="mNote" placeholder="例如：晨起空腹" value="${esc(note)}">
    </div>
    <div class="btn-row">
      ${editing ? '<button class="btn danger" data-act="del-metric" data-id="' + editing.id + '">删除</button>' : ''}
      <button class="btn primary" data-act="save-metric" data-id="${editing ? editing.id : ''}">保存</button>
    </div>
  `;
  openSheet(html);
}

function saveMetricFromSheet(metricId) {
  const date = $('#mDate').value;
  const wRaw = $('#mWeight').value.trim();
  const fRaw = $('#mFat').value.trim();
  const note = $('#mNote').value.trim();
  if (!date) { toast('请选择日期'); return; }
  const weight = wRaw === '' ? null : parseFloat(wRaw);
  const bodyFat = fRaw === '' ? null : parseFloat(fRaw);
  if ((weight == null || isNaN(weight)) && (bodyFat == null || isNaN(bodyFat))) { toast('体重和体脂至少填一个'); return; }
  const rec = { id: metricId || uid(), date, weight: weight, bodyFat: bodyFat, note };
  if (metricId) {
    const idx = state.metrics.findIndex(m => m.id === metricId);
    if (idx >= 0) state.metrics[idx] = rec; else state.metrics.push(rec);
  } else {
    state.metrics.push(rec);
  }
  saveState(); closeSheet(); renderBody(); toast('已保存 ✓');
}

/* ---------------- 强制检查更新 ---------------- */
async function checkUpdate() {
  toast('正在检查更新…');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {}
  setTimeout(() => {
    try { location.replace(location.pathname + '?v=' + Date.now()); } catch (e) { location.reload(); }
  }, 350);
}

/* ---------------- 导出到苹果日历 ---------------- */
function icsEscape(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function nextDayISO(iso) {
  const d = parseISO(iso); d.setDate(d.getDate() + 1); return isoDate(d);
}
function exportICS() {
  const dates = new Set(Object.keys(state.gymDays).filter(d => state.gymDays[d]));
  state.entries.forEach(e => dates.add(e.date));
  if (!dates.size) { toast('还没有训练记录'); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FitLog//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  [...dates].sort().forEach(iso => {
    const parts = dayParts(iso);
    const list = entriesOn(iso);
    const summary = '🏋️ 健身' + (parts.length ? '：' + parts.join('·') : '');
    const desc = list.map(e => `${e.exercise} ${entrySetsText(e)}`).join('\n') || '训练日打卡';
    lines.push('BEGIN:VEVENT', `UID:${iso}@fitlog`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${iso.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDayISO(iso).replace(/-/g, '')}`,
      `SUMMARY:${icsEscape(summary)}`, `DESCRIPTION:${icsEscape(desc)}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `健身记录-日历-${todayISO()}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('已生成日历文件，用「日历」App 打开导入');
}

/* ---------------- 数据 / 设置 ---------------- */
function renderSettings() {
  const totalGym = Object.keys(state.gymDays).filter(d => state.gymDays[d]).length;
  const exCount = allExercises().length;
  const bytes = new Blob([JSON.stringify(state)]).size;
  $('#view').innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="section-title" style="margin:0 0 12px"><h2>数据概览</h2></div>
      <div class="chart-stats" style="margin:0">
        <div class="stat"><b>${totalGym}</b><span>训练日</span></div>
        <div class="stat"><b>${state.entries.length}</b><span>记录条数</span></div>
        <div class="stat"><b>${(state.metrics || []).length}</b><span>身体记录</span></div>
        <div class="stat"><b>${(bytes / 1024).toFixed(1)}K</b><span>数据大小</span></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="setting-row">
        <div><div class="t">深色模式</div><div class="s">高级黑主题；关掉切换为浅色</div></div>
        <label class="switch"><input type="checkbox" id="themeToggle" ${theme === 'dark' ? 'checked' : ''}><i></i></label>
      </div>
      <div class="setting-row">
        <div><div class="t">导出备份</div><div class="s">保存为 JSON 文件，可存到「文件」App</div></div>
        <button class="action" data-act="export">导出</button>
      </div>
      <div class="setting-row">
        <div><div class="t">导入备份</div><div class="s">从备份文件恢复（会覆盖当前数据）</div></div>
        <button class="action" data-act="import">导入</button>
      </div>
      <input type="file" id="importFile" accept=".json,application/json" class="hidden">
      <div class="setting-row">
        <div><div class="t">同步到苹果日历</div><div class="s">导出 .ics 文件，用「日历」App 打开即可导入训练日</div></div>
        <button class="action" data-act="export-ics">导出</button>
      </div>
      <div class="setting-row">
        <div><div class="t">填充示例数据</div><div class="s">生成 8 周示例训练，方便先看曲线效果</div></div>
        <button class="action" data-act="seed-demo">生成</button>
      </div>
      <div class="setting-row">
        <div><div class="t" style="color:var(--gym)">清空所有数据</div><div class="s">删除全部训练记录，不可恢复</div></div>
        <button class="action" style="color:var(--gym)" data-act="clear-all">清空</button>
      </div>
    </div>
    <div class="card">
      <div class="section-title" style="margin:0 0 8px"><h2>使用说明</h2></div>
      <p class="hint">
        · 数据只保存在这台手机上（浏览器本地），不会上传到任何服务器。<br>
        · 用 Safari 打开后，点底部「分享」→「添加到主屏幕」，就能像 App 一样使用。<br>
        · 建议每隔一段时间用「导出备份」存一份，换手机或清缓存前务必导出。
      </p>
    </div>
    <div style="height:24px"></div>
    <div class="hint" style="text-align:center;margin-top:2px">
      版本 ${APP_VERSION} · 数据保存在本机
      <button class="link-btn" data-act="check-update" style="margin-left:8px">检查更新</button>
    </div>
    <div style="height:16px"></div>
  `;
  const tt = $('#themeToggle');
  if (tt) tt.addEventListener('change', () => {
    setTheme(tt.checked ? 'dark' : 'light');
    toast(tt.checked ? '已切换深色模式' : '已切换浅色模式');
  });
}

/* ---------------- 导出 / 导入 ---------------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `健身记录备份-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('已导出备份');
}
function importDataFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result));
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries)) throw new Error('格式不对');
      if (!confirm('导入会覆盖当前数据，确定继续吗？')) return;
      state = normalizeState(raw);
      saveState(); render(); toast('导入成功');
    } catch (e) { alert('导入失败：' + e.message); }
  };
  reader.readAsText(file);
}
function clearAll() {
  if (!confirm('确定清空所有训练记录吗？此操作不可恢复（建议先导出备份）。')) return;
  state = emptyState(); saveState(); render(); toast('已清空');
}
function seedDemo() {
  if (state.entries.length && !confirm('当前已有记录，生成示例数据会覆盖，确定吗？')) return;
  state = buildDemoState(); saveState(); render(); toast('示例数据已生成');
}

/* ---------------- 示例数据 ---------------- */
function buildDemoState() {
  const exercises = ['深蹲', '硬拉', '卧推', '杠铃划船', '哑铃弯举', '肩推'];
  const baselines = { '深蹲': 60, '硬拉': 80, '卧推': 45, '杠铃划船': 50, '哑铃弯举': 10, '肩推': 25 };
  const entries = []; const gymDays = {}; const metrics = [];
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - 55);
  let day = new Date(start);
  let session = 0;
  while (day <= today) {
    const dow = day.getDay();
    if (dow === 1 || dow === 3 || dow === 5) {
      const iso = isoDate(day);
      gymDays[iso] = true;
      const n = 3 + (session % 2);
      for (let i = 0; i < n; i++) {
        const name = exercises[(session + i) % exercises.length];
        const base = baselines[name];
        const w = Math.round((base + Math.floor(session / 3) * 1.5 + (i * 0.5)) * 2) / 2;
        const reps = 8 - (i === 2 ? 1 : 0);
        entries.push({
          id: uid(), date: iso, exercise: name,
          sets: [{ w, r: reps }, { w, r: reps }, { w, r: Math.max(5, reps - 2) }],
          note: ''
        });
      }
      session++;
    }
    day.setDate(day.getDate() + 1);
  }
  for (let i = 0; i < 20; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i * 3);
    if (d > today) break;
    metrics.push({
      id: uid(), date: isoDate(d),
      weight: Math.round((70 - i * 0.28) * 10) / 10,
      bodyFat: Math.round((20 - i * 0.18) * 10) / 10,
      note: i === 0 ? '晨起空腹' : ''
    });
  }
  return { gymDays, parts: {}, entries, metrics, meta: { demo: true, createdAt: new Date().toISOString() } };
}

/* ---------------- 路由 / 渲染 ---------------- */
const TITLES = { calendar: '日历', records: '记录', charts: '曲线', body: '身体', settings: '数据' };

function render() {
  $('#viewTitle').textContent = TITLES[tab] || '健身记录';
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'calendar') renderCalendar();
  else if (tab === 'records') renderRecords();
  else if (tab === 'charts') renderCharts();
  else if (tab === 'body') renderBody();
  else renderSettings();
}

function switchTab(next) {
  tab = next;
  chartSel = -1;
  render();
  const v = $('#view');
  if (v) v.scrollTop = 0;
}

/* ---------------- 事件 ---------------- */
document.addEventListener('click', (ev) => {
  const tabBtn = ev.target.closest('.tab');
  if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }

  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const date = el.dataset.date;

  switch (act) {
    case 'prev-month':
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar(); break;
    case 'next-month':
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar(); break;
    case 'open-day': openDaySheet(date); break;
    case 'add-entry': openEntrySheet(date); break;
    case 'edit-entry': {
      const id = el.dataset.id || el.closest('[data-id]')?.dataset.id;
      const entry = state.entries.find(e => e.id === id);
      if (!entry) return;
      closeSheet();
      setTimeout(() => openEntrySheet(entry.date, entry.id), 120);
      break;
    }
    case 'save-entry':
      saveEntryFromSheet(el.dataset.id || '');
      break;
    case 'del-entry': {
      if (!confirm('确定删除这条记录吗？')) return;
      const id = el.dataset.id;
      state.entries = state.entries.filter(e => e.id !== id);
      saveState(); closeSheet(); render(); toast('已删除');
      break;
    }
    case 'close-sheet': closeSheet(); break;
    case 'pick-exercise':
      chartExercise = el.dataset.ex; chartSel = -1; renderCharts(); break;
    case 'metric':
      chartMetric = el.dataset.metric; chartSel = -1; renderCharts(); break;
    case 'range':
      chartRange = el.dataset.range; chartSel = -1; renderCharts(); break;
    case 'export': exportData(); break;
    case 'export-ics': exportICS(); break;
    case 'check-update': checkUpdate(); break;
    case 'import': $('#importFile')?.click(); break;
    case 'seed-demo': seedDemo(); break;
    case 'clear-all': clearAll(); break;
    case 'add-metric': openMetricSheet(date); break;
    case 'edit-metric': {
      const id = el.dataset.id || el.closest('[data-id]')?.dataset.id;
      const m = state.metrics.find(x => x.id === id);
      if (!m) return;
      closeSheet();
      setTimeout(() => openMetricSheet(m.date, m.id), 120);
      break;
    }
    case 'save-metric': saveMetricFromSheet(el.dataset.id || ''); break;
    case 'del-metric': {
      if (!confirm('确定删除这条身体记录吗？')) return;
      state.metrics = state.metrics.filter(m => m.id !== el.dataset.id);
      saveState(); closeSheet(); renderBody(); toast('已删除');
      break;
    }
    case 'body-metric':
      bodyMetric = el.dataset.metric === 'fat' ? 'fat' : 'weight';
      renderBody();
      break;
    case 'open-month-picker': openMonthPicker(); break;
    case 'pick-year-prev':
      pickYear--; refreshMonthPicker(); break;
    case 'pick-year-next':
      pickYear++; refreshMonthPicker(); break;
    case 'pick-month': {
      calYear = pickYear;
      calMonth = Number(el.dataset.month);
      closeSheet();
      render();
      toast(`${calYear}年${calMonth + 1}月`);
      break;
    }
    case 'pick-this-month': {
      const n = new Date();
      calYear = n.getFullYear(); calMonth = n.getMonth();
      closeSheet();
      render();
      toast('已回到本月');
      break;
    }
    case 'toggle-part':
      togglePart(el.dataset.date, el.dataset.part);
      break;
  }
});

// 点曲线上的点
document.addEventListener('click', (ev) => {
  const circle = ev.target.closest('circle[data-idx]');
  if (!circle) return;
  const idx = Number(circle.dataset.idx);
  chartSel = idx === chartSel ? -1 : idx;
  renderCharts();
}, true);

// 导入文件选择
document.addEventListener('change', (ev) => {
  if (ev.target && ev.target.id === 'importFile') {
    const f = ev.target.files && ev.target.files[0];
    if (f) importDataFromFile(f);
    ev.target.value = '';
  }
});

// 「今天」按钮
document.getElementById('btnToday').addEventListener('click', () => {
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  if (tab !== 'calendar') { switchTab('calendar'); return; }
  renderCalendar();
  toast('已回到今天');
});

/* ---------------- 启动 ---------------- */
(function init() {
  const params = new URLSearchParams(location.search);
  state = loadState();

  if (params.get('demo') === '1') {
    state = buildDemoState();   // 演示模式：不写入本地存储
  }
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  if (params.get('month') && /^\d{4}-\d{2}$/.test(params.get('month'))) {
    const [y, m] = params.get('month').split('-').map(Number);
    calYear = y; calMonth = m - 1;
  }
  if (params.get('tab')) tab = params.get('tab');
  if (params.get('ex')) chartExercise = params.get('ex');
  if (!chartExercise) chartExercise = mostCommonExercise();

  render();

  // 供调试/自动化测试使用（正常使用无影响）
  window.__fitlog = {
    get state() { return state; },
    saveState, render, switchTab, openEntrySheet, openDaySheet, closeSheet,
    lunarOf, solarToLunar
  };

  // 预览用：?sheet=day / ?sheet=entry 直接打开对应弹层（方便截图演示）
  const sheetParam = params.get('sheet');
  if (sheetParam === 'day') setTimeout(() => openDaySheet(params.get('date') || todayISO()), 120);
  else if (sheetParam === 'entry') setTimeout(() => openEntrySheet(params.get('date') || todayISO()), 120);
  else if (sheetParam === 'month') setTimeout(() => openMonthPicker(), 120);

  // 调试：?debug=1 时显示视口宽度与超宽元素
  if (params.get('debug') === '1') {
    setTimeout(() => {
      const wide = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.left < -1) wide.push(el.tagName + '.' + String(el.className).slice(0, 20) + ' L' + Math.round(r.left) + ' R' + Math.round(r.right));
      });
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#fff;color:#000;font-size:11px;line-height:1.35;padding:6px;max-width:100%;white-space:pre-wrap;border:1px solid #000';
      d.textContent = 'innerWidth=' + innerWidth + ' SW=' + document.documentElement.scrollWidth + ' BODY=' + document.body.scrollWidth + '\n' + wide.slice(0, 8).join('\n');
      const tb = document.querySelector('.tabbar');
      if (tb) {
        const r = tb.getBoundingClientRect();
        d.textContent += '\nTAB y=' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' z=' + getComputedStyle(tb).zIndex + ' pos=' + getComputedStyle(tb).position + ' kids=' + tb.children.length;
        const c0 = tb.children[0];
        if (c0) {
          const r0 = c0.getBoundingClientRect();
          d.textContent += '\nTAB0 rect=' + [r0.left, r0.top, r0.width, r0.height].map(v => Math.round(v)).join(',') + ' color=' + getComputedStyle(c0).color + ' op=' + getComputedStyle(c0).opacity + ' vis=' + getComputedStyle(c0).visibility;
        }
      }
      document.body.appendChild(d);
    }, 400);
  }

  // PWA：注册 Service Worker（https 或 localhost 下生效），并确保能拿到最新版本
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => { reg.update().catch(() => {}); })
        .catch(() => {});
      let refreshed = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshed) return;
        refreshed = true;
        location.reload();
      });
    });
  }
})();
