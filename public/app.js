
"use strict";
/* ============================================================
 * 工具函数
 * ============================================================ */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

async function api(path, opts) {
  const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  return r.json();
}

async function cli(args) {
  const j = await api('/api/exec', { method: 'POST', body: JSON.stringify({ args }) });
  if (!j.ok) {
    const err = new Error(j.message || j.error || 'CLI 调用失败');
    err.apiCode = j.apiCode;
    throw err;
  }
  return j;
}

/* ============================================================
 * Toast 与模态框
 * ============================================================ */
function toast(msg, type = 'info', action) {
  const icons = { ok: '✓', fail: '✕', info: 'ℹ' };
  const box = $('#toasts');
  const t = el('div', { class: `toast ${type}` },
    el('div', { class: 't-icon' }, icons[type] || 'ℹ'),
    el('div', { class: 't-msg' }, msg),
    action ? el('button', { class: 't-act', onclick: () => { action.fn(); dismiss(); } }, action.label) : null
  );
  box.appendChild(t);
  const dismiss = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  setTimeout(dismiss, 3500);
}

function modal({ title, body, footer, wide, onClose }) {
  const root = $('#modal-root');
  const mask = el('div', { class: 'modal-mask' },
    el('div', { class: 'modal' + (wide ? ' wide' : '') },
      el('div', { class: 'modal-head' },
        el('h3', {}, title),
        el('button', { class: 'modal-close', onclick: close }, '✕')
      ),
      el('div', { class: 'modal-body' }, body),
      footer ? el('div', { class: 'modal-foot' }, footer) : null
    )
  );
  function close() { mask.style.animation = 'fadeIn .18s ease reverse'; setTimeout(() => mask.remove(), 160); if (onClose) onClose(); }
  mask.addEventListener('mousedown', (e) => { if (e.target === mask) close(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  root.appendChild(mask);
  return close;
}

function confirmModal(title, msg, { danger, okText = '确认' } = {}) {
  return new Promise((resolve) => {
    let closed = false;
    const done = (v) => { if (!closed) { closed = true; resolve(v); } };
    const close = modal({
      title,
      body: el('div', { style: 'font-size:13.5px;line-height:1.7;color:var(--muted)' }, msg),
      footer: [
        el('button', { class: 'btn btn-ghost', onclick: () => { close(); done(false); } }, '取消'),
        el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => { close(); done(true); } }, okText),
      ],
    });
  });
}

/* ============================================================
 * 通用辅助
 * ============================================================ */
const TASK_STATUS = {
  1: { name: '等待中', cls: 'wait' }, 2: { name: '成功', cls: 'ok' },
  3: { name: '失败', cls: 'fail' }, 4: { name: '已取消', cls: 'cancel' },
  5: { name: '运行中', cls: 'run' },
};
const TRIGGER_TYPE = {
  schedule: { name: '定时', cls: 'blue' }, email: { name: '邮件', cls: 'purple' },
  folder: { name: '文件夹', cls: 'teal' }, file: { name: '文件夹', cls: 'teal' },
  hotkey: { name: '热键', cls: 'plain cancel' },
};

// 热键修饰键位掩码（Windows ModifierKeys 枚举）
const HOTKEY_MODIFIERS = [
  { value: 1, label: 'Alt', key: 'Alt' },
  { value: 2, label: 'Ctrl', key: 'Ctrl' },
  { value: 4, label: 'Shift', key: 'Shift' },
  { value: 8, label: 'Win', key: 'Win' },
];
// 文件事件位掩码（FileSystemWatcher WatcherChangeTypes 枚举）
const FILE_EVENTS = [
  { value: 1, label: '新建文件', key: 'Created' },
  { value: 2, label: '删除文件', key: 'Deleted' },
  { value: 4, label: '修改文件', key: 'Changed' },
  { value: 8, label: '重命名', key: 'Renamed' },
];
// 虚拟键码 → 可读键名（常用键）
const VK_NAMES = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Esc', 32: 'Space',
  37: '←', 38: '↑', 39: '→', 40: '↓',
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
  65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I', 74: 'J',
  75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T',
  85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
  96: 'Num0', 97: 'Num1', 98: 'Num2', 99: 'Num3', 100: 'Num4', 101: 'Num5',
  102: 'Num6', 103: 'Num7', 104: 'Num8', 105: 'Num9',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
  118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
};
function vkName(code) { return VK_NAMES[code] || String.fromCharCode(code) || ('VK' + code); }
function hotkeyDescribe(modifierKeys, virtualKey) {
  const mods = HOTKEY_MODIFIERS.filter(m => (modifierKeys & m.value) === m.value).map(m => m.label);
  const key = vkName(virtualKey);
  return mods.length ? mods.join('+') + '+' + key : key;
}
function fileEventsDescribe(mask) {
  const arr = FILE_EVENTS.filter(e => (mask & e.value) === e.value).map(e => e.label);
  return arr.length ? arr.join('/') : ('事件(' + mask + ')');
}

function cronDescribe(cron) {
  if (!cron) return '';
  const parts = String(cron).trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [m, h, dom, mon, dow] = parts;
  if (m.startsWith('*/') && h === '*') return `每 ${m.slice(2)} 分钟`;
  if (h.startsWith('*/')) return `每 ${h.slice(2)} 小时（第 ${m} 分）`;
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (dom === '*' && mon === '*') {
    if (dow === '*') return `每天 ${time}`;
    const days = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' };
    if (days[dow] !== undefined) return `每周${days[dow]} ${time}`;
    return `${cron}`;
  }
  if (dow === '*' && mon === '*') return `每月 ${dom} 日 ${time}`;
  return cron;
}

function fmtBytes(n) {
  if (n == null) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
function fmtTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).replace('T', ' ').replace(/Z$/, '').slice(0, 19);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function shortId(id) { return id ? String(id).slice(0, 8) + '…' : '-'; }

function stagger(container, selector = '.fade-item') {
  $$(selector, container).forEach((n, i) => { n.style.animationDelay = Math.min(i * 45, 600) + 'ms'; });
  return container;
}

function countUp(node, target, dur = 900) {
  const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function skeletonRows(cols, rows = 6) {
  const wrap = el('div', { class: 'tbl-wrap' });
  for (let i = 0; i < rows; i++) {
    const row = el('div', { class: 'skl-row' });
    for (let c = 0; c < cols; c++) {
      const w = [30, 18, 12, 14, 12][c % 5];
      row.appendChild(el('div', { class: 'skl', style: `height:14px;width:${w}%` }));
    }
    wrap.appendChild(row);
  }
  return wrap;
}

function emptyState(text, icon = '📭') {
  return el('div', { class: 'empty fade-item' }, el('div', { class: 'e-icon' }, icon), el('p', {}, text));
}

/* 通用分页条：显示总数/总页数，支持每页条数切换、页码跳转，末页禁用下一页 */
function renderPager(opts) {
  const { curPage, total, pageSize, onPage, onSize } = opts;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, curPage), totalPages);

  const sizeSel = el('select', { class: 'select', style: 'padding:4px 8px;font-size:12px' },
    [10, 20, 50].map((n) => new Option(`${n} 条/页`, String(n))));
  sizeSel.value = String(pageSize);   // 显式选中当前 pageSize（new Option 第三参数只设 defaultSelected，不会真正选中）
  sizeSel.addEventListener('change', (e) => onSize(parseInt(e.target.value, 10)));

  const pages = el('div', { style: 'display:flex;gap:4px;align-items:center' });
  function addPageBtn(p, label, active) {
    const b = el('button', {
      class: 'page-btn' + (active ? ' active' : ''),
      onclick: () => { if (p !== page && p >= 1 && p <= totalPages) onPage(p); },
      disabled: (p < 1 || p > totalPages || p === page) ? '' : null,
    }, label != null ? label : String(p));
    pages.appendChild(b);
    return b;
  }

  // 生成页码：首尾 + 当前附近，省略号分隔
  addPageBtn(page - 1, '‹');
  const range = [];
  const start = Math.max(1, page - 2), end = Math.min(totalPages, page + 2);
  if (start > 1) { range.push(1); if (start > 2) range.push('…'); }
  for (let i = start; i <= end; i++) range.push(i);
  if (end < totalPages) { if (end < totalPages - 1) range.push('…'); range.push(totalPages); }
  range.forEach((p) => { if (p === '…') pages.appendChild(el('span', { class: 'page-ellipsis' }, '…')); else addPageBtn(p, null, p === page); });
  addPageBtn(page + 1, '›');

  const wrap = el('div', { class: 'pager' },
    el('span', {}, `共 ${total} 条 · 共 ${totalPages} 页`),
    sizeSel,
    pages,
  );
  return wrap;
}

/* 加载按钮状态 */
function btnLoading(btn, loading, text) {
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${text || '处理中…'}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
  }
}

/* ============================================================
 * 图标
 * ============================================================ */
const I = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  triggers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  migration: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>',
  groups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>',
  messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  extensions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-3v10l-6-3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 9l5-5 5 5"/><path d="M12 4v12"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 11l5 5 5-5"/><path d="M12 16V4"/></svg>',
};

/* ============================================================
 * 应用状态与路由
 * ============================================================ */
const App = { account: null, module: 'dashboard', unread: 0 };

const MODULES = {
  dashboard:  { title: '仪表盘', sub: '系统状态总览', icon: I.dashboard, render: renderDashboard },
  apps:       { title: '应用管理', sub: '查看与运行 RPA 应用', icon: I.apps, render: renderApps },
  tasks:      { title: '任务管理', sub: '任务历史、日志与回放', icon: I.tasks, render: renderTasks },
  triggers:   { title: '触发器管理', sub: '定时 / 邮件 / 文件夹 / 热键', icon: I.triggers, render: renderTriggers },
  migration:  { title: '触发器迁移', sub: '跨账号导出 · 名称匹配 · 导入', icon: I.migration, render: renderMigration },
  groupsync:  { title: '分组同步', sub: '跨账号同步分组与归组应用', icon: I.groups, render: renderGroupSync },
  messages:   { title: '消息中心', sub: '系统消息', icon: I.messages, render: renderMessages },
  extensions: { title: '扩展管理', sub: '浏览器与设备扩展', icon: I.extensions, render: renderExtensions },
  settings:   { title: '系统设置', sub: '配置项与模式切换', icon: I.settings, render: renderSettings },
};

function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  Object.entries(MODULES).forEach(([key, m]) => {
    nav.appendChild(el('div', { class: 'nav-item' + (key === App.module ? ' active' : ''), onclick: () => navigate(key) },
      el('span', { html: m.icon }), m.title,
      key === 'messages' && App.unread > 0 ? el('span', { class: 'nav-dot', title: '未读消息' }) : null
    ));
  });
}

function setActiveNav(name) {
  // 只切换 active 状态，不重建 DOM（避免导航切换时的重排开销）
  const keys = Object.keys(MODULES);
  $$('.nav-item', $('#nav')).forEach((n, i) => {
    n.classList.toggle('active', keys[i] === name);
  });
}

function navigate(name) {
  App.module = name;
  setActiveNav(name);
  const m = MODULES[name];
  $('#page-title').innerHTML = `${m.title}<small>${m.sub}</small>`;
  const page = $('#page');
  page.innerHTML = '';
  page.classList.remove('page-anim');
  void page.offsetWidth; // 强制重排以重启动画
  page.classList.add('page-anim');
  m.render(page);
}

async function refreshAccount() {
  try {
    const r = await cli(['auth', 'current']);
    App.account = r.data && r.data.loggedIn ? r.data : null;
  } catch { App.account = null; }
  const chip = $('#account-chip');
  if (App.account) {
    const name = App.account.displayName || App.account.userName || '未知';
    chip.title = `${App.account.userName} · ${App.account.accountType || ''}`;
    chip.innerHTML = '';
    chip.appendChild(el('div', { class: 'avatar' }, String(name).charAt(0)));
    chip.appendChild(el('span', {}, name));
    chip.appendChild(el('span', { class: 'badge ok plain', style: 'font-size:10.5px' }, '在线'));
  } else {
    chip.innerHTML = '';
    chip.appendChild(el('span', { style: 'color:var(--danger);font-size:12.5px' }, '● 未登录'));
  }
}

/* ============================================================
 * 仪表盘
 * ============================================================ */
