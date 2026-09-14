/**
 * 业务逻辑：字段归一化、数据获取、触发器导出/匹配/导入
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { rest, restReady, cachedRest } = require('./rest');
const { cachedCli, runCli, clearCache } = require('./cli');
const { ensureDir, localTs, argsToDisplay } = require('./utils');

// ================= 字段归一化 =================
// REST 返回 PascalCase，归一化为 CLI 的小写驼峰，保证下游代码（匹配/导入）字段一致
function normApp(a) {
  if (!a) return a;
  return {
    appId: a.AppId, appName: a.AppName, appType: a.AppType,
    groupId: a.GroupId, ownerName: a.OwnerName,
    updateTime: a.UpdateTime, versionId: a.VersionId,
  };
}
function normGroup(g) {
  if (!g) return g;
  return {
    groupId: g.GroupId, name: g.Name, icon: g.Icon,
    appType: g.AppType, createTime: g.CreateTime, updateTime: g.UpdateTime,
  };
}
function normTrigger(t) {
  if (!t) return t;
  return {
    id: t.Id, domain: t.Domain, triggerType: t.TriggerType, name: t.Name,
    appId: t.AppId, appName: t.AppName, enabled: t.Enabled,
    timeout: t.Timeout, queueWhenBusy: t.QueueWhenBusy,
    createTime: t.CreateTime, modifyTime: t.ModifyTime, details: t.Details,
  };
}
function normTask(t) {
  if (!t) return t;
  return {
    taskId: t.TaskId, appId: t.AppId, appName: t.AppName,
    sourceName: t.SourceName, statusCode: t.Status, error: t.Error,
    createTime: t.CreateTime,
  };
}

// ================= 数据获取（REST 优先，回退 CLI） =================
async function fetchAllApps() {
  if (await restReady()) {
    const r = await cachedRest('/apps?PageIndex=1&PageSize=1000', 300000); // apps 缓存 5 分钟
    if (r.ok && r.data) {
      const items = (r.data.Items || []).map(normApp);
      if (items.length) return items;
    }
  }
  const apps = [];
  let page = 1;
  while (page <= 50) {
    const r = await cachedCli(['console', 'app', '--page', String(page), '--page-size', '100']);
    if (!r.ok) throw new Error(r.message || r.error || 'console app 调用失败');
    const items = (r.data && r.data.items) || [];
    apps.push(...items);
    if (items.length < 100) break;
    page++;
  }
  return apps;
}

async function fetchAllGroups() {
  if (await restReady()) {
    const r = await cachedRest('/app-groups', 300000); // 分组缓存 5 分钟
    if (r.ok && r.data) {
      const items = (r.data.Items || []).map(normGroup);
      if (items.length) return items;
    }
  }
  const r = await cachedCli(['console', 'app', 'group', 'list', '--app-type', 'developed']);
  if (!r.ok) throw new Error(r.message || r.error || 'app group list 调用失败');
  return (r.data && r.data.items) || [];
}

async function fetchAllTriggers() {
  if (await restReady()) {
    const r = await cachedRest('/triggers');
    if (r.ok && r.data) {
      const items = (r.data.Items || []).map(normTrigger);
      return items; // REST 一次返回全部，无需分页
    }
  }
  const r = await cachedCli(['console', 'trigger', 'list', '--type', 'all']);
  if (!r.ok) throw new Error(r.message || r.error || 'trigger list 调用失败');
  return (r.data && r.data.items) || [];
}

async function fetchCurrentAccount() {
  if (await restReady()) {
    const r = await rest('/account/current');
    if (r.ok && r.data) {
      const d = r.data;
      const a = d.Account || d.User || d;
      return {
        loggedIn: true,
        userId: a.UserId || a.Id,
        userName: a.UserName || a.Name || a.Email,
        displayName: a.DisplayName || a.NickName,
        accountType: a.AccountType,
      };
    }
  }
  const r = await cachedCli(['auth', 'current']);
  if (!r.ok || !r.data || !r.data.loggedIn) return null;
  return r.data;
}

// ================= 触发器导出 =================
async function exportTriggers() {
  const account = await fetchCurrentAccount();
  const triggers = await fetchAllTriggers();
  const backup = {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      triggerCount: triggers.length,
      sourceAccount: account ? {
        userId: account.userId,
        userName: account.userName,
        displayName: account.displayName,
        accountType: account.accountType,
      } : null,
    },
    triggers,
  };
  ensureDir(config.BACKUP_DIR);
  const ts = localTs();
  const accTag = account ? String(account.userName || account.displayName || 'unknown').replace(/[^\w@.-]/g, '_') : 'unknown';
  const fileName = `triggers_${accTag}_${ts}.json`;
  const filePath = path.join(config.BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8');
  return { ok: true, file: fileName, count: triggers.length, account: backup.meta.sourceAccount };
}

function loadBackup(fileName) {
  // 防路径穿越：只允许 backups 目录下的文件名
  const safe = path.basename(fileName);
  const filePath = path.join(config.BACKUP_DIR, safe);
  if (!fs.existsSync(filePath)) throw new Error('备份文件不存在: ' + safe);
  const backup = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!backup || !Array.isArray(backup.triggers)) throw new Error('备份文件格式不正确（缺少 triggers 数组）');
  return { backup, fileName: safe };
}

// ================= 触发器匹配 =================
async function matchTriggers(fileName) {
  const { backup } = loadBackup(fileName);
  const [targetApps, targetTriggers, account] = await Promise.all([
    fetchAllApps(),
    fetchAllTriggers(),
    fetchCurrentAccount(),
  ]);

  const byName = {};
  targetApps.forEach((a) => {
    (byName[a.appName] = byName[a.appName] || []).push(a);
  });
  const targetAppById = {};
  targetApps.forEach((a) => { targetAppById[a.appId] = a; });
  // 重复检测键：触发器名 + 目标应用名 + 类型
  const existingKeys = new Set();
  targetTriggers.forEach((t) => {
    existingKeys.add(`${t.name}|${t.appName}|${t.triggerType}`);
  });

  const matched = [], ambiguous = [], missing = [], duplicates = [];

  backup.triggers.forEach((t) => {
    const key = `${t.name}|${t.appName}|${t.triggerType}`;
    const item = {
      triggerId: t.id,
      name: t.name,
      type: t.triggerType,
      sourceAppName: t.appName,
      sourceAppId: t.appId,
      enabled: t.enabled,
      details: t.details,
      duplicate: existingKeys.has(key),
    };
    if (item.duplicate) {
      duplicates.push(item);
      return;
    }
    const candidates = byName[t.appName] || [];
    if (candidates.length === 1) {
      item.targetAppId = candidates[0].appId;
      item.targetAppName = candidates[0].appName;
      matched.push(item);
    } else if (candidates.length > 1) {
      item.candidates = candidates.map((c) => ({ appId: c.appId, appName: c.appName, updateTime: c.updateTime }));
      ambiguous.push(item);
    } else {
      item.allApps = targetApps.map((a) => ({ appId: a.appId, appName: a.appName }));
      missing.push(item);
    }
  });

  return {
    ok: true,
    backupFile: path.basename(fileName),
    sourceAccount: backup.meta.sourceAccount,
    targetAccount: account ? { userId: account.userId, userName: account.userName, displayName: account.displayName } : null,
    sameAccount: account && backup.meta.sourceAccount && account.userId === backup.meta.sourceAccount.userId,
    summary: {
      total: backup.triggers.length,
      matched: matched.length,
      ambiguous: ambiguous.length,
      missing: missing.length,
      duplicate: duplicates.length,
      targetAppCount: targetApps.length,
    },
    matched, ambiguous, missing, duplicate: duplicates,
  };
}

// ================= 触发器导入 =================
function buildAddArgs(t, targetAppId) {
  const type = (t.triggerType || t.domain || '').toLowerCase();
  const args = ['console', 'trigger'];
  if (type === 'schedule') {
    args.push('schedule', 'add', '--app-id', targetAppId, '--name', t.name, '--cron', t.details.cron);
    const et = t.details.endTime;
    if (et && !String(et).startsWith('0001-')) args.push('--end-time', et);
  } else if (type === 'email' || type === 'file' || type === 'folder' || type === 'hotkey') {
    const sub = (type === 'file' || type === 'folder') ? 'file' : type;
    args.push(sub, 'add', '--app-id', targetAppId, '--name', t.name, '--details-json', JSON.stringify(t.details));
  } else {
    return null;
  }
  if (t.enabled === false) args.push('--enabled=false');
  if (t.queueWhenBusy) args.push('--queue-when-busy');
  if (t.timeout && t.timeout > 0) args.push('--timeout', String(t.timeout));
  return args;
}

async function importTriggers(fileName, assignments, dryRun) {
  const { backup } = loadBackup(fileName);
  const results = [];
  let okCount = 0, failCount = 0, skipCount = 0;

  for (const t of backup.triggers) {
    const targetAppId = assignments ? assignments[t.id] : null;
    if (!targetAppId) {
      skipCount++;
      results.push({ name: t.name, type: t.triggerType, status: 'skipped', message: '未分配目标应用', command: '' });
      continue;
    }
    const args = buildAddArgs(t, targetAppId);
    if (!args) {
      skipCount++;
      results.push({ name: t.name, type: t.triggerType, status: 'skipped', message: '不支持的触发器类型: ' + t.triggerType, command: '' });
      continue;
    }
    const display = config.CLI_EXE + ' ' + argsToDisplay(args);
    if (dryRun) {
      results.push({ name: t.name, type: t.triggerType, status: 'dry-run', message: '预览', command: display });
      continue;
    }
    const r = await runCli(args);
    if (r.ok) {
      okCount++;
      results.push({ name: t.name, type: t.triggerType, status: 'ok', message: '创建成功', command: display, data: r.data });
    } else {
      failCount++;
      results.push({ name: t.name, type: t.triggerType, status: 'fail', message: r.message || r.error || '创建失败', command: display });
    }
  }

  if (!dryRun) clearCache(); // 导入后清空缓存，确保后续读取拿到最新触发器列表

  return {
    ok: true,
    dryRun: !!dryRun,
    summary: { total: backup.triggers.length, ok: okCount, fail: failCount, skipped: skipCount },
    results,
  };
}

module.exports = {
  normApp, normGroup, normTrigger, normTask,
  fetchAllApps, fetchAllGroups, fetchAllTriggers, fetchCurrentAccount,
  exportTriggers, loadBackup, matchTriggers, buildAddArgs, importTriggers,
};
