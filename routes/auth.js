/**
 * 账号类路由：记住的账号列表、切换登录
 */
const { cachedCli, runCli, clearCache } = require('../lib/cli');
const { sendJson, readBody } = require('../lib/utils');

const routes = [
  // 记住的账号列表（REST 未暴露此路径，走 CLI + 缓存）
  {
    method: 'GET', pattern: /^\/api\/auth\/accounts$/, handler: async (req, res) => {
      const r = await cachedCli(['auth', 'account', 'list']);
      sendJson(res, 200, r);
    },
  },

  // 切换登录（免密，仅限已记住密码的账号）
  {
    method: 'POST', pattern: /^\/api\/auth\/switch$/, handler: async (req, res) => {
      const body = JSON.parse(await readBody(req));
      if (!body.username) { sendJson(res, 400, { ok: false, error: 'username 必填' }); return; }
      const r = await runCli(['auth', 'login', '--username', body.username], 180000);
      clearCache(); // 切换账号后清空所有缓存
      sendJson(res, 200, r);
    },
  },
];

module.exports = { routes };
