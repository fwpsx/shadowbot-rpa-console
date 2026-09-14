/* ============================================================
 * 触发器迁移（向导）
 * ============================================================ */
import { el, $, toast, confirmModal, skeletonRows, stagger, btnLoading, fmtTime, fmtBytes, cronDescribe, hotkeyDescribe } from '../utils.js';
import { api, cli } from '../api.js';
import { App, navigate, refreshAccount, register } from '../router.js';
import { renderAccountList } from '../account.js';
import { TRIGGER_TYPE, I } from '../constants.js';

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

  // 记住的账号列表（分页 + 模糊搜索）
  await renderAccountList(accListBox, {
    isCurrent: (name) => App.account && App.account.userName === name,
    onSwitch: async (uname, e) => {
      const ok = await confirmModal('切换账号', `确定要切换到账号「${uname}」吗？\n\n将关闭并重启本机影刀客户端，约需 5~15 秒。`, { okText: '切换' });
      if (!ok) return;
      btnLoading(e.target, true, '切换中（重启影刀）…');
      try {
        const r = await api('/api/auth/switch', { method: 'POST', body: JSON.stringify({ username: uname }) });
        if (r.blocked) { btnLoading(e.target, false); toast(r.error || '当前影刀被占用，不允许切换', 'fail'); return; }
        if (!r.ok) throw new Error(r.error || '切换失败');
        toast(`已切换到账号「${r.userName || uname}」`, 'ok');
        await refreshAccount();
        loadCur();
        renderStep2(body);
      } catch (err) { btnLoading(e.target, false); toast('切换失败: ' + err.message, 'fail'); }
    },
  });
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
    r.results.filter((x) => x.status !== 'skipped').forEach((x) => {
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

register('migration', { title: '触发器迁移', sub: '跨账号导出 · 名称匹配 · 导入', icon: I.migration, render: renderMigration });
