/* ============================================================
 * 账号列表（带分页 + 模糊搜索，迁移/分组同步步骤2共用）
 * 依赖：utils.js、api.js
 * ============================================================ */
import { el, stagger, renderPager } from './utils.js';
import { cli } from './api.js';

// 渲染账号列表到 container，支持分页与搜索。
// opts: { onSwitch(uname), isCurrent(uname), pageSize? }
export async function renderAccountList(container, opts) {
  container.innerHTML = '';
  opts = opts || {};
  const PAGE_SIZE = opts.pageSize || 8;
  let accounts = [];
  let query = '';

  // 搜索框
  const searchRow = el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:10px' });
  const searchInp = el('input', { class: 'input', style: 'flex:1', placeholder: '搜索账号名 / 显示名（模糊匹配）…' });
  const clearBtn = el('button', { class: 'btn btn-ghost btn-sm' }, '清空');
  searchRow.appendChild(searchInp);
  searchRow.appendChild(clearBtn);
  container.appendChild(searchRow);

  // 列表容器 + 分页容器
  const listBox = el('div', {});
  const pagerBox = el('div', {});
  container.appendChild(listBox);
  container.appendChild(pagerBox);

  // 加载账号列表
  try {
    const r = await cli(['auth', 'account', 'list']);
    const list = (r.data && (r.data.items || r.data.accounts || r.data)) || [];
    accounts = Array.isArray(list) ? list : [];
  } catch (e) {
    listBox.appendChild(el('p', { style: 'font-size:12.5px;color:var(--faint)' }, '账号列表获取失败: ' + e.message));
    return;
  }
  if (!accounts.length) {
    listBox.appendChild(el('p', { style: 'font-size:12.5px;color:var(--faint)' }, '（没有记住的账号，请在影刀客户端手动切换）'));
    return;
  }

  function matches(a, q) {
    if (!q) return true;
    const name = String(a.name || '');
    const disp = String(a.displayName || '');
    const ql = q.toLowerCase();
    return name.toLowerCase().includes(ql) || disp.toLowerCase().includes(ql);
  }

  function render() {
    listBox.innerHTML = '';
    pagerBox.innerHTML = '';
    const filtered = accounts.filter((a) => matches(a, query));
    if (!filtered.length) {
      listBox.appendChild(el('p', { style: 'font-size:12.5px;color:var(--faint)' }, `（没有匹配「${query}」的账号）`));
      return;
    }
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    let cur = (render._cur || 1);
    if (cur > totalPages) cur = totalPages;
    render._cur = cur;
    const start = (cur - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    pageItems.forEach((a) => {
      const name = String(a.name || '');
      const disp = String(a.displayName || '');
      const ent = String(a.enterpriseName || '');
      const isCur = typeof opts.isCurrent === 'function' ? opts.isCurrent(name) : false;
      const label = disp && disp !== name ? `${name}（${disp}）` : name;
      const sub = ent ? ` · ${ent}` : (a.hasSavedPassword ? ' · 免密' : '');
      const item = el('div', { class: 'acc-item fade-item' + (isCur ? ' current' : '') },
        el('div', {},
          el('div', { style: 'font-size:13px;font-weight:500' }, label),
          el('div', { style: 'font-size:11px;color:var(--faint);margin-top:2px' },
            sub + (a.autoLogin ? ' · 自动登录' : '')),
          isCur ? el('span', { class: 'badge ok plain', style: 'font-size:10.5px' }, '当前') : null),
        isCur ? null : el('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => opts.onSwitch && opts.onSwitch(name, e) }, '切换'),
      );
      listBox.appendChild(item);
    });
    stagger(listBox);

    if (total > PAGE_SIZE) {
      pagerBox.appendChild(renderPager({
        curPage: cur, total, pageSize: PAGE_SIZE,
        onPage: (p) => { render._cur = p; render(); },
        onSize: (s) => { PAGE_SIZE = s; render._cur = 1; render(); },
      }));
    }
  }

  searchInp.addEventListener('input', () => { query = searchInp.value.trim(); render._cur = 1; render(); });
  clearBtn.onclick = () => { searchInp.value = ''; query = ''; render._cur = 1; render(); };
  render();
}