async function renderDashboard(page) {
  page.appendChild(el('div', { class: 'loading-center' }, el('div', { class: 'spinner-lg' }), '正在获取系统状态…'));

  // 聚合接口（内部 4 并发 + 10s 缓存）+ 并发获取未读消息和扩展
  // 去掉了原来的串行翻页循环（while p<=30），appCount 直接用聚合接口返回值
  const [statusR, msgR, extR] = await Promise.all([
    api('/api/system/status').catch(() => ({ ok: false })),
    cli(['console', 'message', 'list', '--status', 'unread', '--size', '1']).catch(() => null),
    cli(['console', 'extension', 'list']).catch(() => null),
  ]);

  const acc = statusR.ok && statusR.account && statusR.account.loggedIn ? statusR.account : null;
  const health = (statusR.ok && statusR.health) ? statusR.health : {};
  const lanIP = statusR.ok && statusR.lanIP ? statusR.lanIP : null;
  const port = statusR.ok && statusR.port ? statusR.port : '18923';
  const triggerCount = statusR.ok && statusR.triggerCount != null ? statusR.triggerCount : 0;
  const appCount = statusR.ok && statusR.appCount != null ? statusR.appCount : 0;
  const msgs = (msgR && msgR.data) || {};
  const exts = (extR && extR.data && (extR.data.items || extR.data.extensions)) || [];

  // 未读数量：message list unread 返回的 items 就是未读
  App.unread = msgs.totalUnread != null ? msgs.totalUnread : (msgR && msgR.data && msgR.data.items ? msgR.data.items.length : 0);
  buildNav();

  page.innerHTML = '';
  const grid = el('div', { class: 'stat-grid mb16' });
  const stats = [
    { label: 'RPA 应用', value: appCount, icon: I.apps, color: 'var(--accent)', bg: 'var(--accent-dim)' },
    { label: '触发器', value: triggerCount, icon: I.triggers, color: 'var(--purple)', bg: 'var(--purple-dim)' },
    { label: '未读消息', value: App.unread, icon: I.messages, color: 'var(--warn)', bg: 'var(--warn-dim)' },
    { label: '扩展', value: Array.isArray(exts) ? exts.length : 0, icon: I.extensions, color: 'var(--ok)', bg: 'var(--ok-dim)' },
  ];
  stats.forEach((s) => {
    const num = el('div', { class: 'stat-num' }, '0');
    grid.appendChild(el('div', { class: 'card stat-card fade-item' },
      el('div', { class: 'stat-icon', style: `color:${s.color};background:${s.bg}`, html: s.icon }),
      num, el('div', { class: 'stat-label' }, s.label)));
    countUp(num, s.value);
  });
  page.appendChild(stagger(grid));

  const row = el('div', { class: 'grid-2 mt16' });
  // 账号卡片
  const accCard = el('div', { class: 'card fade-item' },
    el('div', { class: 'card-title' }, '当前账号'),
    acc ? el('dl', { class: 'kv' },
      el('dt', {}, '显示名'), el('dd', { style: 'font-weight:600' }, acc.displayName || '-'),
      el('dt', {}, '用户名'), el('dd', {}, acc.userName || '-'),
      el('dt', {}, '账号类型'), el('dd', {}, el('span', { class: 'badge blue plain' }, acc.accountType || '-')),
      el('dt', {}, '用户 ID'), el('dd', { class: 'mono', style: 'font-family:var(--mono);font-size:12px' }, acc.userId || '-'),
    ) : el('div', { class: 'warn-banner' }, '⚠ 影刀客户端未登录，请先登录后使用控制台功能。')
  );
  // 系统状态卡片
  const sysCard = el('div', { class: 'card fade-item' },
    el('div', { class: 'card-title' }, '系统状态', el('span', { class: 'hint' }, 'console-restapi')),
    el('dl', { class: 'kv' },
      el('dt', {}, '服务状态'), el('dd', {}, el('span', { class: 'badge ' + (health.status === 'ready' ? 'ok' : 'fail') }, health.status || '未知')),
      el('dt', {}, '服务名称'), el('dd', {}, health.service || '-'),
      el('dt', {}, '本机访问'), el('dd', { class: 'mono', style: 'font-size:12px' }, 'http://127.0.0.1:' + port),
      el('dt', {}, '局域网访问'), el('dd', { class: 'mono', style: 'font-size:12px' }, lanIP ? ('http://' + lanIP + ':' + port) : '未检测到'),
      el('dt', {}, '服务器时间'), el('dd', {}, fmtTime(new Date().toISOString())),
      el('dt', {}, '快捷操作'), el('dd', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('tasks') }, '查看任务'),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('triggers') }, '管理触发器'),
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate('migration') }, '触发器迁移'),
      ),
    )
  );
  row.appendChild(accCard);
  row.appendChild(sysCard);
  page.appendChild(stagger(row));
}

/* ============================================================
 * 应用管理
 * ============================================================ */
async function renderApps(page) {
  let keyword = '';
  let curPage = 1;
  let pageSize = 20;
  let groupFilter = '';        // 当前选中的分组 groupId（'' = 全部）
  const groups = [];           // [{groupId, name}]
  let allItems = [];           // 全量应用（本地过滤+分页）

  const groupSel = el('select', { class: 'select', onchange: (e) => {
    groupFilter = e.target.value;
    curPage = 1;
    renderList();
  } });

  const toolbar = el('div', { class: 'toolbar' },
    el('div', { class: 'search-box' }, el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' }),
      el('input', { class: 'input', placeholder: '搜索应用名称…', oninput: (e) => {
        keyword = e.target.value.trim().toLowerCase();
        clearTimeout(renderApps._t);
        renderApps._t = setTimeout(() => { curPage = 1; renderList(); }, 300);
      } })),
    el('div', { style: 'display:flex;align-items:center;gap:6px;color:var(--muted);font-size:12.5px' }, '分组', groupSel),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-ghost btn-sm', html: I.refresh + '刷新', onclick: load }),
  );
  const listWrap = el('div', {});
  page.appendChild(toolbar);
  page.appendChild(listWrap);
  listWrap.appendChild(skeletonRows(4));

  // 加载分组列表（REST 优先，缓存 5 分钟）
  async function loadGroups() {
    try {
      const r = await api('/api/app-groups');
      const items = (r.ok && r.data && r.data.items) || [];
      groups.length = 0;
      items.forEach((g) => groups.push({ groupId: g.groupId, name: g.name }));
      renderGroupOptions();
    } catch (e) { /* 分组加载失败不阻塞应用列表 */ }
  }
  function renderGroupOptions() {
    const cur = groupSel.value;
    groupSel.innerHTML = '';
    groupSel.appendChild(new Option('全部', ''));
    groupSel.appendChild(new Option('未分组', '__none__'));
    groups.forEach((g) => groupSel.appendChild(new Option(g.name, g.groupId)));
    const valid = cur === '__none__' || groups.some((g) => g.groupId === cur);
    groupSel.value = valid ? cur : '';
    groupFilter = groupSel.value;
  }
  function groupName(id) {
    if (!id) return '';
    const g = groups.find((x) => x.groupId === id);
    return g ? g.name : '';
  }

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonRows(4));
    try {
      const r = await api('/api/apps');
      if (!r.ok) throw new Error(r.error || r.message || '获取应用列表失败');
      allItems = (r.data && r.data.items) || [];
      renderList();
    } catch (e) {
      listWrap.innerHTML = '';
      listWrap.appendChild(el('div', { class: 'empty' }, el('p', { style: 'color:var(--danger)' }, '加载失败: ' + e.message)));
    }
  }

  function renderList() {
    listWrap.innerHTML = '';
    // 本地过滤：分组 + 关键字
    let filtered = allItems;
    if (groupFilter === '__none__') {
      filtered = filtered.filter((a) => !a.groupId);
    } else if (groupFilter) {
      filtered = filtered.filter((a) => a.groupId === groupFilter);
    }
    if (keyword) filtered = filtered.filter((a) => (a.appName || '').toLowerCase().includes(keyword));

    // 「全部」视图：按更新时间倒序（最近更新排前面）
    if (!groupFilter) {
      filtered = filtered.slice().sort((a, b) => {
        const ta = new Date(a.updateTime || 0).getTime();
        const tb = new Date(b.updateTime || 0).getTime();
        return tb - ta;
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (curPage > totalPages) curPage = totalPages;
    const startIdx = (curPage - 1) * pageSize;
    const items = filtered.slice(startIdx, startIdx + pageSize);

    if (!items.length) { listWrap.appendChild(emptyState('没有找到应用', '📦')); return; }

    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '应用名称'), el('th', {}, '分组'), el('th', {}, '应用 ID'), el('th', {}, '更新时间'), el('th', { style: 'text-align:right' }, '操作'))));
    const tbody = el('tbody');
    items.forEach((a) => {
      const gn = groupName(a.groupId);
      tbody.appendChild(el('tr', { class: 'fade-item' },
        el('td', { class: 'name-cell' }, a.appName || '-'),
        el('td', {}, gn ? el('span', { class: 'badge blue plain' }, gn) : el('span', { class: 'mono', style: 'color:var(--faint)' }, '未分组')),
        el('td', { class: 'mono' }, shortId(a.appId)),
        el('td', { class: 'mono' }, fmtTime(a.updateTime)),
        el('td', { style: 'text-align:right' },
          el('button', { class: 'btn btn-primary btn-sm', html: I.play + '运行', onclick: () => runApp(a) }))
      ));
    });
    tbl.appendChild(tbody);
    listWrap.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
    stagger(listWrap);
    listWrap.appendChild(renderPager({
      curPage, total, pageSize,
      onPage: (p) => { curPage = p; renderList(); },
      onSize: (s) => { pageSize = s; curPage = 1; renderList(); },
    }));
  }

  async function runApp(a) {
    const ok = await confirmModal('运行应用', `确定要运行应用「${a.appName}」吗？将以异步模式启动，可在任务管理中查看进度。`, { okText: '运行' });
    if (!ok) return;
    try {
      const r = await cli(['console', 'task', 'run', '--app-id', a.appId, '--async']);
      const taskId = r.data && (r.data.taskId || r.data.id);
      toast(`应用「${a.appName}」已启动`, 'ok', taskId ? { label: '查看任务', fn: () => navigate('tasks') } : null);
    } catch (e) { toast('运行失败: ' + e.message, 'fail'); }
  }

  loadGroups();
  load();
}

/* ============================================================
 * 任务管理
 * ============================================================ */
async function renderTasks(page) {
  let curPage = 1, filter = 0, keyword = '';
  let pageSize = 20;
  const FILTERS = [
    { code: 0, name: '全部' }, { code: 2, name: '成功' }, { code: 3, name: '失败' },
    { code: 5, name: '运行中' }, { code: 1, name: '等待中' }, { code: 4, name: '已取消' },
  ];

  let tabs, listWrap, allItems = [];
  page.appendChild(tabs = el('div', { class: 'tabs' }));
  page.appendChild(el('div', { class: 'toolbar' },
    el('div', { class: 'search-box' }, el('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' }),
      el('input', { class: 'input', placeholder: '搜索任务：应用名 / 任务ID / 错误信息…', oninput: (e) => {
        keyword = e.target.value.trim().toLowerCase();
        clearTimeout(renderTasks._t);
        renderTasks._t = setTimeout(renderList, 300);
      } }))));
  page.appendChild(listWrap = el('div', {}));

  function buildTabs() {
    tabs.innerHTML = '';
    FILTERS.forEach((f) => {
      tabs.appendChild(el('div', {
        class: 'tab' + (filter === f.code ? ' active' : ''),
        onclick: () => { filter = f.code; buildTabs(); renderList(); }
      }, f.name));
    });
    tabs.appendChild(el('div', { class: 'spacer', style: 'flex:1' }));
    tabs.appendChild(el('button', { class: 'btn btn-ghost btn-sm', html: I.refresh + '刷新', onclick: load }));
  }

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonRows(5));
    try {
      const r = await api('/api/tasks');
      if (!r.ok) throw new Error(r.message || r.error || '获取任务历史失败');
      allItems = (r.data && r.data.items) || [];
      renderList();
    } catch (e) {
      listWrap.innerHTML = '';
      listWrap.appendChild(el('div', { class: 'empty' }, el('p', { style: 'color:var(--danger)' }, '加载失败: ' + e.message)));
    }
  }

  function renderList() {
    listWrap.innerHTML = '';
    let filtered = filter === 0 ? allItems : allItems.filter((t) => (t.statusCode || t.status) === filter);
    if (keyword) {
      filtered = filtered.filter((t) => {
        const taskId = (t.taskId || t.id || '').toString().toLowerCase();
        const appName = (t.appName || '').toLowerCase();
        const err = (t.error || '').toLowerCase();
        const src = (t.sourceName || '').toLowerCase();
        return appName.includes(keyword) || taskId.includes(keyword) || err.includes(keyword) || src.includes(keyword);
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (curPage > totalPages) curPage = totalPages;
    const startIdx = (curPage - 1) * pageSize;
    const items = filtered.slice(startIdx, startIdx + pageSize);

    if (!items.length) { listWrap.appendChild(emptyState(keyword ? '没有匹配的任务' : '当前筛选条件下没有任务', '🗂️')); return; }

    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {},
        el('th', {}, '任务'), el('th', {}, '状态'), el('th', {}, '创建时间'),
        el('th', {}, '错误信息'), el('th', { style: 'text-align:right' }, '操作'))));
    const tbody = el('tbody');
    items.forEach((t) => {
      const sc = t.statusCode || t.status;
      const st = TASK_STATUS[sc] || { name: t.statusName || '未知', cls: 'cancel' };
      const taskId = t.taskId || t.id;
      tbody.appendChild(el('tr', { class: 'fade-item' },
        el('td', { class: 'name-cell' }, t.appName || '-', el('span', { class: 'sub' }, '任务: ' + shortId(taskId))),
        el('td', {}, el('span', { class: 'badge ' + st.cls }, st.name)),
        el('td', { class: 'mono' }, fmtTime(t.createTime)),
        el('td', { style: 'max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--danger);font-size:12px' }, t.error || '-'),
        el('td', { style: 'text-align:right;white-space:nowrap' },
          el('button', { class: 'btn btn-ghost btn-sm', html: I.doc + '日志', onclick: () => showLogs(t) }),
          ' ',
          el('button', { class: 'btn btn-ghost btn-sm', html: I.video + '回放', onclick: () => openVideo(taskId) }),
          ' ',
          sc === 5
            ? el('button', { class: 'btn btn-danger btn-sm', onclick: () => stopTask(t) }, '停止')
            : el('button', { class: 'btn btn-ghost btn-sm', html: I.play + '重跑', onclick: () => rerun(t) }),
        )
      ));
    });
    tbl.appendChild(tbody);
    listWrap.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
    stagger(listWrap);
    listWrap.appendChild(renderPager({
      curPage, total, pageSize,
      onPage: (p) => { curPage = p; renderList(); },
      onSize: (s) => { pageSize = s; curPage = 1; renderList(); },
    }));
  }

  async function showLogs(t) {
    const taskId = t.taskId || t.id;
    const pre = el('div', { class: 'mono-block' }, '正在加载日志…');
    modal({ title: `任务日志 — ${t.appName || shortId(taskId)}`, body: pre, wide: true });
    try {
      const r = await api(`/api/tasks/${encodeURIComponent(taskId)}/logs`);
      let text = '';
      const d = r.data || {};
      if (typeof d === 'string') text = d;
      else if (Array.isArray(d)) text = d.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
      else if (Array.isArray(d.logs)) text = d.logs.map((x) => (typeof x === 'string' ? x : (x.content || x.message || JSON.stringify(x)))).join('\n');
      else if (Array.isArray(d.items)) text = d.items.map((x) => (typeof x === 'string' ? x : (x.content || x.message || JSON.stringify(x)))).join('\n');
      else text = JSON.stringify(d, null, 2);
      pre.textContent = text || '（无日志）';
      pre.scrollTop = pre.scrollHeight;
    } catch (e) { pre.textContent = '日志加载失败: ' + e.message; }
  }

  async function openVideo(taskId) {
    try {
      const r = await api(`/api/tasks/${encodeURIComponent(taskId)}/video`);
      if (r.ok && r.count > 0) {
        await api(`/api/tasks/${encodeURIComponent(taskId)}/video/open`);
        toast(`已打开视频回放（${r.files[0].name}）`, 'ok');
      } else {
        toast('该任务没有视频回放文件', 'info');
      }
    } catch (e) { toast('打开回放失败: ' + e.message, 'fail'); }
  }

  async function stopTask(t) {
    const taskId = t.taskId || t.id;
    const ok = await confirmModal('停止任务', `确定要停止任务「${t.appName || shortId(taskId)}」吗？`, { danger: true, okText: '停止' });
    if (!ok) return;
    try {
      await cli(['console', 'task', 'stop', '--task-id', taskId, '--reason', '控制台手动停止']);
      toast('已发送停止指令', 'ok');
      setTimeout(load, 1500);
    } catch (e) { toast('停止失败: ' + e.message, 'fail'); }
  }

  async function rerun(t) {
    const ok = await confirmModal('重新运行', `确定要重新运行「${t.appName}」吗？`, { okText: '运行' });
    if (!ok) return;
    try {
      await cli(['console', 'task', 'run', '--app-id', t.appId, '--async']);
      toast(`「${t.appName}」已重新启动`, 'ok');
    } catch (e) { toast('重跑失败: ' + e.message, 'fail'); }
  }

  buildTabs();
  load();
}

