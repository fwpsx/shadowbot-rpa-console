/* ============================================================
 * 通用工具：DOM 操作、UI 组件（toast/modal）、格式化、分页
 * 依赖：constants.js（位掩码枚举、虚拟键码）
 * ============================================================ */
import { HOTKEY_MODIFIERS, FILE_EVENTS, VK_NAMES } from './constants.js';

export const $ = (s, p) => (p || document).querySelector(s);
export const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));

export function el(tag, attrs, ...children) {
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

/* ============================================================
 * Toast 与模态框
 * ============================================================ */
export function toast(msg, type = 'info', action) {
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

export function modal({ title, body, footer, wide, onClose }) {
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

export function confirmModal(title, msg, { danger, okText = '确认' } = {}) {
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
 * 格式化
 * ============================================================ */
export function vkName(code) { return VK_NAMES[code] || String.fromCharCode(code) || ('VK' + code); }
export function hotkeyDescribe(modifierKeys, virtualKey) {
  const mods = HOTKEY_MODIFIERS.filter(m => (modifierKeys & m.value) === m.value).map(m => m.label);
  const key = vkName(virtualKey);
  return mods.length ? mods.join('+') + '+' + key : key;
}
export function fileEventsDescribe(mask) {
  const arr = FILE_EVENTS.filter(e => (mask & e.value) === e.value).map(e => e.label);
  return arr.length ? arr.join('/') : ('事件(' + mask + ')');
}

export function cronDescribe(cron) {
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

export function fmtBytes(n) {
  if (n == null) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
export function fmtTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).replace('T', ' ').replace(/Z$/, '').slice(0, 19);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
export function shortId(id) { return id ? String(id).slice(0, 8) + '…' : '-'; }

export function stagger(container, selector = '.fade-item') {
  $$(selector, container).forEach((n, i) => { n.style.animationDelay = Math.min(i * 45, 600) + 'ms'; });
  return container;
}

export function countUp(node, target, dur = 900) {
  const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function skeletonRows(cols, rows = 6) {
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

export function emptyState(text, icon = '📭') {
  return el('div', { class: 'empty fade-item' }, el('div', { class: 'e-icon' }, icon), el('p', {}, text));
}

/* 通用分页条：显示总数/总页数，支持每页条数切换、页码跳转，末页禁用下一页 */
export function renderPager(opts) {
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
export function btnLoading(btn, loading, text) {
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${text || '处理中…'}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
  }
}
