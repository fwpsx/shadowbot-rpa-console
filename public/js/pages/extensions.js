/* ============================================================
 * 扩展管理
 * ============================================================ */
import { el, skeletonRows, emptyState, stagger } from '../utils.js';
import { cli } from '../api.js';
import { register } from '../router.js';
import { I } from '../constants.js';

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

register('extensions', { title: '扩展管理', sub: '浏览器与设备扩展', icon: I.extensions, render: renderExtensions });