/* ============================================================
 * 触发器管理
 * ============================================================ */
async function renderTriggers(page) {
  let type = 'all';
  let tabs, listWrap;
  page.appendChild(tabs = el('div', { class: 'tabs' }));
  page.appendChild(listWrap = el('div', {}));

  function buildTabs() {
    tabs.innerHTML = '';
    [['all', '全部'], ['schedule', '定时'], ['email', '邮件'], ['file', '文件夹'], ['hotkey', '热键']].forEach(([code, name]) => {
      tabs.appendChild(el('div', { class: 'tab' + (type === code ? ' active' : ''), onclick: () => { type = code; buildTabs(); load(); } }, name));
    });
    tabs.appendChild(el('div', { style: 'flex:1' }));
    tabs.appendChild(el('button', { class: 'btn btn-primary btn-sm', onclick: addTriggerModal }, '+ 新增触发器'));
    tabs.appendChild(el('button', { class: 'btn btn-ghost btn-sm', html: I.refresh + '刷新', style: 'margin-left:8px', onclick: load }));
  }

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonRows(5));
    try {
      const r = await cli(['console', 'trigger', 'list', '--type', type]);
      const items = (r.data && r.data.items) || [];
      listWrap.innerHTML = '';
      if (!items.length) { listWrap.appendChild(emptyState('没有触发器', '⏰')); return; }

      const tbl = el('table', { class: 'tbl' },
        el('thead', {}, el('tr', {},
          el('th', {}, '触发器'), el('th', {}, '类型'), el('th', {}, '目标应用'),
          el('th', {}, '触发条件'), el('th', {}, '更新时间'), el('th', {}, '启用'), el('th', { style: 'text-align:right' }, '操作'))));
      const tbody = el('tbody');
      items.forEach((t) => {
        const tt = TRIGGER_TYPE[t.triggerType] || { name: t.triggerType, cls: 'cancel' };
        let cond = '-';
        if (t.triggerType === 'schedule' && t.details) cond = cronDescribe(t.details.cron) || t.details.cron;
        else if (t.triggerType === 'hotkey' && t.details) cond = hotkeyDescribe(t.details.modifierKeys, t.details.virtualKey);
        else if ((t.triggerType === 'file' || t.triggerType === 'folder') && t.details) cond = t.details.folderPath || t.details.FolderPath || '-';
        else if (t.details) cond = t.details.email || t.details.userName || JSON.stringify(t.details).slice(0, 40);
        const sw = el('label', { class: 'switch' },
          el('input', { type: 'checkbox', ...(t.enabled ? { checked: '' } : {}), onchange: (e) => toggleTrigger(t, e.target.checked) }),
          el('span', { class: 'track' }), el('span', { class: 'knob' }));
        tbody.appendChild(el('tr', { class: 'fade-item' },
          el('td', { class: 'name-cell' }, t.name || '-'),
          el('td', {}, el('span', { class: 'badge ' + tt.cls }, tt.name)),
          el('td', {}, t.appName || '-', el('span', { class: 'sub' }, shortId(t.appId))),
          el('td', { class: 'mono', style: 'font-size:12px' }, cond),
          el('td', { class: 'mono' }, fmtTime(t.modifyTime || t.createTime)),
          el('td', {}, sw),
          el('td', { style: 'text-align:right' },
            el('button', { class: 'btn btn-ghost btn-sm', html: I.edit + '编辑', onclick: () => editTrigger(t) }),
            el('button', { class: 'btn btn-danger btn-sm', style: 'margin-left:6px', html: I.trash + '删除', onclick: () => delTrigger(t) }))
        ));
      });
      tbl.appendChild(tbody);
      listWrap.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
      stagger(listWrap);
    } catch (e) {
      listWrap.innerHTML = '';
      listWrap.appendChild(el('div', { class: 'empty' }, el('p', { style: 'color:var(--danger)' }, '加载失败: ' + e.message)));
    }
  }

  async function toggleTrigger(t, enable) {
    try {
      await cli(['console', 'trigger', enable ? 'enable' : 'disable', '--id', t.id]);
      toast(`「${t.name}」已${enable ? '启用' : '禁用'}`, 'ok');
    } catch (e) { toast('操作失败: ' + e.message, 'fail'); load(); }
  }

  async function delTrigger(t) {
    const ok = await confirmModal('删除触发器', `确定要删除触发器「${t.name}」吗？此操作不可恢复。`, { danger: true, okText: '删除' });
    if (!ok) return;
    try {
      await cli(['console', 'trigger', 'delete', '--id', t.id]);
      toast(`「${t.name}」已删除`, 'ok');
      load();
    } catch (e) { toast('删除失败: ' + e.message, 'fail'); }
  }

  // 文件触发结构化表单（TriggerType=folder）：返回 { node, toDetails() }
  function fileForm(values = {}) {
    const field = (label, input, required) => el('div', {},
      el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, label + (required ? ' *' : '')), input);
    const folderPathInp = el('input', { class: 'input', style: 'width:100%', placeholder: '如 D:\\抖店\\测试', value: values.folderPath || values.FolderPath || '' });
    const filesInp = el('input', { class: 'input', style: 'width:100%', placeholder: '如 *.txt 或 *.xlsx', value: values.filesToMonitor || values.FilesToMonitor || '' });
    const subCk = el('input', { type: 'checkbox', ...(values.includeSubFolders || values.IncludeSubFolders ? { checked: '' } : {}) });
    // 文件事件：多选 checkbox（位掩码）
    const evMask = values.fileEventsToMonitor || values.FileEventsToMonitor || 0;
    const evBoxes = FILE_EVENTS.map(ev => {
      const ck = el('input', { type: 'checkbox', value: String(ev.value), ...((evMask & ev.value) === ev.value ? { checked: '' } : {}) });
      return el('label', { class: 'check', style: 'margin-right:16px' }, ck, ev.label);
    });
    const evRow = el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, ...evBoxes);

    const node = el('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      field('监控文件夹', folderPathInp, true),
      field('监控文件类型', filesInp, true),
      el('div', {}, el('label', { class: 'check' }, subCk, '包含子文件夹')),
      el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '触发事件（可多选）'), evRow),
    );

    function toDetails() {
      let mask = 0;
      evBoxes.forEach((lbl) => { const ck = lbl.querySelector('input'); if (ck.checked) mask |= parseInt(ck.value, 10); });
      return {
        folderPath: folderPathInp.value.trim(),
        filesToMonitor: filesInp.value.trim(),
        includeSubFolders: subCk.checked,
        fileEventsToMonitor: mask,
      };
    }
    return { node, toDetails, validate: () => folderPathInp.value.trim() && filesInp.value.trim() };
  }

  // 热键触发结构化表单：返回 { node, toDetails() }
  function hotkeyForm(values = {}) {
    const field = (label, input, required) => el('div', {},
      el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, label + (required ? ' *' : '')), input);
    const modMask = values.modifierKeys || values.ModifierKeys || 0;
    const modBoxes = HOTKEY_MODIFIERS.map(m => {
      const ck = el('input', { type: 'checkbox', value: String(m.value), ...((modMask & m.value) === m.value ? { checked: '' } : {}) });
      return el('label', { class: 'check', style: 'margin-right:16px' }, ck, m.label);
    });
    const modRow = el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, ...modBoxes);
    // 键位：常用键下拉 + 自定义虚拟键码
    const curVk = values.virtualKey || values.VirtualKey || 0;
    const keyOpts = Object.entries(VK_NAMES).map(([code, name]) => el('option', { value: code }, name));
    const keySel = el('select', { class: 'select', style: 'width:100%' },
      el('option', { value: '' }, '— 选择按键 —'), ...keyOpts);
    if (curVk) keySel.value = String(curVk);
    const vkInp = el('input', { class: 'input', style: 'width:100%', type: 'number', placeholder: '虚拟键码，如 65=A（可选，优先下拉选择）', value: curVk || '' });
    keySel.onchange = () => { if (keySel.value) vkInp.value = keySel.value; };
    const preview = el('div', { style: 'font-size:12px;color:var(--muted);margin-top:6px' }, '');
    function upd() {
      let vk = parseInt(vkInp.value, 10);
      let mask = 0;
      modBoxes.forEach((lbl) => { const ck = lbl.querySelector('input'); if (ck.checked) mask |= parseInt(ck.value, 10); });
      if (!isNaN(vk)) preview.textContent = '当前：' + hotkeyDescribe(mask, vk);
      else preview.textContent = '';
    }
    modBoxes.forEach(lbl => lbl.querySelector('input').addEventListener('change', upd));
    vkInp.addEventListener('input', upd);
    upd();

    const node = el('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '修饰键（可多选）'), modRow),
      el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '按键'), keySel, vkInp, preview),
    );

    function toDetails() {
      let mask = 0;
      modBoxes.forEach((lbl) => { const ck = lbl.querySelector('input'); if (ck.checked) mask |= parseInt(ck.value, 10); });
      const vk = parseInt(vkInp.value, 10);
      return { modifierKeys: mask, virtualKey: isNaN(vk) ? 0 : vk };
    }
    return { node, toDetails, validate: () => parseInt(vkInp.value, 10) > 0 };
  }

  // 邮件触发器结构化表单：返回 { node, toDetails() }
  function emailForm(values = {}) {
    const field = (label, input, required) => el('div', {},
      el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, label + (required ? ' *' : '')), input);
    const userNameInp = el('input', { class: 'input', style: 'width:100%', placeholder: '如 zhangsan@163.com', value: values.userName || '' });
    const protocolSel = el('select', { class: 'select', style: 'width:100%' },
      el('option', { value: 'imap' }, 'IMAP'),
      el('option', { value: 'exchange' }, 'Exchange'),
      el('option', { value: 'pop3' }, 'POP3'),
    );
    protocolSel.value = values.protocol || 'imap';
    const ipInp = el('input', { class: 'input', style: 'width:100%', placeholder: '如 imap.163.com', value: values.ip || '' });
    const portInp = el('input', { class: 'input', style: 'width:100%', type: 'number', placeholder: '如 993', value: values.port != null ? values.port : 993 });
    const authCodeInp = el('input', { class: 'input', style: 'width:100%', type: 'password', placeholder: 'IMAP 授权码（非邮箱登录密码）', value: values.authCode || '' });
    const useSslCk = el('input', { type: 'checkbox', ...(values.useSsl !== false ? { checked: '' } : {}) });
    const folderInp = el('input', { class: 'input', style: 'width:100%', placeholder: '如 INBOX（可选）', value: values.folderName || '' });
    const receiverInp = el('input', { class: 'input', style: 'width:100%', placeholder: '收件人包含关键词（可选）', value: values.receiverContains || '' });
    const senderInp = el('input', { class: 'input', style: 'width:100%', placeholder: '发件人包含关键词（可选）', value: values.senderContains || '' });
    const topicInp = el('input', { class: 'input', style: 'width:100%', placeholder: '主题包含关键词（可选）', value: values.topicContains || '' });
    const contentInp = el('input', { class: 'input', style: 'width:100%', placeholder: '正文包含关键词（可选）', value: values.contentContains || '' });

    const node = el('div', { style: 'display:flex;flex-direction:column;gap:12px' },
      field('邮箱账号', userNameInp, true),
      field('协议类型', protocolSel, true),
      field('IMAP 服务器地址', ipInp, true),
      field('端口', portInp, false),
      field('授权码', authCodeInp, true),
      el('div', {}, el('label', { class: 'check' }, useSslCk, '启用 SSL')),
      field('邮箱文件夹', folderInp, false),
      field('收件人包含', receiverInp, false),
      field('发件人包含', senderInp, false),
      field('主题包含', topicInp, false),
      field('正文包含', contentInp, false),
    );

    function toDetails() {
      const d = {
        userName: userNameInp.value.trim(),
        authCode: authCodeInp.value.trim(),
        ip: ipInp.value.trim(),
        protocol: protocolSel.value,
        useSsl: useSslCk.checked,
      };
      const pv = parseInt(portInp.value, 10);
      if (!isNaN(pv)) d.port = pv;
      if (folderInp.value.trim()) d.folderName = folderInp.value.trim();
      if (receiverInp.value.trim()) d.receiverContains = receiverInp.value.trim();
      if (senderInp.value.trim()) d.senderContains = senderInp.value.trim();
      if (topicInp.value.trim()) d.topicContains = topicInp.value.trim();
      if (contentInp.value.trim()) d.contentContains = contentInp.value.trim();
      return d;
    }
    return { node, toDetails };
  }

  async function addTriggerModal() {
    const appSel = el('select', { class: 'select', style: 'width:100%' }, el('option', {}, '加载应用中…'));
    const nameInp = el('input', { class: 'input', style: 'width:100%', placeholder: '触发器名称' });
    const queueCk = el('input', { type: 'checkbox' });
    const enabledCk = el('input', { type: 'checkbox', checked: '' });
    const timeoutInp = el('input', { class: 'input', style: 'width:100%', type: 'number', placeholder: '秒（可选）' });

    // 类型专属字段容器（动态渲染）
    const typeFields = el('div', { style: 'display:flex;flex-direction:column;gap:12px' });

    let curType = 'schedule';
    let emailF = null, fileF = null, hotkeyF = null; // 各类型表单实例
    function renderTypeFields() {
      typeFields.innerHTML = '';
      emailF = fileF = hotkeyF = null;
      if (curType === 'schedule') {
        const cronInp = el('input', { class: 'input', style: 'width:100%', placeholder: '0 9 * * *', value: '0 9 * * *' });
        const cronHint = el('div', { style: 'font-size:12px;color:var(--muted);margin-top:6px' }, '每天 09:00');
        cronInp.addEventListener('input', () => { cronHint.textContent = cronDescribe(cronInp.value) || cronInp.value; });
        typeFields.appendChild(el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, 'Cron 表达式'), cronInp, cronHint));
      } else if (curType === 'email') {
        emailF = emailForm();
        typeFields.appendChild(emailF.node);
      } else if (curType === 'file') {
        fileF = fileForm();
        typeFields.appendChild(fileF.node);
      } else if (curType === 'hotkey') {
        hotkeyF = hotkeyForm();
        typeFields.appendChild(hotkeyF.node);
      }
    }
    renderTypeFields();

    const typeSel = el('select', { class: 'select', style: 'width:100%' },
      el('option', { value: 'schedule' }, '定时（Cron）'),
      el('option', { value: 'file' }, '文件夹'),
      el('option', { value: 'email' }, '邮件'),
      el('option', { value: 'hotkey' }, '热键'),
    );
    typeSel.value = curType;
    typeSel.onchange = () => { curType = typeSel.value; renderTypeFields(); };

    modal({
      title: '新增触发器',
      body: el('div', { style: 'display:flex;flex-direction:column;gap:14px' },
        el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '触发器类型'), typeSel),
        el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '目标应用'), appSel),
        el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '触发器名称'), nameInp),
        typeFields,
        el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '任务超时（秒，可选）'), timeoutInp),
        el('div', { style: 'display:flex;gap:20px' },
          el('label', { class: 'check' }, queueCk, '忙时排队'),
          el('label', { class: 'check' }, enabledCk, '创建后立即启用')),
      ),
      footer: [
        (() => { const b = el('button', { class: 'btn btn-ghost' }, '取消'); b.onclick = () => document.querySelector('.modal-close').click(); return b; })(),
        (() => {
          const b = el('button', { class: 'btn btn-primary' }, '创建');
          b.onclick = async () => {
            if (!appSel.value) { toast('请选择目标应用', 'fail'); return; }
            if (!nameInp.value) { toast('请填写触发器名称', 'fail'); return; }
            btnLoading(b, true, '创建中…');
            try {
              const args = ['console', 'trigger', curType, 'add', '--app-id', appSel.value, '--name', nameInp.value];
              if (curType === 'schedule') {
                const cronInp = typeFields.querySelector('input.input');
                if (!cronInp || !cronInp.value) { toast('请填写 Cron 表达式', 'fail'); btnLoading(b, false); return; }
                args.push('--cron', cronInp.value);
              } else if (curType === 'email') {
                const d = emailF.toDetails();
                if (!d.userName) { toast('请填写邮箱账号', 'fail'); btnLoading(b, false); return; }
                if (!d.authCode) { toast('请填写授权码', 'fail'); btnLoading(b, false); return; }
                if (!d.ip) { toast('请填写 IMAP 服务器地址', 'fail'); btnLoading(b, false); return; }
                args.push('--details-json', JSON.stringify(d));
              } else if (curType === 'file') {
                const d = fileF.toDetails();
                if (!d.folderPath) { toast('请填写监控文件夹', 'fail'); btnLoading(b, false); return; }
                if (!d.filesToMonitor) { toast('请填写监控文件类型', 'fail'); btnLoading(b, false); return; }
                if (!d.fileEventsToMonitor) { toast('请至少选择一个触发事件', 'fail'); btnLoading(b, false); return; }
                args.push('--details-json', JSON.stringify(d));
              } else if (curType === 'hotkey') {
                const d = hotkeyF.toDetails();
                if (!d.modifierKeys && !d.virtualKey) { toast('请选择按键', 'fail'); btnLoading(b, false); return; }
                if (!d.virtualKey) { toast('请选择按键', 'fail'); btnLoading(b, false); return; }
                args.push('--details-json', JSON.stringify(d));
              }
              if (!enabledCk.checked) args.push('--enabled=false');
              if (queueCk.checked) args.push('--queue-when-busy');
              if (timeoutInp.value) args.push('--timeout', String(timeoutInp.value));
              await cli(args);
              toast('触发器创建成功', 'ok');
              document.querySelector('.modal-close').click();
              load();
            } catch (e) { btnLoading(b, false); toast('创建失败: ' + e.message, 'fail'); }
          };
          return b;
        })(),
      ],
    });

    // 加载应用列表
    try {
      const r = await cli(['console', 'app', '--page', '1', '--page-size', '200']);
      const items = (r.data && r.data.items) || [];
      if (items.length) {
        appSel.innerHTML = '';
        items.forEach((a) => appSel.appendChild(el('option', { value: a.appId }, a.appName)));
      }
    } catch (e) { appSel.innerHTML = ''; appSel.appendChild(el('option', {}, '应用加载失败: ' + e.message)); }
  }

  // 编辑触发器：按类型渲染对应字段，调用 CLI update 命令
  async function editTrigger(t) {
    const type = t.triggerType; // 实际为 schedule/email/folder/hotkey（folder 即文件触发）
    const sub = type === 'folder' ? 'file' : type; // CLI 子命令名
    const d = t.details || {};

    // 应用选择（回填当前应用）
    const appSel = el('select', { class: 'select', style: 'width:100%' },
      el('option', { value: t.appId || '' }, t.appName || '— 选择应用 —'));
    const nameInp = el('input', { class: 'input', style: 'width:100%', placeholder: '触发器名称', value: t.name || '' });
    const queueCk = el('input', { type: 'checkbox', ...(t.queueWhenBusy ? { checked: '' } : {}) });
    const enabledCk = el('input', { type: 'checkbox', ...(t.enabled ? { checked: '' } : {}) });
    const timeoutInp = el('input', { class: 'input', style: 'width:100%', type: 'number', placeholder: '秒（可选）', value: t.timeout || '' });

    // 类型专属字段容器
    const typeFields = el('div', { style: 'display:flex;flex-direction:column;gap:12px' });

    let cronInp, cronHint, emailF, fileF, hotkeyF;
    if (type === 'schedule') {
      cronInp = el('input', { class: 'input', style: 'width:100%', placeholder: '0 9 * * *', value: d.cron || '' });
      cronHint = el('div', { style: 'font-size:12px;color:var(--muted);margin-top:6px' }, cronDescribe(d.cron) || '');
      cronInp.addEventListener('input', () => { cronHint.textContent = cronDescribe(cronInp.value) || cronInp.value; });
      typeFields.appendChild(el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, 'Cron 表达式'), cronInp, cronHint));
    } else if (type === 'email') {
      // 邮件触发器：结构化表单，回填现有值
      emailF = emailForm(d);
      typeFields.appendChild(emailF.node);
    } else if (type === 'folder' || type === 'file') {
      // 文件触发器：结构化表单，回填现有值
      fileF = fileForm(d);
      typeFields.appendChild(fileF.node);
    } else if (type === 'hotkey') {
      // 热键触发器：结构化表单，回填现有值
      hotkeyF = hotkeyForm(d);
      typeFields.appendChild(hotkeyF.node);
    }

    modal({
      title: '编辑触发器',
      body: el('div', { style: 'display:flex;flex-direction:column;gap:14px' },
        el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '目标应用'), appSel),
        el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '触发器名称'), nameInp),
        typeFields,
        el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:6px' }, '任务超时（秒，可选）'), timeoutInp),
        el('div', { style: 'display:flex;gap:20px' },
          el('label', { class: 'check' }, queueCk, '忙时排队'),
          el('label', { class: 'check' }, enabledCk, '启用')),
      ),
      footer: [
        (() => { const b = el('button', { class: 'btn btn-ghost' }, '取消'); b.onclick = () => document.querySelector('.modal-close').click(); return b; })(),
        (() => {
          const b = el('button', { class: 'btn btn-primary' }, '保存');
          b.onclick = async () => {
            if (!nameInp.value) { toast('请填写触发器名称', 'fail'); return; }
            btnLoading(b, true, '保存中…');
            try {
              const args = ['console', 'trigger', sub, 'update', '--id', t.id, '--name', nameInp.value];
              if (appSel.value) args.push('--app-id', appSel.value);
              if (type === 'schedule') {
                if (!cronInp.value) { toast('请填写 Cron 表达式', 'fail'); btnLoading(b, false); return; }
                args.push('--cron', cronInp.value);
              } else if (type === 'email') {
                const dd = emailF.toDetails();
                if (!dd.userName) { toast('请填写邮箱账号', 'fail'); btnLoading(b, false); return; }
                if (!dd.authCode) { toast('请填写授权码', 'fail'); btnLoading(b, false); return; }
                if (!dd.ip) { toast('请填写 IMAP 服务器地址', 'fail'); btnLoading(b, false); return; }
                args.push('--details-json', JSON.stringify(dd));
              } else if (type === 'folder' || type === 'file') {
                const dd = fileF.toDetails();
                if (!dd.folderPath) { toast('请填写监控文件夹', 'fail'); btnLoading(b, false); return; }
                if (!dd.filesToMonitor) { toast('请填写监控文件类型', 'fail'); btnLoading(b, false); return; }
                if (!dd.fileEventsToMonitor) { toast('请至少选择一个触发事件', 'fail'); btnLoading(b, false); return; }
                args.push('--details-json', JSON.stringify(dd));
              } else if (type === 'hotkey') {
                const dd = hotkeyF.toDetails();
                if (!dd.virtualKey) { toast('请选择按键', 'fail'); btnLoading(b, false); return; }
                args.push('--details-json', JSON.stringify(dd));
              }
              if (queueCk.checked) args.push('--queue-when-busy');
              args.push('--enabled=' + (enabledCk.checked ? 'true' : 'false'));
              if (timeoutInp.value) args.push('--timeout', String(timeoutInp.value));
              await cli(args);
              toast('触发器已更新', 'ok');
              document.querySelector('.modal-close').click();
              load();
            } catch (e) { btnLoading(b, false); toast('更新失败: ' + e.message, 'fail'); }
          };
          return b;
        })(),
      ],
    });

    // 异步加载应用列表填充下拉
    try {
      const r = await cli(['console', 'app', '--page', '1', '--page-size', '200']);
      const items = (r.data && r.data.items) || [];
      if (items.length) {
        const curVal = appSel.value;
        appSel.innerHTML = '';
        items.forEach((a) => appSel.appendChild(el('option', { value: a.appId }, a.appName)));
        if (items.some((a) => a.appId === curVal)) appSel.value = curVal;
      }
    } catch (e) { /* 应用列表加载失败不阻塞编辑 */ }
  }

  buildTabs();
  load();
}

