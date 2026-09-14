/* ============================================================
 * 系统设置
 * ============================================================ */
import { el, $, toast, modal, skeletonRows, stagger, btnLoading } from '../utils.js';
import { cli } from '../api.js';
import { register } from '../router.js';
import { I } from '../constants.js';

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
        el('button', { class: 'btn btn-primary', onclick: async () => {
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

register('settings', { title: '系统设置', sub: '配置项与模式切换', icon: I.settings, render: renderSettings });
