/* ============================================================
 * 分组同步（向导）
 * ============================================================ */
import { el, $, toast, confirmModal, skeletonRows, stagger, btnLoading, fmtTime, fmtBytes } from '../utils.js';
import { api, cli } from '../api.js';
import { App, navigate, refreshAccount, register } from '../router.js';
import { renderAccountList } from '../account.js';
import { I } from '../constants.js';

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
      accBox.appendChild(el('span', {}, `ℹ 当前登录账号：${d.displayName || d.userName}（${d.userName}）。`));
      GroupSync.lastExportAccount = d.userName;
    }
  }).catch(() => {});

  // 同步范围配置（放在导出按钮上方，导出时即生效）
  const scopeBox = el('div', { class: 'mt16' });
  card.appendChild(el('div', { style: 'font-size:12.5px;color:var(--muted);margin:14px 0 8px' }, '同步范围（可选）：'));
  const scopeInp = el('input', { class: 'input', style: 'width:100%', placeholder: '仅同步指定分组名称，多个用逗号分隔；留空则同步全部分组' });
  scopeInp.value = GroupSync.onlyGroups.join(', ');
  // 实时读取输入框值（input 事件，中文输入法组合输入也能捕获），避免依赖 onchange 失焦触发
  const readScope = () => {
    GroupSync.onlyGroups = scopeInp.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  };
  scopeInp.addEventListener('input', readScope);
  scopeInp.addEventListener('change', readScope);
  scopeBox.appendChild(scopeInp);
  card.appendChild(scopeBox);
  card.appendChild(el('div', { style: 'font-size:11.5px;color:var(--faint);margin-top:6px' }, '留空 = 导出并同步全部分组；填写则只导出匹配的分组（创建/复用该分组，并将其应用归入对应分组）。'));

  const btnRow = el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 18px' });
  const exportBtn = el('button', { class: 'btn btn-primary', html: I.download + '导出当前账号分组' });
  exportBtn.onclick = async () => {
    readScope(); // 点击导出时读一次，确保拿到最新输入
    btnLoading(exportBtn, true, '导出中…');
    try {
      const r = await api('/api/group-sync/export', { method: 'POST', body: JSON.stringify({ onlyGroups: GroupSync.onlyGroups }) });
      if (!r.ok) throw new Error(r.error || '导出失败');
      GroupSync.backupFile = r.file;
      const ungrouped = r.ungroupedAppCount ? `（未分组应用 ${r.ungroupedAppCount} 个，不同步）` : '';
      toast(`已导出 ${r.count} 个分组${ungrouped} → ${r.file}`, 'ok');
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

  const nextBtn = el('button', { class: 'btn btn-primary mt16' }, '下一步：切换账号 →');
  nextBtn.onclick = () => {
    if (!GroupSync.backupFile) { toast('请先选择一个分组备份文件', 'fail'); return; }
    GroupSync.step = 2; navigate('groupsync');
  };
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
        renderGS2(body);
      } catch (err) { btnLoading(e.target, false); toast('切换失败: ' + err.message, 'fail'); }
    },
  });
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
    r.results.forEach((x) => {
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

register('groupsync', { title: '分组同步', sub: '跨账号同步分组与归组应用', icon: I.groups, render: renderGroupSync });