/* ============================================================
 * 触发器迁移（向导）
 * ============================================================ */
const Mig = { step: 1, backupFile: null, match: null, assignments: {}, lastExportAccount: null };

function renderMigration(page) {
  const stepsBar = el('div', { class: 'steps' });
  const STEP_NAMES = ['选择备份', '切换账号', '匹配确认', '执行导入'];
  STEP_NAMES.forEach((n, i) => {
    const idx = i + 1;
    stepsBar.appendChild(el('div', { class: 'step' + (idx === Mig.step ? ' active' : idx < Mig.step ? ' done' : '') },
      el('div', { class: 's-dot' }, idx < Mig.step ? '✓' : idx),
      el('div', { class: 's-label' }, n)));
  });
  const body = el('div', {});
  page.appendChild(stepsBar);
  page.appendChild(body);

  if (Mig.step === 1) renderStep1(body);
  else if (Mig.step === 2) renderStep2(body);
  else if (Mig.step === 3) renderStep3(body);
  else renderStep4(body);
}

/* ---- 步骤 1：选择/导出备份 ---- */
async function renderStep1(body) {
  body.innerHTML = '';
  const card = el('div', { class: 'card fade-item' });
  body.appendChild(card);
  card.appendChild(el('div', { class: 'card-title' }, '第一步：准备源账号的触发器备份', el('span', { class: 'hint' }, '导出当前登录账号的全部触发器，或上传已有备份文件')));

  // 当前账号
  const accBox = el('div', { class: 'info-banner mb16', style: 'display:none' });
  card.appendChild(accBox);
  cli(['auth', 'current']).then((r) => {
    const d = r.data || {};
    if (d.loggedIn) {
      accBox.style.display = 'flex';
      accBox.appendChild(el('span', {}, `ℹ 当前登录账号：${d.displayName || d.userName}（${d.userName}）。点击导出将备份该账号的全部触发器。`));
      Mig.lastExportAccount = d.userName;
    }
  }).catch(() => {});

  // 操作按钮
  const btnRow = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px' });
  const exportBtn = el('button', { class: 'btn btn-primary', html: I.download + '导出当前账号触发器' });
  exportBtn.onclick = async () => {
    btnLoading(exportBtn, true, '导出中…');
    try {
      const r = await api('/api/migration/export', { method: 'POST' });
      if (!r.ok) throw new Error(r.error || '导出失败');
      Mig.backupFile = r.file;
      toast(`已导出 ${r.count} 个触发器 → ${r.file}`, 'ok');
      loadBackups();
    } catch (e) { toast('导出失败: ' + e.message, 'fail'); }
    btnLoading(exportBtn, false);
  };
  const uploadBtn = el('button', { class: 'btn btn-ghost', html: I.upload + '上传备份文件' });
  const fileInp = el('input', { type: 'file', accept: '.json', style: 'display:none' });
  uploadBtn.onclick = () => fileInp.click();
  fileInp.onchange = async () => {
    const f = fileInp.files[0];
    if (!f) return;
    btnLoading(uploadBtn, true, '上传中…');
    try {
      const content = await f.text();
      const r = await api('/api/migration/backups/upload', { method: 'POST', body: JSON.stringify({ content, name: f.name }) });
      if (!r.ok) throw new Error(r.error || '上传失败');
      Mig.backupFile = r.file;
      toast(`备份已上传（${r.count} 个触发器）`, 'ok');
      loadBackups();
    } catch (e) { toast('上传失败: ' + e.message, 'fail'); }
    btnLoading(uploadBtn, false);
    fileInp.value = '';
  };
  btnRow.appendChild(exportBtn);
  btnRow.appendChild(uploadBtn);
  btnRow.appendChild(fileInp);
  card.appendChild(btnRow);

  // 备份列表
  const listBox = el('div', {});
  card.appendChild(listBox);
  async function loadBackups() {
    listBox.innerHTML = '';
    listBox.appendChild(skeletonRows(3, 3));
    try {
      const r = await api('/api/migration/backups');
      listBox.innerHTML = '';
      const files = r.files || [];
      if (!files.length) {
        listBox.appendChild(el('div', { class: 'empty', style: 'padding:24px' }, el('p', {}, '暂无备份文件，请先导出或上传')));
        return;
      }
      files.forEach((f) => {
        const radio = el('input', { type: 'radio', name: 'bk', style: 'accent-color:var(--accent)', ...(Mig.backupFile === f.name ? { checked: '' } : {}), onchange: () => { Mig.backupFile = f.name; } });
        const label = el('label', { class: 'acc-item fade-item', style: 'cursor:pointer;flex:1;min-width:0' },
          el('div', { style: 'display:flex;align-items:center;gap:10px;min-width:0' },
            radio,
            el('div', { style: 'min-width:0' },
              el('div', { style: 'font-size:13px;font-weight:500;word-break:break-all' }, f.name),
              el('div', { style: 'font-size:11.5px;color:var(--faint);margin-top:2px' }, `${fmtTime(f.mtime)} · ${fmtBytes(f.size)}`))),
        );
        const delBtn = el('button', { class: 'btn btn-danger btn-sm', style: 'flex-shrink:0', html: I.trash + '删除', onclick: async (e) => { e.stopPropagation(); await deleteBackup(f.name); } });
        listBox.appendChild(el('div', { class: 'fade-item', style: 'display:flex;align-items:center;gap:8px' }, label, delBtn));
      });
      stagger(listBox);
    } catch (e) { listBox.innerHTML = ''; listBox.appendChild(el('p', { style: 'color:var(--danger);font-size:13px' }, '备份列表加载失败: ' + e.message)); }
  }

  // 删除备份文件
  async function deleteBackup(name) {
    const ok = await confirmModal('删除备份', `确定要删除备份文件「${name}」吗？此操作不可恢复。`, { danger: true, okText: '删除' });
    if (!ok) return;
    try {
      const r = await api('/api/migration/backups/delete', { method: 'POST', body: JSON.stringify({ file: name }) });
      if (!r.ok) throw new Error(r.error || '删除失败');
      if (Mig.backupFile === name) Mig.backupFile = null;
      toast(`备份「${name}」已删除`, 'ok');
      loadBackups();
    } catch (e) { toast('删除失败: ' + e.message, 'fail'); }
  }

  loadBackups();

  // 下一步
  const nextBtn = el('button', { class: 'btn btn-primary mt16' }, '下一步：切换账号 →');
  nextBtn.onclick = () => { if (!Mig.backupFile) { toast('请先选择一个备份文件', 'fail'); return; } Mig.step = 2; navigate('migration'); };
  card.appendChild(nextBtn);
}

