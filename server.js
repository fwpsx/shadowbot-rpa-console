/**
 * ShadowBot Console Server — 影刀 RPA 网页控制台服务端
 * 零 npm 依赖：CLI 白名单代理 + 任务接口 + 触发器跨账号迁移
 *
 * 启动: node server.js  （或 npm start）
 * 访问: http://127.0.0.1:18923
 *
 * 配置：复制 .env.example 为 .env 后按需修改，或设置环境变量。
 */
const http = require('http');
const path = require('path');
const config = require('./config');
const auth = require('./lib/auth');
const { dispatch } = require('./routes');
const { sendJson } = require('./lib/utils');
const { ensureDir, getLanIP } = require('./lib/utils');

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${config.HOST}:${config.PORT}`);
  const p = url.pathname;

  // 登录鉴权：启用后 /api/* 请求需携带有效 X-Auth-Token（/api/login 除外）
  if (auth.enabled() && p.startsWith('/api/') && p !== '/api/login') {
    const token = req.headers['x-auth-token'];
    if (!auth.verify(token)) {
      sendJson(res, 401, { ok: false, error: '未授权：请先登录' });
      return;
    }
  }

  try {
    const handled = await dispatch(req, res, p, req.method);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message });
  }
});

ensureDir(config.BACKUP_DIR);
server.listen(config.PORT, config.HOST, () => {
  console.log('===========================================');
  console.log('  影刀 RPA 控制台服务已启动');
  console.log(`  本机访问: http://127.0.0.1:${config.PORT}`);
  const lan = getLanIP();
  if (lan) console.log(`  局域网访问: http://${lan}:${config.PORT}`);
  console.log(`  备份目录: ${config.BACKUP_DIR}`);
  console.log(`  视频目录: ${config.SCREENCAST_DIR}`);
  console.log('  停止服务: Ctrl+C');
  console.log('===========================================');

  // 影刀 CLI 未自动探测到、且未手动配置时的提示
  if (!path.isAbsolute(config.CLI_EXE)) {
    console.log('');
    console.log('  [警告] 未自动探测到影刀安装目录，且未手动配置 CLI_EXE/CLI_CWD。');
    console.log('         影刀 CLI 相关功能可能无法使用。');
    console.log('         请复制 .env.example 为 .env，并手动设置：');
    console.log('           CLI_EXE=D:\\你的影刀安装目录\\shadowbot.shell-cli.exe');
    console.log('           CLI_CWD=D:\\你的影刀安装目录');
    console.log('');
  }
});
