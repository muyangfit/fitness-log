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
let chartMetric = 'max';   // 'max' | 'e1rm'
let chartSel = -1;

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
function emptyState() { return { gymDays: {}, entries: [], meta: { createdAt: new Date().toISOString() } }; }

function normalizeState(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  if (raw.gymDays && typeof raw.gymDays === 'object') s.gymDays = raw.gymDays;
  if (Array.isArray(raw.entries)) {
    s.entries = raw.entries.filter(e => e && typeof e.date === 'string' && typeof e.exercise === 'string').map(e => ({
      id: e.id || uid(),
      date: e.date,
      exercise: e.exercise,
      sets: Array.isArray(e.sets) ? e.sets.map(x => ({ w: Number(x.w) || 0, r: Number(x.r) || 0 })) : [],
      note: e.note || ''
    }));
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
    const cls = ['day', gym ? 'gym' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
    cells += `<button class="${cls}" data-act="open-day" data-date="${iso}">
      <span>${d}</span>${hasEntry && !gym ? '<i class="dot"></i>' : (hasEntry && gym ? '<i class="dot"></i>' : '')}
    </button>`;
  }
  const trailing = (7 - ((startIdx + daysInMonth) % 7)) % 7;
  for (let i = 0; i < trailing; i++) cells += '<div class="day blank"></div>';

  $('#view').innerHTML = `
    <div class="card">
      <div class="cal-head">
        <div class="cal-title">${calYear}年${calMonth + 1}月</div>
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
        <span>点日期可标记 / 记录</span>
      </div>
    </div>
    <div style="height:12px"></div>
  `;
}

function openDaySheet(iso) {
  const gym = !!state.gymDays[iso];
  const list = entriesOn(iso).sort((a, b) => a.exercise.localeCompare(b.exercise, 'zh'));
  const html = `
    <div class="sheet-grab"></div>
    <h3>${esc(fmtDateCN(iso))}</h3>
    <div class="sub">${gym ? '已标记为训练日' : '还没有标记训练日'}</div>
    <div class="setting-row" style="border-bottom:0;padding:2px 2px 12px">
      <div><div class="t">今天去了健身房</div><div class="s">打开后日历上会显示红色标记</div></div>
      <label class="switch"><input type="checkbox" id="gymToggle" ${gym ? 'checked' : ''}><i></i></label>
    </div>
    <div class="section-title" style="margin:0 0 8px">
      <h2 style="font-size:15px">当天训练</h2>
      <button class="link-btn" data-act="add-entry" data-date="${iso}">+ 添加动作</button>
    </div>
    ${list.length ? list.map(e => entryRowHTML(e)).join('') : `<div class="empty" style="padding:28px 0"><span class="big">🏋️</span>还没有训练记录<br><span class="tiny">点右上「+ 添加动作」开始记录</span></div>`}
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
    return `<div class="day-group">
      <div class="day-group-head">
        <b>${esc(fmtDateCN(iso))}</b>
        ${gym ? '<span class="badge">训练日</span>' : ''}
        <span class="muted tiny" style="margin-left:auto">${list.length} 个动作 · 容量 ${Math.round(volume)}kg</span>
      </div>
      ${list.map(e => entryRowHTML(e)).join('')}
    </div>`;
  }).join('');

  $('#view').innerHTML = `
    ${dates.length ? groups : `<div class="empty"><span class="big">📋</span>还没有记录<br><span class="tiny">点右下角 + 添加第一条训练记录</span></div>`}
    <div class="fab" data-act="add-entry" data-date="${todayISO()}" role="button" aria-label="添加记录">+</div>
    <div style="height:40px"></div>
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
function seriesFor(exercise) {
  const byDate = new Map();
  state.entries.filter(e => e.exercise === exercise).forEach(e => {
    const date = e.date;
    let val = 0;
    if (chartMetric === 'e1rm') {
      e.sets.forEach(s => { if (s.w > 0 && s.r > 0) val = Math.max(val, s.w * (1 + s.r / 30)); });
    } else {
      val = Math.max(0, ...e.sets.map(s => s.w || 0));
    }
    val = Math.round(val * 10) / 10;
    if (!byDate.has(date) || byDate.get(date) < val) byDate.set(date, val);
  });
  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildChartSVG(points) {
  const W = 360, H = 224, L = 42, R = 14, T = 18, B = 32;
  const iw = W - L - R, ih = H - T - B;
  if (!points.length) return '';
  const vals = points.map(p => p.value);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  let lo = vMin, hi = vMax;
  if (hi - lo < 1) { lo = Math.max(0, lo - 2); hi = hi + 2; }
  else { const padV = Math.max(1, (hi - lo) * 0.12); lo = Math.max(0, lo - padV); hi = hi + padV; }

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
    grid += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}" style="stroke:var(--line);stroke-width:1"/>`;
    grid += `<text x="${L - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" style="fill:var(--muted);font-size:10px">${Math.round(v * 10) / 10}</text>`;
  }

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value), p }));
  const line = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `M ${coords[0].x.toFixed(1)} ${(T + ih).toFixed(1)} L ` + coords.map(c => `${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' L ') + ` L ${coords[coords.length - 1].x.toFixed(1)} ${(T + ih).toFixed(1)} Z`;

  const dots = coords.map((c, i) => {
    const sel = i === chartSel;
    return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${sel ? 6 : 4}" data-idx="${i}"
      style="fill:${sel ? '#fff' : 'var(--accent)'};stroke:var(--accent);stroke-width:${sel ? 3 : 2}"/>`;
  }).join('');

  const labels = [];
  const n = points.length;
  const idxs = n === 1 ? [0] : (n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1]);
  idxs.forEach(i => {
    const c = coords[i];
    labels.push(`<text x="${c.x.toFixed(1)}" y="${H - 10}" text-anchor="middle" style="fill:var(--muted);font-size:10px">${fmtShort(points[i].date)}</text>`);
  });

  // 选中点数值标签
  let tag = '';
  if (chartSel >= 0 && chartSel < coords.length) {
    const c = coords[chartSel];
    const tx = Math.min(Math.max(c.x, L + 24), W - R - 24);
    tag = `<text x="${tx.toFixed(1)}" y="${Math.max(c.y - 12, 14).toFixed(1)}" text-anchor="middle"
      style="fill:var(--accent);font-size:11px;font-weight:700">${fmtShort(c.p.date)} · ${fmtKg(c.p.value)}</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" aria-label="重量变化曲线">
    <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity=".22"/>
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" style="fill:url(#gArea)"/>
    <polyline points="${line}" style="fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"/>
    ${dots}
    ${labels}
    ${tag}
  </svg>`;
}