/* ---- 步骤 2：切换到目标账号 ---- */
async function renderStep2(body) {
  body.innerHTML = '';
  const card = el('div', { class: 'card fade-item' });
  body.appendChild(card);
  card.appendChild(el('div', { class: 'card-title' }, '第二步：切换到目标账号', el('span', { class: 'hint' }, '备份将导入到「当前登录」的账号，请先切换')));

  const curBox = el('div', { class: 'loading-center', style: 'padding:24px' }, el('div', { class: 'spinner-lg' }), '获取当前账号…');
  card.appendChild(curBox);

  const accListBox = el('div', { class: 'mt16' });
  card.appendChild(el('div', { style: 'font-size:12.5px;color:var(--muted);margin:14px 0 10px' }, '记住的账号（点击切换，免密登录）：'));
  card.appendChild(accListBox);

  const btnRow = el('div', { style: 'display:flex;gap:10px;margin-top:16px' });
  const refreshBtn = el('button', { class: 'btn btn-ghost', html: I.refresh + '我已切换，刷新' });
  refreshBtn.onclick = async () => { btnLoading(refreshBtn, true, '刷新中…'); await refreshAccount(); loadCur(); btnLoading(refreshBtn, false); };
  const backBtn = el('button', { class: 'btn btn-ghost' }, '← 上一步');
  backBtn.onclick = () => { Mig.step = 1; navigate('migration'); };
  const nextBtn = el('button', { class: 'btn btn-primary' }, '下一步：开始匹配 →');
  nextBtn.onclick = async () => {
    btnLoading(nextBtn, true, '匹配中…');
    try {
      const r = await api('/api/migration/match', { method: 'POST', body: JSON.stringify({ file: Mig.backupFile }) });
      if (!r.ok) throw new Error(r.error || '匹配失败');
      Mig.match = r;
      Mig.assignments = {};
      r.matched.forEach((m) => { Mig.assignments[m.triggerId] = m.targetAppId; });
      Mig.step = 3;
      navigate('migration');
    } catch (e) { btnLoading(nextBtn, false); toast('匹配失败: ' + e.message, 'fail'); }
  };
  btnRow.appendChild(backBtn);
  btnRow.appendChild(refreshBtn);
  btnRow.appendChild(el('div', { style: 'flex:1' }));
  btnRow.appendChild(nextBtn);
  card.appendChild(btnRow);

  async function loadCur() {
    curBox.innerHTML = '';
    curBox.style.padding = '14px';
    if (App.account) {
      curBox.appendChild(el('div', { class: 'info-banner' },
        `ℹ 当前登录账号：${App.account.displayName || ''}（${App.account.userName}）。触发器将导入此账号。`));
    } else {
      curBox.appendChild(el('div', { class: 'warn-banner' }, '⚠ 无法获取当前账号，请确认影刀客户端已登录。'));
    }
  }
  await refreshAccount();
  loadCur();

  // 记住的账号列表
  try {
    const r = await cli(['auth', 'account', 'list']);
    const list = (r.data && (r.data.items || r.data.accounts || r.data)) || [];
    accListBox.innerHTML = '';
    const accounts = Array.isArray(list) ? list : [];
    if (!accounts.length) accListBox.appendChild(el('p', { style: 'font-size:12.5px;color:var(--faint)' }, '（没有记住的账号，请在影刀客户端手动切换）'));
    accounts.forEach((a) => {
      const uname = a.userName || a.username || a.name || String(a);
      const isCur = App.account && App.account.userName === uname;
      const item = el('div', { class: 'acc-item fade-item' + (isCur ? ' current' : '') },
        el('div', {}, el('div', { style: 'font-size:13px;font-weight:500' }, uname), isCur ? el('span', { class: 'badge ok plain', style: 'font-size:10.5px' }, '当前') : null),
        isCur ? null : el('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => {
          const ok = await confirmModal('切换账号', `确定要切换到账号「${uname}」吗？将切换本机影刀客户端的登录状态（免密登录）。`, { okText: '切换' });
          if (!ok) return;
          btnLoading(e.target, true, '切换中…');
          try {
            await api('/api/auth/switch', { method: 'POST', body: JSON.stringify({ username: uname }) });
            toast('账号已切换', 'ok');
            await refreshAccount();
            loadCur();
            renderStep2(body);
          } catch (err) { toast('切换失败: ' + err.message, 'fail'); }
        } }, '切换'),
      );
      accListBox.appendChild(item);
    });
    stagger(accListBox);
  } catch (e) {
    accListBox.appendChild(el('p', { style: 'font-size:12.5px;color:var(--faint)' }, '账号列表获取失败: ' + e.message));
  }
}

/* ---- 步骤 3：匹配确认 ---- */
function renderStep3(body) {
  body.innerHTML = '';
  const m = Mig.match;
  if (!m) { Mig.step = 1; renderMigration($('#page')); return; }

  // 汇总
  const sum = el('div', { class: 'stat-grid mb16' });
  [['备份总数', m.summary.total, 'var(--muted)'], ['自动匹配', m.summary.matched, 'var(--ok)'],
   ['需人工确认', m.summary.ambiguous, 'var(--warn)'], ['未匹配', m.summary.missing, 'var(--danger)'],
   ['目标已存在', m.summary.duplicate, 'var(--faint)']].forEach(([label, v, c]) => {
    sum.appendChild(el('div', { class: 'card stat-card fade-item', style: 'padding:14px 16px' },
      el('div', { class: 'stat-num', style: `font-size:22px;color:${c}` }, String(v)),
      el('div', { class: 'stat-label' }, label)));
  });
  body.appendChild(stagger(sum));

  if (m.sameAccount) {
    body.appendChild(el('div', { class: 'warn-banner mb16' }, `⚠ 备份来源账号与当前登录账号相同（${m.sourceAccount ? m.sourceAccount.userName : ''}）。如果这不是有意为之，请返回上一步切换账号，否则会在同一账号上重复创建触发器。`));
  }
  body.appendChild(el('div', { class: 'info-banner mb16' }, `ℹ 备份来源：${m.sourceAccount ? m.sourceAccount.displayName + '（' + m.sourceAccount.userName + '）' : '未知'} · 导入目标：${m.targetAccount ? m.targetAccount.displayName + '（' + m.targetAccount.userName + '）' : '当前账号'} · 目标账号应用数：${m.summary.targetAppCount}`));

  // 自动匹配
  if (m.matched.length) {
    const card = el('div', { class: 'card mb16 fade-item' });
    card.appendChild(el('div', { class: 'card-title' }, `✅ 自动匹配（${m.matched.length}）`, el('span', { class: 'hint' }, '按应用名称精确匹配，将自动映射 appId')));
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '触发器'), el('th', {}, '类型'), el('th', {}, '源应用 → 目标应用'), el('th', {}, '条件'))));
    const tb = el('tbody');
    m.matched.forEach((t) => {
      const tt = TRIGGER_TYPE[t.type] || { name: t.type, cls: 'cancel' };
      tb.appendChild(el('tr', {},
        el('td', { class: 'name-cell' }, t.name),
        el('td', {}, el('span', { class: 'badge ' + tt.cls }, tt.name)),
        el('td', {}, el('span', { class: 'mono', style: 'font-size:12px' }, t.sourceAppName + ' → ' + t.targetAppName)),
        el('td', { class: 'mono', style: 'font-size:12px' }, (() => {
          if (t.type === 'schedule') return cronDescribe(t.details && t.details.cron) || '';
          if (t.type === 'hotkey') return hotkeyDescribe(t.details && t.details.modifierKeys, t.details && t.details.virtualKey);
          if (t.type === 'file' || t.type === 'folder') return (t.details && (t.details.folderPath || t.details.FolderPath)) || '';
          return '';
        })()),
      ));
    });
    tbl.appendChild(tb);
    card.appendChild(el('div', { class: 'tbl-wrap', style: 'border:none' }, tbl));
    body.appendChild(card);
  }

  // 需人工确认（目标重名）
  if (m.ambiguous.length) {
    const card = el('div', { class: 'card mb16 fade-item', style: 'border-color:rgba(251,191,36,.3)' });
    card.appendChild(el('div', { class: 'card-title' }, `⚠️ 需人工确认（${m.ambiguous.length}）`, el('span', { class: 'hint' }, '目标账号存在同名应用，请选择正确的目标')));
    m.ambiguous.forEach((t) => {
      const sel = el('select', { class: 'select', style: 'width:100%;max-width:420px' },
        el('option', { value: '' }, '— 请选择目标应用 —'),
        ...t.candidates.map((c) => el('option', { value: c.appId }, `${c.appName}（更新于 ${fmtTime(c.updateTime)}）`)));
      sel.value = Mig.assignments[t.triggerId] || '';
      sel.onchange = () => { Mig.assignments[t.triggerId] = sel.value || null; };
      card.appendChild(el('div', { class: 'acc-item' },
        el('div', {}, el('div', { style: 'font-size:13px;font-weight:500' }, t.name),
          el('div', { style: 'font-size:11.5px;color:var(--faint)' }, `源应用：${t.sourceAppName}`)),
        sel));
    });
    body.appendChild(card);
  }

  // 未匹配
  if (m.missing.length) {
    const card = el('div', { class: 'card mb16 fade-item', style: 'border-color:rgba(248,113,113,.3)' });
    card.appendChild(el('div', { class: 'card-title' }, `❌ 未匹配（${m.missing.length}）`, el('span', { class: 'hint' }, '目标账号没有同名应用，请手动指定或保持跳过')));
    m.missing.forEach((t) => {
      const sel = el('select', { class: 'select', style: 'width:100%;max-width:420px' },
        el('option', { value: '' }, '— 跳过此触发器 —'),
        ...t.allApps.map((a) => el('option', { value: a.appId }, a.appName)));
      sel.value = Mig.assignments[t.triggerId] || '';
      sel.onchange = () => { Mig.assignments[t.triggerId] = sel.value || null; };
      card.appendChild(el('div', { class: 'acc-item' },
        el('div', {}, el('div', { style: 'font-size:13px;font-weight:500' }, t.name),
          el('div', { style: 'font-size:11.5px;color:var(--faint)' }, `源应用：${t.sourceAppName}`)),
        sel));
    });
    body.appendChild(card);
  }

  // 重复
  if (m.duplicate.length) {
    const card = el('div', { class: 'card mb16 fade-item' });
    card.appendChild(el('div', { class: 'card-title' }, `⏭️ 目标已存在同名触发器（${m.duplicate.length}）`, el('span', { class: 'hint' }, '默认跳过，避免重复创建')));
    m.duplicate.forEach((t) => {
      card.appendChild(el('div', { class: 'acc-item', style: 'opacity:.65' },
        el('div', {}, el('div', { style: 'font-size:13px' }, t.name),
          el('div', { style: 'font-size:11.5px;color:var(--faint)' }, `${t.sourceAppName} · ${t.type}`)),
        el('span', { class: 'badge cancel' }, '跳过')));
    });
    body.appendChild(card);
  }

  // 按钮
  const assignedCount = Object.values(Mig.assignments).filter(Boolean).length;
  const btnRow = el('div', { style: 'display:flex;gap:10px' });
  const backBtn = el('button', { class: 'btn btn-ghost' }, '← 上一步');
  backBtn.onclick = () => { Mig.step = 2; navigate('migration'); };
  const nextBtn = el('button', { class: 'btn btn-primary' }, `生成导入预览（${assignedCount} 条）→`);
  nextBtn.onclick = () => { Mig.step = 4; navigate('migration'); };
  btnRow.appendChild(backBtn);
  btnRow.appendChild(el('div', { style: 'flex:1' }));
  btnRow.appendChild(nextBtn);
  body.appendChild(btnRow);
}

