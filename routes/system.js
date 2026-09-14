/**
 * 系统类路由：健康检查、系统状态汇总、应用分组、通用 CLI 执行、缓存清除、静态资源
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const auth = require('../lib/auth');
const { rest, restReady, cachedRest } = require('../lib/rest');
const { cachedCli, isCacheable, clearCache } = require('../lib/cli');
const { sendJson, sendFile, getLanIP, readBody } = require('../lib/utils');
const { fetchAllGroups } = require('../lib/business');

// 静态资源 MIME 映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const routes = [
  // 静态首页
  { method: 'GET', pattern: /^\/(?:index\.html)?$/, handler: (req, res) => { sendFile(res, config.HTML_PATH, 'text/html; charset=utf-8'); } },

  // 静态资源（public 目录下的 css/js/图片等，支持 js/ 及 js/pages/ 子目录）
  {
    method: 'GET', pattern: /^\/([\w\-./]+\.(?:css|js|json|png|jpe?g|gif|svg|ico))$/, handler: (req, res, m) => {
      const rel = m[1];
      const publicRoot = path.join(__dirname, '..', 'public');
      const filePath = path.normalize(path.join(publicRoot, rel));
      // 防路径穿越：规范化后必须仍在 public 目录内
      if (!filePath.startsWith(publicRoot + path.sep)) {
        sendJson(res, 403, { ok: false, error: '非法路径' });
        return;
      }
      if (!fs.existsSync(filePath)) { sendJson(res, 404, { ok: false, error: '静态资源不存在: ' + rel }); return; }
      const ext = path.extname(rel).toLowerCase();
      sendFile(res, filePath, MIME[ext] || 'application/octet-stream');
    },
  },

  // 健康检查
  {
    method: 'GET', pattern: /^\/api\/health$/, handler: (req, res) => {
      sendJson(res, 200, { ok: true, service: 'rpa-console', time: new Date().toISOString(), lanIP: getLanIP(), port: config.PORT });
    },
  },

  // 控制台登录（账号 + 密码 → 签发 token）
  {
    method: 'POST', pattern: /^\/api\/login$/, handler: async (req, res) => {
      const body = JSON.parse(await readBody(req));
      const r = auth.login(body.username, body.password);
      if (r.ok) sendJson(res, 200, { ok: true, token: r.token, user: body.username });
      else sendJson(res, 401, { ok: false, error: r.error });
    },
  },

  // 通用 CLI 执行（白名单）
  {
    method: 'POST', pattern: /^\/api\/exec$/, handler: async (req, res) => {
      const body = JSON.parse(await readBody(req));
      const args = Array.isArray(body.args) ? body.args : null;
      if (!args || !args.length || typeof args[0] !== 'string') {
        sendJson(res, 400, { ok: false, error: 'args 数组必填' });
        return;
      }
      const allowed = ['auth', 'system', 'mode', 'config', 'ui', 'console', 'studio'];
      if (!allowed.includes(args[0])) {
        sendJson(res, 403, { ok: false, error: `命令不在白名单: ${args[0]}（允许: ${allowed.join(', ')}）` });
        return;
      }
      const r = await cachedCli(args, body.timeout);
      if (!isCacheable(args)) clearCache();
      sendJson(res, 200, r);
    },
  },

  // 清除缓存
  {
    method: 'POST', pattern: /^\/api\/cache\/clear$/, handler: (req, res) => {
      clearCache();
      sendJson(res, 200, { ok: true, cleared: true });
    },
  },

  // 系统状态汇总
  {
    method: 'GET', pattern: /^\/api\/system\/status$/, handler: async (req, res) => {
      let account = null, triggerCount = null, appCount = null, health = null;
      if (await restReady()) {
        const [accR, appR, trigR, stateR] = await Promise.all([
          rest('/account/current').catch(() => null),
          cachedRest('/apps?PageIndex=1&PageSize=1000', 300000).catch(() => null),
          cachedRest('/triggers', 30000).catch(() => null),
          rest('/operator/state').catch(() => null),
        ]);
        if (accR && accR.ok && accR.data) {
          const a = accR.data.Account || accR.data.User || accR.data;
          account = {
            loggedIn: true,
            userId: a.UserId || a.Id,
            userName: a.UserName || a.Name || a.Email,
            displayName: a.DisplayName || a.NickName,
            accountType: a.AccountType,
          };
        }
        if (appR && appR.ok) appCount = (appR.data.Items || []).length;
        if (trigR && trigR.ok) triggerCount = (trigR.data.Items || []).length;
        if (stateR && stateR.ok) health = stateR.data;
        sendJson(res, 200, {
          ok: true, account, health, triggerCount, appCount,
          serverTime: new Date().toISOString(), via: 'rest',
          lanIP: getLanIP(), port: config.PORT,
        });
        return;
      }
      const [accountR, healthR, appsR, triggersR] = await Promise.all([
        cachedCli(['auth', 'current']).catch(() => null),
        cachedCli(['system', 'health']).catch(() => null),
        cachedCli(['console', 'app', '--page', '1', '--page-size', '100']).catch(() => null),
        cachedCli(['console', 'trigger', 'list', '--type', 'all']).catch(() => null),
      ]);
      if (appsR && appsR.ok && appsR.data) appCount = (appsR.data.items || []).length;
      sendJson(res, 200, {
        ok: true,
        account: accountR && accountR.ok ? accountR.data : null,
        health: healthR && healthR.ok ? healthR.data : null,
        triggerCount: triggersR && triggersR.ok && triggersR.data ? (triggersR.data.items || []).length : null,
        appCount,
        serverTime: new Date().toISOString(), via: 'cli',
        lanIP: getLanIP(), port: config.PORT,
      });
    },
  },

  // 应用分组列表
  {
    method: 'GET', pattern: /^\/api\/app-groups$/, handler: async (req, res) => {
      try {
        const items = await fetchAllGroups();
        sendJson(res, 200, { ok: true, data: { items }, via: 'rest' });
      } catch (e) {
        sendJson(res, 200, { ok: false, error: e.message });
      }
    },
  },
];

module.exports = { routes };
