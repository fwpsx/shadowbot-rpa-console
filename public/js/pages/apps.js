/* ============================================================
 * 应用管理
 * ============================================================ */
import { el, toast, confirmModal, skeletonRows, emptyState, stagger, renderPager, fmtTime, shortId } from '../utils.js';
import { api, cli } from '../api.js';
import { navigate, register } from '../router.js';
import { I } from '../constants.js';

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

register('apps', { title: '应用管理', sub: '查看与运行 RPA 应用', icon: I.apps, render: renderApps });
