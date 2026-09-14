/* ============================================================
 * 消息中心
 * ============================================================ */
import { el, toast, skeletonRows, emptyState, stagger, fmtTime } from '../utils.js';
import { cli } from '../api.js';
import { App, buildNav, register } from '../router.js';
import { I } from '../constants.js';

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
      items.forEach((msg) => {
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

register('messages', { title: '消息中心', sub: '系统消息', icon: I.messages, render: renderMessages });