/* ---- 步骤 4：执行导入 ---- */
async function renderStep4(body) {
  body.innerHTML = '';
  const m = Mig.match;
  if (!m) { Mig.step = 1; renderMigration($('#page')); return; }

  const assigned = Object.fromEntries(Object.entries(Mig.assignments).filter(([, v]) => v));
  const emailCount = [...m.matched, ...m.ambiguous, ...m.missing].filter((t) => assigned[t.triggerId] && t.type === 'email').length;

  const card = el('div', { class: 'card fade-item' });
  body.appendChild(card);
  card.appendChild(el('div', { class: 'card-title' }, '第四步：预览并执行导入', el('span', { class: 'hint' }, `共 ${Object.keys(assigned).length} 条待导入`)));

  if (emailCount > 0) {
    card.appendChild(el('div', { class: 'warn-banner mb16' }, `⚠ 本次导入包含 ${emailCount} 个邮件触发器。影刀安全机制导致导出数据不含 IMAP 授权码，导入后需在影刀客户端手动为每个邮件触发器填写授权码。`));
  }

  const resultBox = el('div', {});
  const previewBox = el('div', { class: 'mb16' });
  card.appendChild(previewBox);
  card.appendChild(resultBox);

  // 加载 dry-run 预览
  previewBox.innerHTML = '';
  previewBox.appendChild(skeletonRows(3, 4));
  try {
    const r = await api('/api/migration/import', { method: 'POST', body: JSON.stringify({ file: Mig.backupFile, assignments: assigned, dryRun: true }) });
    if (!r.ok) throw new Error(r.error || '预览生成失败');
    previewBox.innerHTML = '';
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '触发器'), el('th', {}, '类型'), el('th', {}, '将执行的命令'))));
    const tb = el('tbody');
    r.results.filter((x) => x.status !== 'skipped').forEach((x, i) => {
      tb.appendChild(el('tr', { class: 'fade-item' },
        el('td', { class: 'name-cell' }, x.name),
        el('td', {}, el('span', { class: 'badge ' + (TRIGGER_TYPE[x.type] || { cls: 'cancel' }).cls }, (TRIGGER_TYPE[x.type] || { name: x.type }).name)),
        el('td', { class: 'mono', style: 'font-size:11.5px;max-width:460px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, x.command)));
    });
    tbl.appendChild(tb);
    previewBox.appendChild(el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:8px' }, `预览 ${r.summary.total} 条备份 · 待导入 ${r.results.filter((x) => x.status === 'dry-run').length} 条 · 跳过 ${r.summary.skipped} 条`));
    previewBox.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
    stagger(previewBox);
  } catch (e) {
    previewBox.innerHTML = '';
    previewBox.appendChild(el('p', { style: 'color:var(--danger);font-size:13px' }, '预览失败: ' + e.message));
  }

  // 操作按钮
  const btnRow = el('div', { style: 'display:flex;gap:10px' });
  const backBtn = el('button', { class: 'btn btn-ghost' }, '← 上一步');
  backBtn.onclick = () => { Mig.step = 3; navigate('migration'); };
  const goBtn = el('button', { class: 'btn btn-danger', html: I.play + '正式导入' });
  goBtn.onclick = async () => {
    const ok = await confirmModal('正式导入', `将向当前账号创建 ${Object.keys(assigned).length} 个触发器。已存在的同名触发器不会被创建（此前已标记跳过）。确定继续吗？`, { danger: true, okText: '开始导入' });
    if (!ok) return;
    btnLoading(goBtn, true, '正在逐条创建…');
    resultBox.innerHTML = '';
    resultBox.appendChild(el('div', { class: 'loading-center', style: 'padding:30px' }, el('div', { class: 'spinner-lg' }), '正在逐条创建触发器，请勿关闭页面…'));
    try {
      const r = await api('/api/migration/import', { method: 'POST', body: JSON.stringify({ file: Mig.backupFile, assignments: assigned, dryRun: false }) });
      if (!r.ok) throw new Error(r.error || '导入失败');
      resultBox.innerHTML = '';
      // 汇总
      resultBox.appendChild(el('div', { class: 'stat-grid mb16' },
        el('div', { class: 'card fade-item', style: 'padding:14px;text-align:center' }, el('div', { class: 'stat-num', style: 'font-size:24px;color:var(--ok)' }, String(r.summary.ok)), el('div', { class: 'stat-label' }, '成功')),
        el('div', { class: 'card fade-item', style: 'padding:14px;text-align:center' }, el('div', { class: 'stat-num', style: 'font-size:24px;color:var(--danger)' }, String(r.summary.fail)), el('div', { class: 'stat-label' }, '失败')),
        el('div', { class: 'card fade-item', style: 'padding:14px;text-align:center' }, el('div', { class: 'stat-num', style: 'font-size:24px;color:var(--faint)' }, String(r.summary.skipped)), el('div', { class: 'stat-label' }, '跳过')),
      ));
      const tbl = el('table', { class: 'tbl' },
        el('thead', {}, el('tr', {}, el('th', {}, '触发器'), el('th', {}, '类型'), el('th', {}, '结果'), el('th', {}, '详情'))));
      const tb = el('tbody');
      r.results.filter((x) => x.status !== 'skipped').forEach((x) => {
        const stMap = { ok: ['成功', 'ok'], fail: ['失败', 'fail'], 'dry-run': ['预览', 'blue'] };
        const [txt, cls] = stMap[x.status] || [x.status, 'cancel'];
        tb.appendChild(el('tr', { class: 'fade-item' },
          el('td', { class: 'name-cell' }, x.name),
          el('td', {}, (TRIGGER_TYPE[x.type] || { name: x.type }).name),
          el('td', {}, el('span', { class: 'badge ' + cls }, txt)),
          el('td', { style: 'font-size:12px;color:var(--muted)' }, x.message)));
      });
      tbl.appendChild(tb);
      resultBox.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
      stagger(resultBox);
      if (r.summary.fail === 0) toast(`导入完成：${r.summary.ok} 成功`, 'ok');
      else toast(`导入完成：${r.summary.ok} 成功 / ${r.summary.fail} 失败`, 'fail');
    } catch (e) {
      resultBox.innerHTML = '';
      resultBox.appendChild(el('p', { style: 'color:var(--danger)' }, '导入失败: ' + e.message));
      btnLoading(goBtn, false);
      return;
    }
    btnLoading(goBtn, false);
  };
  btnRow.appendChild(backBtn);
  btnRow.appendChild(el('div', { style: 'flex:1' }));
  btnRow.appendChild(goBtn);
  card.appendChild(el('div', { class: 'mt16' }, btnRow));
}

/* ============================================================
 * 分组同步
 * ============================================================ */
const GroupSync = { step: 1, backupFile: null, match: null, onlyGroups: [], lastExportAccount: null };

function renderGroupSync(page) {
  const stepsBar = el('div', { class: 'steps' });
  const STEP_NAMES = ['选择备份', '切换账号', '确认同步', '执行同步'];
  STEP_NAMES.forEach((n, i) => {
    const idx = i + 1;
    stepsBar.appendChild(el('div', { class: 'step' + (idx === GroupSync.step ? ' active' : idx < GroupSync.step ? ' done' : '') },
      el('div', { class: 's-dot' }, idx < GroupSync.step ? '✓' : idx),
      el('div', { class: 's-label' }, n)));
  });
  const body = el('div', {});
  page.appendChild(stepsBar);
  page.appendChild(body);

  if (GroupSync.step === 1) renderGS1(body);
  else if (GroupSync.step === 2) renderGS2(body);
  else if (GroupSync.step === 3) renderGS3(body);
  else renderGS4(body);
}

/* ---- 步骤 1：选择/导出分组备份 ---- */
async function renderGS1(body) {
  body.innerHTML = '';
  const card = el('div', { class: 'card fade-item' });
  body.appendChild(card);
  card.appendChild(el('div', { class: 'card-title' }, '第一步：准备源账号的分组备份', el('span', { class: 'hint' }, '导出当前登录账号的全部分组及各分组内的应用，或上传已有备份' )));

  const accBox = el('div', { class: 'info-banner mb16', style: 'display:none' });
  card.appendChild(accBox);
  cli(['auth', 'current']).then((r) => {
    const d = r.data || {};
    if (d.loggedIn) {
      accBox.style.display = 'flex';
      accBox.appendChild(el('span', {}, `ℹ 当前登录账号：${d.displayName || d.userName}（${d.userName}）。点击导出将备份该账号的全部应用分组。`));
      GroupSync.lastExportAccount = d.userName;
    }
  }).catch(() => {});

  const btnRow = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px' });
  const exportBtn = el('button', { class: 'btn btn-primary', html: I.download + '导出当前账号分组' });
  exportBtn.onclick = async () => {
    btnLoading(exportBtn, true, '导出中…');
    try {
      const r = await api('/api/group-sync/export', { method: 'POST' });
      if (!r.ok) throw new Error(r.error || '导出失败');
      GroupSync.backupFile = r.file;
      toast(`已导出 ${r.count} 个分组 → ${r.file}`, 'ok');
      loadBackups();
    } catch (e) { toast('导出失败: ' + e.message, 'fail'); }
    btnLoading(exportBtn, false);
  };
  const uploadBtn = el('button', { class: 'btn btn-ghost', html: I.upload + '上传分组备份' });
  const fileInp = el('input', { type: 'file', accept: '.json', style: 'display:none' });
  uploadBtn.onclick = () => fileInp.click();
  fileInp.onchange = async () => {
    const f = fileInp.files[0];
    if (!f) return;
    btnLoading(uploadBtn, true, '上传中…');
    try {
      const content = await f.text();
      const r = await api('/api/group-sync/backups/upload', { method: 'POST', body: JSON.stringify({ content, name: f.name }) });
      if (!r.ok) throw new Error(r.error || '上传失败');
      GroupSync.backupFile = r.file;
      toast(`分组备份已上传（${r.count} 个分组）`, 'ok');
      loadBackups();
    } catch (e) { toast('上传失败: ' + e.message, 'fail'); }
    btnLoading(uploadBtn, false);
    fileInp.value = '';
  };
  btnRow.appendChild(exportBtn);
  btnRow.appendChild(uploadBtn);
  btnRow.appendChild(fileInp);
  card.appendChild(btnRow);

  const listBox = el('div', {});
  card.appendChild(listBox);
  async function loadBackups() {
    listBox.innerHTML = '';
    listBox.appendChild(skeletonRows(3, 3));
    try {
      const r = await api('/api/group-sync/backups');
      listBox.innerHTML = '';
      const files = r.files || [];
      if (!files.length) {
        listBox.appendChild(el('div', { class: 'empty', style: 'padding:24px' }, el('p', {}, '暂无分组备份文件，请先导出或上传')));
        return;
      }
      files.forEach((f) => {
        const radio = el('input', { type: 'radio', name: 'gbk', style: 'accent-color:var(--accent)', ...(GroupSync.backupFile === f.name ? { checked: '' } : {}), onchange: () => { GroupSync.backupFile = f.name; } });
        const label = el('label', { class: 'acc-item fade-item', style: 'cursor:pointer;flex:1;min-width:0' },
          el('div', { style: 'display:flex;align-items:center;gap:10px;min-width:0' },
            radio,
            el('div', { style: 'min-width:0' },
              el('div', { style: 'font-size:13px;font-weight:500;word-break:break-all' }, f.name),
              el('div', { style: 'font-size:11.5px;color:var(--faint);margin-top:2px' }, `${fmtTime(f.mtime)} · ${fmtBytes(f.size)}`))),
        );
        const delBtn = el('button', { class: 'btn btn-danger btn-sm', style: 'flex-shrink:0', html: I.trash + '删除', onclick: async (e) => { e.stopPropagation(); await deleteBackup(f.name); } });
        listBox.appendChild(el('div', { class: 'fade-item', style: 'display:flex;align-items:center;gap:8px' }, label, delBtn));
      });
      stagger(listBox);
    } catch (e) { listBox.innerHTML = ''; listBox.appendChild(el('p', { style: 'color:var(--danger);font-size:13px' }, '分组备份列表加载失败: ' + e.message)); }
  }

  async function deleteBackup(name) {
    const ok = await confirmModal('删除分组备份', `确定要删除备份文件「${name}」吗？此操作不可恢复。`, { danger: true, okText: '删除' });
    if (!ok) return;
    try {
      const r = await api('/api/group-sync/backups/delete', { method: 'POST', body: JSON.stringify({ file: name }) });
      if (!r.ok) throw new Error(r.error || '删除失败');
      if (GroupSync.backupFile === name) GroupSync.backupFile = null;
      toast(`分组备份「${name}」已删除`, 'ok');
      loadBackups();
    } catch (e) { toast('删除失败: ' + e.message, 'fail'); }
  }

  loadBackups();

  // 分组范围配置（可选，仅同步指定分组名）
  const scopeBox = el('div', { class: 'mt16' });
  card.appendChild(el('div', { style: 'font-size:12.5px;color:var(--muted);margin:16px 0 8px' }, '同步范围（可选）：'));
  const scopeInp = el('input', { class: 'input', style: 'width:100%', placeholder: '仅同步指定分组名称，多个用逗号分隔；留空则同步全部分组' });
  scopeInp.value = GroupSync.onlyGroups.join(', ');
  scopeInp.onchange = () => {
    GroupSync.onlyGroups = scopeInp.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  };
  scopeBox.appendChild(scopeInp);
  card.appendChild(scopeBox);
  card.appendChild(el('div', { style: 'font-size:11.5px;color:var(--faint);margin-top:6px' }, '留空 = 同步全部应用分组名称；填写则只同步匹配的分组（创建/复用该分组，并将其应用归入对应分组）。'));

  const nextBtn = el('button', { class: 'btn btn-primary mt16' }, '下一步：切换账号 →');
  nextBtn.onclick = () => { if (!GroupSync.backupFile) { toast('请先选择一个分组备份文件', 'fail'); return; } GroupSync.step = 2; navigate('groupsync'); };
  card.appendChild(nextBtn);
}

/* ---- 步骤 2：切换到目标账号 ---- */
async function renderGS2(body) {
  body.innerHTML = '';
  const card = el('div', { class: 'card fade-item' });
  body.appendChild(card);
  card.appendChild(el('div', { class: 'card-title' }, '第二步：切换到目标账号', el('span', { class: 'hint' }, '分组将同步到「当前登录」的账号，请先切换' )));

  const curBox = el('div', { class: 'loading-center', style: 'padding:24px' }, el('div', { class: 'spinner-lg' }), '获取当前账号…');
  card.appendChild(curBox);

  const accListBox = el('div', { class: 'mt16' });
  card.appendChild(el('div', { style: 'font-size:12.5px;color:var(--muted);margin:14px 0 10px' }, '记住的账号（点击切换，免密登录）：'));
  card.appendChild(accListBox);

  const btnRow = el('div', { style: 'display:flex;gap:10px;margin-top:16px' });
  const refreshBtn = el('button', { class: 'btn btn-ghost', html: I.refresh + '我已切换，刷新' });
  refreshBtn.onclick = async () => { btnLoading(refreshBtn, true, '刷新中…'); await refreshAccount(); loadCur(); btnLoading(refreshBtn, false); };
  const backBtn = el('button', { class: 'btn btn-ghost' }, '← 上一步');
  backBtn.onclick = () => { GroupSync.step = 1; navigate('groupsync'); };
  const nextBtn = el('button', { class: 'btn btn-primary' }, '下一步：确认同步 →');
  nextBtn.onclick = async () => {
    btnLoading(nextBtn, true, '匹配中…');
    try {
      const r = await api('/api/group-sync/match', { method: 'POST', body: JSON.stringify({ file: GroupSync.backupFile, onlyGroups: GroupSync.onlyGroups }) });
      if (!r.ok) throw new Error(r.error || '匹配失败');
      GroupSync.match = r;
      GroupSync.step = 3;
      navigate('groupsync');
    } catch (e) { btnLoading(nextBtn, false); toast('匹配失败: ' + e.message, 'fail'); }
  };
  btnRow.appendChild(backBtn);
  btnRow.appendChild(refreshBtn);
  btnRow.appendChild(el('div', { style: 'flex:1' }));
  btnRow.appendChild(nextBtn);
  card.appendChild(btnRow);

  async function loadCur() {
    curBox.innerHTML = '';
    curBox.style.padding = '14px';
    if (App.account) {
      curBox.appendChild(el('div', { class: 'info-banner' },
        `ℹ 当前登录账号：${App.account.displayName || ''}（${App.account.userName}）。分组将同步到此账号。`));
    } else {
      curBox.appendChild(el('div', { class: 'warn-banner' }, '⚠ 无法获取当前账号，请确认影刀客户端已登录。'));
    }
  }
  await refreshAccount();
  loadCur();

  try {
    const r = await cli(['auth', 'account', 'list']);
    const list = (r.data && (r.data.items || r.data.accounts || r.data)) || [];
    accListBox.innerHTML = '';
    const accounts = Array.isArray(list) ? list : [];
    if (!accounts.length) accListBox.appendChild(el('p', { style: 'font-size:12.5px;color:var(--faint)' }, '（没有记住的账号，请在影刀客户端手动切换）'));
    accounts.forEach((a) => {
      const uname = a.userName || a.username || a.name || String(a);
      const isCur = App.account && App.account.userName === uname;
      const item = el('div', { class: 'acc-item fade-item' + (isCur ? ' current' : '') },
        el('div', {}, el('div', { style: 'font-size:13px;font-weight:500' }, uname), isCur ? el('span', { class: 'badge ok plain', style: 'font-size:10.5px' }, '当前') : null),
        isCur ? null : el('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => {
          const ok = await confirmModal('切换账号', `确定要切换到账号「${uname}」吗？将切换本机影刀客户端的登录状态（免密登录）。`, { okText: '切换' });
          if (!ok) return;
          btnLoading(e.target, true, '切换中…');
          try {
            await api('/api/auth/switch', { method: 'POST', body: JSON.stringify({ username: uname }) });
            toast('账号已切换', 'ok');
            await refreshAccount();
            loadCur();
            renderGS2(body);
          } catch (err) { toast('切换失败: ' + err.message, 'fail'); }
        } }, '切换'),
      );
      accListBox.appendChild(item);
    });
    stagger(accListBox);
  } catch (e) {
    accListBox.appendChild(el('p', { style: 'font-size:12.5px;color:var(--faint)' }, '账号列表获取失败: ' + e.message));
  }
}

/* ---- 步骤 3：确认同步 ---- */
function renderGS3(body) {
  body.innerHTML = '';
  const m = GroupSync.match;
  if (!m) { GroupSync.step = 1; renderGroupSync($('#page')); return; }

  const sum = el('div', { class: 'stat-grid mb16' });
  [['源分组总数', m.summary.totalGroups, 'var(--muted)'], ['待创建分组', m.summary.toCreate, 'var(--ok)'],
   ['目标已存在', m.summary.existingGroups, 'var(--blue, var(--accent))'], ['待归组应用', m.summary.moveCount, 'var(--warn)'],
   ['无法归组', m.summary.unmatched, 'var(--danger)']].forEach(([label, v, c]) => {
    sum.appendChild(el('div', { class: 'card stat-card fade-item', style: 'padding:14px 16px' },
      el('div', { class: 'stat-num', style: `font-size:22px;color:${c}` }, String(v)),
      el('div', { class: 'stat-label' }, label)));
  });
  body.appendChild(stagger(sum));

  if (m.sameAccount) {
    body.appendChild(el('div', { class: 'warn-banner mb16' }, `⚠ 备份来源账号与当前登录账号相同（${m.sourceAccount ? m.sourceAccount.userName : ''}）。如果这不是有意为之，请返回上一步切换账号，否则会在同一账号上重复操作。`));
  }
  body.appendChild(el('div', { class: 'info-banner mb16' }, `ℹ 备份来源：${m.sourceAccount ? m.sourceAccount.displayName + '（' + m.sourceAccount.userName + '）' : '未知'} · 同步目标：${m.targetAccount ? m.targetAccount.displayName + '（' + m.targetAccount.userName + '）' : '当前账号'} · 目标账号现有分组：${m.summary.targetGroupCount} · 目标账号应用数：${m.summary.targetAppCount}`));
  if (m.onlyGroups && m.onlyGroups.length) {
    body.appendChild(el('div', { class: 'info-banner mb16' }, `ℹ 仅同步分组：${m.onlyGroups.join('、')}`));
  }

  // 待创建分组
  if (m.toCreate.length) {
    const card = el('div', { class: 'card mb16 fade-item' });
    card.appendChild(el('div', { class: 'card-title' }, `➕ 待创建分组（${m.toCreate.length}）`, el('span', { class: 'hint' }, '目标账号不存在同名分组，将新建' )));
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '分组名称'), el('th', {}, '包含应用数'))));
    const tb = el('tbody');
    m.toCreate.forEach((g) => {
      tb.appendChild(el('tr', {},
        el('td', { class: 'name-cell' }, g.name),
        el('td', {}, String(g.appCount))));
    });
    tbl.appendChild(tb);
    card.appendChild(el('div', { class: 'tbl-wrap', style: 'border:none' }, tbl));
    body.appendChild(card);
  }

  // 目标已存在分组
  if (m.existingGroups.length) {
    const card = el('div', { class: 'card mb16 fade-item' });
    card.appendChild(el('div', { class: 'card-title' }, `✓ 目标已存在分组（${m.existingGroups.length}）`, el('span', { class: 'hint' }, '直接复用目标账号同名分组，不重复创建' )));
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '分组名称'), el('th', {}, '包含应用数'))));
    const tb = el('tbody');
    m.existingGroups.forEach((g) => {
      tb.appendChild(el('tr', {},
        el('td', { class: 'name-cell' }, g.name),
        el('td', {}, String(g.appCount))));
    });
    tbl.appendChild(tb);
    card.appendChild(el('div', { class: 'tbl-wrap', style: 'border:none' }, tbl));
    body.appendChild(card);
  }

  // 待归组应用
  if (m.moves.length) {
    const card = el('div', { class: 'card mb16 fade-item', style: 'border-color:rgba(251,191,36,.3)' });
    card.appendChild(el('div', { class: 'card-title' }, `📦 待归组应用（${m.moves.length}）`, el('span', { class: 'hint' }, '目标账号存在同名应用，将移入对应分组' )));
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '应用名称'), el('th', {}, '归入分组'))));
    const tb = el('tbody');
    m.moves.forEach((mv) => {
      tb.appendChild(el('tr', {},
        el('td', { class: 'name-cell' }, mv.appName),
        el('td', {}, el('span', { class: 'badge blue' }, mv.groupName))));
    });
    tbl.appendChild(tb);
    card.appendChild(el('div', { class: 'tbl-wrap', style: 'border:none' }, tbl));
    body.appendChild(card);
  }

  // 无法归组
  if (m.unmatchedApps.length) {
    const card = el('div', { class: 'card mb16 fade-item', style: 'border-color:rgba(248,113,113,.3)' });
    card.appendChild(el('div', { class: 'card-title' }, `❌ 无法归组（${m.unmatchedApps.length}）`, el('span', { class: 'hint' }, '目标账号无同名应用（或多个同名），将跳过' )));
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '应用名称'), el('th', {}, '原分组'), el('th', {}, '原因'))));
    const tb = el('tbody');
    m.unmatchedApps.forEach((a) => {
      tb.appendChild(el('tr', {},
        el('td', { class: 'name-cell' }, a.appName),
        el('td', {}, a.groupName),
        el('td', { style: 'font-size:12px;color:var(--muted)' }, a.reason)));
    });
    tbl.appendChild(tb);
    card.appendChild(el('div', { class: 'tbl-wrap', style: 'border:none' }, tbl));
    body.appendChild(card);
  }

  const btnRow = el('div', { style: 'display:flex;gap:10px' });
  const backBtn = el('button', { class: 'btn btn-ghost' }, '← 上一步');
  backBtn.onclick = () => { GroupSync.step = 2; navigate('groupsync'); };
  const nextBtn = el('button', { class: 'btn btn-primary' }, '生成同步预览 →');
  nextBtn.onclick = () => { GroupSync.step = 4; navigate('groupsync'); };
  btnRow.appendChild(backBtn);
  btnRow.appendChild(el('div', { style: 'flex:1' }));
  btnRow.appendChild(nextBtn);
  body.appendChild(btnRow);
}

