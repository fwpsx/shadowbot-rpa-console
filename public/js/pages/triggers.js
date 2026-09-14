/* ============================================================
 * 触发器管理
 * ============================================================ */
import { el, toast, confirmModal, skeletonRows, emptyState, stagger, btnLoading, cronDescribe, hotkeyDescribe, fmtTime, shortId } from '../utils.js';
import { cli } from '../api.js';
import { register } from '../router.js';
import { TRIGGER_TYPE, HOTKEY_MODIFIERS, FILE_EVENTS, VK_NAMES, I } from '../constants.js';

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
      emailF = emailForm(d);
      typeFields.appendChild(emailF.node);
    } else if (type === 'folder' || type === 'file') {
      fileF = fileForm(d);
      typeFields.appendChild(fileF.node);
    } else if (type === 'hotkey') {
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

register('triggers', { title: '触发器管理', sub: '定时 / 邮件 / 文件夹 / 热键', icon: I.triggers, render: renderTriggers });
