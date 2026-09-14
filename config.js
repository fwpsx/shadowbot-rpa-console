/**
 * 配置模块 — 支持 .env 覆盖，全部提供合理默认值
 * 优先级：环境变量 > .env 文件 > 默认值
 *
 * 用法：在项目根目录复制 .env.example 为 .env 后按需修改；
 * 或直接设置系统环境变量。
 */
const fs = require('fs');
const path = require('path');

// ---------- 极简 .env 加载器（零依赖） ----------
// 支持 KEY=VALUE、KEY="value"、# 注释、空行
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // 去掉首尾成对引号
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.join(__dirname, '.env'));

// ---------- 配置项 ----------
function env(key, fallback) {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}
function envInt(key, fallback) {
  const n = parseInt(env(key, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  // HTTP 服务
  PORT: envInt('PORT', 18923),
  HOST: env('HOST', '0.0.0.0'),   // 0.0.0.0 监听所有网卡（局域网可访问）；仅本机用 127.0.0.1

  // 目录
  HTML_PATH: path.join(__dirname, 'public', 'index.html'),
  BACKUP_DIR: env('BACKUP_DIR', path.join(__dirname, 'backups')),
  SCREENCAST_DIR: env('SCREENCAST_DIR', 'D:\\ShadowBot\\screencast'),   // 视频回放目录，按需修改

  // 影刀 CLI
  CLI_EXE: env('CLI_EXE', 'shadowbot.shell-cli.exe'),
  CLI_CWD: env('CLI_CWD', 'D:\\ShadowBot'),
  CLI_TIMEOUT: envInt('CLI_TIMEOUT', 120000),

  // 影刀本地 REST API（仅本机 127.0.0.1，通常无需修改）
  REST_HOST: env('REST_HOST', '127.0.0.1'),
  REST_PORT: envInt('REST_PORT', 42500),
  REST_BASE: '/api/v1',
  REST_TIMEOUT: envInt('REST_TIMEOUT', 4000),

  // 缓存 TTL（毫秒）
  CACHE_TTL: envInt('CACHE_TTL', 30000),
  REST_CACHE_TTL: envInt('REST_CACHE_TTL', 30000),
};