function renderCharts() {
  const exercises = allExercises();
  if (!exercises.length) {
    $('#view').innerHTML = `<div class="empty"><span class="big">📈</span>还没有训练记录<br><span class="tiny">先在「记录」里添加几次训练，这里就会生成重量曲线</span></div>`;
    return;
  }
  if (!chartExercise || !exercises.includes(chartExercise)) chartExercise = exercises[0];
  const points = seriesFor(chartExercise);
  const values = points.map(p => p.value);
  const maxV = values.length ? Math.max(...values) : 0;
  const lastV = values.length ? values[values.length - 1] : 0;
  const firstV = values.length ? values[0] : 0;
  const delta = lastV - firstV;
  const totalSessions = points.length;

  $('#view').innerHTML = `
    <div class="chips">
      ${exercises.map(x => `<button class="chip ${x === chartExercise ? 'active' : ''}" data-act="pick-exercise" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}
    </div>
    <div class="seg">
      <button class="${chartMetric === 'max' ? 'active' : ''}" data-act="metric" data-metric="max">最大重量</button>
      <button class="${chartMetric === 'e1rm' ? 'active' : ''}" data-act="metric" data-metric="e1rm">估算 1RM</button>
    </div>
    <div class="card chart-card">
      <div class="chart-wrap">${buildChartSVG(points)}</div>
      <div class="chart-stats">
        <div class="stat"><b>${totalSessions}</b><span>训练次数</span></div>
        <div class="stat"><b>${fmtKg(maxV)}</b><span>最重</span></div>
        <div class="stat"><b>${fmtKg(lastV)}</b><span>最近</span></div>
        <div class="stat"><b style="color:${delta >= 0 ? 'var(--accent)' : 'var(--muted)'}">${delta > 0 ? '+' : ''}${fmtKg(delta)}</b><span>对比首次</span></div>
      </div>
    </div>
    <div class="card chart-list" style="margin-top:14px">
      <div class="section-title" style="margin:0 0 4px"><h2 style="font-size:15px">${esc(chartExercise)} 记录</h2><span class="muted tiny">点曲线上的点可查看数值</span></div>
      ${points.slice().reverse().slice(0, 10).map(p => `
        <div class="chart-row">
          <span class="d">${esc(fmtShort(p.date))}</span>
          <span class="v">${fmtKg(p.value)}</span>
        </div>`).join('')}
    </div>
    <div style="height:14px"></div>
  `;
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
        <div class="stat"><b>${exCount}</b><span>动作种类</span></div>
        <div class="stat"><b>${(bytes / 1024).toFixed(1)}K</b><span>数据大小</span></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
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
  `;
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
  const entries = []; const gymDays = {};
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
  return { gymDays, entries, meta: { demo: true, createdAt: new Date().toISOString() } };
}

/* ---------------- 路由 / 渲染 ---------------- */
const TITLES = { calendar: '日历', records: '记录', charts: '曲线', settings: '数据' };

function render() {
  $('#viewTitle').textContent = TITLES[tab] || '健身记录';
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'calendar') renderCalendar();
  else if (tab === 'records') renderRecords();
  else if (tab === 'charts') renderCharts();
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
    case 'export': exportData(); break;
    case 'import': $('#importFile')?.click(); break;
    case 'seed-demo': seedDemo(); break;
    case 'clear-all': clearAll(); break;
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
    saveState, render, switchTab, openEntrySheet, openDaySheet, closeSheet
  };

  // 预览用：?sheet=day / ?sheet=entry 直接打开对应弹层（方便截图演示）
  const sheetParam = params.get('sheet');
  if (sheetParam === 'day') setTimeout(() => openDaySheet(params.get('date') || todayISO()), 120);
  else if (sheetParam === 'entry') setTimeout(() => openEntrySheet(params.get('date') || todayISO()), 120);

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

  // PWA：注册 Service Worker（https 或 localhost 下生效）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
