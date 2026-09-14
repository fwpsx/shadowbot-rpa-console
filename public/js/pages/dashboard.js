/* ============================================================
 * 仪表盘
 * ============================================================ */
import { el, stagger, countUp, fmtTime } from '../utils.js';
import { api, cli } from '../api.js';
import { App, buildNav, navigate, register } from '../router.js';
import { I } from '../constants.js';

async function renderDashboard(page) {
  page.appendChild(el('div', { class: 'loading-center' }, el('div', { class: 'spinner-lg' }), '正在获取系统状态…'));

  // 聚合接口（内部 4 并发 + 10s 缓存）+ 并发获取未读消息和扩展
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

register('dashboard', { title: '仪表盘', sub: '系统状态总览', icon: I.dashboard, render: renderDashboard });