/* ---- 步骤 4：执行同步 ---- */
async function renderGS4(body) {
  body.innerHTML = '';
  const m = GroupSync.match;
  if (!m) { GroupSync.step = 1; renderGroupSync($('#page')); return; }

  const card = el('div', { class: 'card fade-item' });
  body.appendChild(card);
  card.appendChild(el('div', { class: 'card-title' }, '第四步：预览并执行同步', el('span', { class: 'hint' }, `待创建 ${m.summary.toCreate} 个分组 · 待归组 ${m.summary.moveCount} 个应用` )));

  const resultBox = el('div', {});
  const previewBox = el('div', { class: 'mb16' });
  card.appendChild(previewBox);
  card.appendChild(resultBox);

  previewBox.innerHTML = '';
  previewBox.appendChild(skeletonRows(3, 4));
  try {
    const r = await api('/api/group-sync/import', { method: 'POST', body: JSON.stringify({ file: GroupSync.backupFile, onlyGroups: GroupSync.onlyGroups, dryRun: true }) });
    if (!r.ok) throw new Error(r.error || '预览生成失败');
    previewBox.innerHTML = '';
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '类型'), el('th', {}, '对象'), el('th', {}, '将执行的命令'))));
    const tb = el('tbody');
    r.results.forEach((x, i) => {
      const kindTxt = x.kind === 'group' ? '建分组' : '移应用';
      const kindCls = x.kind === 'group' ? 'blue' : 'teal';
      tb.appendChild(el('tr', { class: 'fade-item' },
        el('td', {}, el('span', { class: 'badge ' + kindCls }, kindTxt)),
        el('td', { class: 'name-cell' }, x.kind === 'group' ? x.name : `${x.appName} → ${x.groupName}`),
        el('td', { class: 'mono', style: 'font-size:11.5px;max-width:460px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, x.command)));
    });
    tbl.appendChild(tb);
    previewBox.appendChild(el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:8px' }, `预览：创建分组 ${r.summary.createGroups} 个 · 移动应用 ${r.summary.moveCount} 个 · 无法归组 ${r.summary.unmatched} 个`));
    previewBox.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
    stagger(previewBox);
  } catch (e) {
    previewBox.innerHTML = '';
    previewBox.appendChild(el('p', { style: 'color:var(--danger);font-size:13px' }, '预览失败: ' + e.message));
  }

  const btnRow = el('div', { style: 'display:flex;gap:10px' });
  const backBtn = el('button', { class: 'btn btn-ghost' }, '← 上一步');
  backBtn.onclick = () => { GroupSync.step = 3; navigate('groupsync'); };
  const goBtn = el('button', { class: 'btn btn-danger', html: I.play + '正式同步' });
  goBtn.onclick = async () => {
    const ok = await confirmModal('正式同步', `将向当前账号创建 ${m.summary.toCreate} 个分组，并移动 ${m.summary.moveCount} 个应用归入对应分组。确定继续吗？`, { danger: true, okText: '开始同步' });
    if (!ok) return;
    btnLoading(goBtn, true, '正在同步…');
    resultBox.innerHTML = '';
    resultBox.appendChild(el('div', { class: 'loading-center', style: 'padding:30px' }, el('div', { class: 'spinner-lg' }), '正在同步分组与应用，请勿关闭页面…'));
    try {
      const r = await api('/api/group-sync/import', { method: 'POST', body: JSON.stringify({ file: GroupSync.backupFile, onlyGroups: GroupSync.onlyGroups, dryRun: false }) });
      if (!r.ok) throw new Error(r.error || '同步失败');
      resultBox.innerHTML = '';
      resultBox.appendChild(el('div', { class: 'stat-grid mb16' },
        el('div', { class: 'card fade-item', style: 'padding:14px;text-align:center' }, el('div', { class: 'stat-num', style: 'font-size:24px;color:var(--ok)' }, String(r.summary.createOk)), el('div', { class: 'stat-label' }, '分组创建成功')),
        el('div', { class: 'card fade-item', style: 'padding:14px;text-align:center' }, el('div', { class: 'stat-num', style: 'font-size:24px;color:var(--danger)' }, String(r.summary.createFail)), el('div', { class: 'stat-label' }, '分组创建失败')),
        el('div', { class: 'card fade-item', style: 'padding:14px;text-align:center' }, el('div', { class: 'stat-num', style: 'font-size:24px;color:var(--ok)' }, String(r.summary.moveOk)), el('div', { class: 'stat-label' }, '移动成功')),
        el('div', { class: 'card fade-item', style: 'padding:14px;text-align:center' }, el('div', { class: 'stat-num', style: 'font-size:24px;color:var(--danger)' }, String(r.summary.moveFail)), el('div', { class: 'stat-label' }, '移动失败')),
      ));
      const tbl = el('table', { class: 'tbl' },
        el('thead', {}, el('tr', {}, el('th', {}, '类型'), el('th', {}, '对象'), el('th', {}, '结果'), el('th', {}, '详情'))));
      const tb = el('tbody');
      r.results.forEach((x) => {
        const stMap = { ok: ['成功', 'ok'], fail: ['失败', 'fail'], 'dry-run': ['预览', 'blue'], skipped: ['跳过', 'cancel'] };
        const [txt, cls] = stMap[x.status] || [x.status, 'cancel'];
        const kindTxt = x.kind === 'group' ? '建分组' : '移应用';
        tb.appendChild(el('tr', { class: 'fade-item' },
          el('td', {}, kindTxt),
          el('td', { class: 'name-cell' }, x.kind === 'group' ? x.name : `${x.appName} → ${x.groupName}`),
          el('td', {}, el('span', { class: 'badge ' + cls }, txt)),
          el('td', { style: 'font-size:12px;color:var(--muted)' }, x.message)));
      });
      tbl.appendChild(tb);
      resultBox.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
      stagger(resultBox);
      if (r.summary.createFail === 0 && r.summary.moveFail === 0) toast(`同步完成：${r.summary.createOk} 分组 / ${r.summary.moveOk} 应用`, 'ok');
      else toast(`同步完成：创建 ${r.summary.createOk} 成功 / ${r.summary.createFail} 失败 · 移动 ${r.summary.moveOk} 成功 / ${r.summary.moveFail} 失败`, 'fail');
    } catch (e) {
      resultBox.innerHTML = '';
      resultBox.appendChild(el('p', { style: 'color:var(--danger)' }, '同步失败: ' + e.message));
      btnLoading(goBtn, false);
      return;
    }
    btnLoading(goBtn, false);
  };
  btnRow.appendChild(backBtn);
  btnRow.appendChild(el('div', { style: 'flex:1' }));
  btnRow.appendChild(goBtn);
  card.appendChild(el('div', { class: 'mt16' }, btnRow));
}

/* ============================================================
 * 消息中心
 * ============================================================ */
async function renderMessages(page) {
  let status = 'all';
  let tabs, listWrap;
  page.appendChild(tabs = el('div', { class: 'tabs' }));
  page.appendChild(listWrap = el('div', {}));

  function buildTabs() {
    tabs.innerHTML = '';
    [['all', '全部'], ['unread', '未读'], ['read', '已读']].forEach(([code, name]) => {
      tabs.appendChild(el('div', { class: 'tab' + (status === code ? ' active' : ''), onclick: () => { status = code; buildTabs(); load(); } }, name));
    });
    tabs.appendChild(el('div', { style: 'flex:1' }));
    tabs.appendChild(el('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
      try { await cli(['console', 'message', 'read-all']); toast('已全部标记为已读', 'ok'); App.unread = 0; buildNav(); load(); } catch (e) { toast('操作失败: ' + e.message, 'fail'); }
    } }, '全部已读'));
  }

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonRows(3, 4));
    try {
      const r = await cli(['console', 'message', 'list', '--status', status, '--size', '30']);
      const items = (r.data && (r.data.items || r.data.messages)) || [];
      listWrap.innerHTML = '';
      if (!items.length) { listWrap.appendChild(emptyState('没有消息', '📬')); App.unread = 0; buildNav(); return; }
      items.forEach((msg, i) => {
        const id = msg.id || msg.messageId;
        const isUnread = msg.read === false || msg.status === 'unread' || msg.isRead === false;
        const title = msg.title || msg.subject || '系统消息';
        const content = msg.content || msg.body || '';
        const time = msg.createTime || msg.time || '';
        listWrap.appendChild(el('div', { class: 'card fade-item', style: 'margin-bottom:10px' + (isUnread ? ';border-color:rgba(91,124,250,.4)' : '') },
          el('div', { style: 'display:flex;align-items:flex-start;gap:10px' },
            isUnread ? el('span', { style: 'width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:6px;flex-shrink:0;animation:pulse 1.8s infinite' }) : el('span', { style: 'width:8px;flex-shrink:0' }),
            el('div', { style: 'flex:1;min-width:0' },
              el('div', { style: 'display:flex;justify-content:space-between;gap:10px' },
                el('div', { style: `font-size:13.5px;font-weight:${isUnread ? 600 : 400}` }, title),
                el('span', { class: 'mono', style: 'font-size:11.5px;color:var(--faint);white-space:nowrap' }, fmtTime(time))),
              content ? el('div', { style: 'font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.6' }, content) : null,
              isUnread ? el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:10px', onclick: async (e) => {
                try { await cli(['console', 'message', 'read', '--id', id]); toast('已标记已读', 'ok'); e.target.remove(); } catch (err) { toast('操作失败: ' + err.message, 'fail'); }
              } }, '标为已读') : null,
            ))));
      });
      stagger(listWrap);
    } catch (e) {
      listWrap.innerHTML = '';
      listWrap.appendChild(el('div', { class: 'empty' }, el('p', { style: 'color:var(--danger)' }, '加载失败: ' + e.message)));
    }
  }

  buildTabs();
  load();
}

/* ============================================================
 * 扩展管理
 * ============================================================ */
async function renderExtensions(page) {
  const box = el('div', {});
  page.appendChild(box);
  box.appendChild(skeletonRows(3, 3));
  try {
    const r = await cli(['console', 'extension', 'list']);
    const items = (r.data && (r.data.items || r.data.extensions || r.data)) || [];
    box.innerHTML = '';
    if (!Array.isArray(items) || !items.length) { box.appendChild(emptyState('没有扩展信息', '🧩')); return; }
    const grid = el('div', { class: 'stat-grid' });
    items.forEach((x) => {
      const name = x.name || x.extensionName || x.title || '扩展';
      const installed = x.installed || x.status === 'installed' || x.enabled;
      grid.appendChild(el('div', { class: 'card fade-item' },
        el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start;gap:10px' },
          el('div', {},
            el('div', { style: 'font-size:14px;font-weight:600;margin-bottom:4px' }, name),
            el('div', { style: 'font-size:12px;color:var(--muted)' }, x.description || x.type || ''),
            x.version ? el('div', { class: 'mono', style: 'font-size:11.5px;color:var(--faint);margin-top:4px' }, 'v' + x.version) : null),
          el('span', { class: 'badge ' + (installed ? 'ok' : 'cancel') }, installed ? '已安装' : '未安装'))));
    });
    box.appendChild(stagger(grid));
  } catch (e) {
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'empty' }, el('p', { style: 'color:var(--danger)' }, '加载失败: ' + e.message)));
  }
}

/* ============================================================
 * 系统设置
 * ============================================================ */
async function renderSettings(page) {
  // 模式切换卡片
  const modeCard = el('div', { class: 'card mb16 fade-item' });
  modeCard.appendChild(el('div', { class: 'card-title' }, '客户端模式', el('span', { class: 'hint' }, 'assistant 模式下 REST API 不可用（4011）')));
  const modeBtns = el('div', { style: 'display:flex;gap:10px' },
    el('button', { class: 'btn btn-primary', id: 'mode-console-btn', onclick: () => switchMode('console') }, '控制台模式 (console)'),
    el('button', { class: 'btn btn-ghost', id: 'mode-assistant-btn', onclick: () => switchMode('assistant') }, '助手模式 (assistant)'));
  modeCard.appendChild(modeBtns);
  page.appendChild(modeCard);

  async function switchMode(to) {
    btnLoading($('#mode-' + to + '-btn'), true, '切换中…');
    try {
      await cli(['mode', 'switch', '--to', to]);
      toast(`已切换到 ${to} 模式`, 'ok');
      if (to === 'assistant') toast('注意：助手模式下控制台大部分功能将不可用', 'info');
    } catch (e) { toast('切换失败: ' + e.message, 'fail'); }
    btnLoading($('#mode-' + to + '-btn'), false);
  }

  // 配置项卡片
  const cfgCard = el('div', { class: 'card fade-item' });
  cfgCard.appendChild(el('div', { class: 'card-title' }, '配置项', el('span', { class: 'hint' }, '影刀客户端配置')));
  const cfgBox = el('div', {});
  cfgCard.appendChild(cfgBox);
  page.appendChild(cfgCard);
  cfgBox.appendChild(skeletonRows(3, 5));
  try {
    const r = await cli(['config', 'list']);
    const items = (r.data && (r.data.items || r.data.configs || (Array.isArray(r.data) ? r.data : []))) || [];
    cfgBox.innerHTML = '';
    if (!items.length) { cfgBox.appendChild(el('p', { style: 'color:var(--faint);font-size:13px' }, '未获取到配置项')); return; }
    const tbl = el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, '配置键'), el('th', {}, '值'), el('th', { style: 'text-align:right' }, '操作'))));
    const tb = el('tbody');
    items.forEach((c) => {
      const key = c.key || c.name;
      const val = c.value != null ? String(c.value) : '';
      tb.appendChild(el('tr', { class: 'fade-item' },
        el('td', { class: 'mono name-cell', style: 'font-size:12.5px' }, key, el('span', { class: 'sub' }, c.description || '')),
        el('td', { class: 'mono', style: 'font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, val || '-'),
        el('td', { style: 'text-align:right' },
          el('button', { class: 'btn btn-ghost btn-sm', onclick: () => editConfig(key, val) }, '修改'))));
    });
    tbl.appendChild(tb);
    cfgBox.appendChild(el('div', { class: 'tbl-wrap' }, tbl));
    stagger(cfgBox);
  } catch (e) {
    cfgBox.innerHTML = '';
    cfgBox.appendChild(el('p', { style: 'color:var(--danger);font-size:13px' }, '配置加载失败: ' + e.message));
  }

  function editConfig(key, val) {
    const inp = el('input', { class: 'input', style: 'width:100%', value: val });
    modal({
      title: '修改配置：' + key,
      body: el('div', {}, el('div', { style: 'font-size:12.5px;color:var(--muted);margin-bottom:8px' }, '新值'), inp),
      footer: [
        el('button', { class: 'btn btn-ghost', onclick: () => document.querySelector('.modal-close').click() }, '取消'),
        el('button', { class: 'btn btn-primary', onclick: async (e) => {
          try {
            await cli(['config', 'set', '--key', key, '--value', inp.value]);
            toast(`配置 ${key} 已更新`, 'ok');
            document.querySelector('.modal-close').click();
            renderSettings($('#page'));
          } catch (err) { toast('修改失败: ' + err.message, 'fail'); }
        } }, '保存'),
      ],
    });
  }

  stagger(page);
}

/* ============================================================
 * 启动
 * ============================================================ */
async function updateLanAddr() {
  const eln = $('#lan-addr');
  if (!eln) return;
  try {
    const r = await api('/api/health');
    if (r && r.ok && r.lanIP) {
      eln.textContent = r.lanIP + ':' + (r.port || '18923');
      eln.title = '局域网访问地址';
    }
  } catch (e) { /* 忽略，保持默认 127.0.0.1 */ }
}

(async function init() {
  buildNav();
  updateLanAddr();
  await refreshAccount();
  navigate('dashboard');
  // 定时刷新账号状态
  setInterval(refreshAccount, 60000);
})();
