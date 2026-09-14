/**
 * 影刀 CLI 封装 + 缓存层（零依赖）
 */
const { execFile } = require('child_process');
const config = require('../config');
const { clearRestCache } = require('./rest');

function runCli(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(config.CLI_EXE, args, {
      timeout: timeoutMs || config.CLI_TIMEOUT,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      cwd: config.CLI_CWD,
    }, (err, stdout, stderr) => {
      if (err && !stdout) {
        resolve({ ok: false, error: err.message, stderr: (stderr || '').substring(0, 500) });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ ok: true, raw: stdout });
      }
    });
  });
}

/* ================= CLI 结果缓存层 =================
 * 根因：每条 CLI 命令固定开销 ~1.1s（进程启动 + 登录态校验）。
 * 只读命令结果在短时间内不变，加 TTL 缓存后：
 *   - 首次加载仍需等待（无法避免，CLI 进程开销在外部）
 *   - TTL 内再次导航/刷新 → 毫秒级命中缓存
 *   - 写操作（run/login/add/delete）不缓存，且执行后清空全部缓存
 */
const CLI_CACHE = new Map();
const CACHE_TTL = config.CACHE_TTL;

// 写操作 / 副作用命令：不缓存，且执行后需清除缓存
const WRITE_VERBS = /\b(run|login|switch|add|delete|update|remove|stop|cancel|logout)\b/i;

function isCacheable(args) {
  if (!args || !args.length) return false;
  const joined = args.join(' ');
  if (WRITE_VERBS.test(joined)) return false;
  return true;
}

function cacheKey(args) { return args.join('|'); }

async function cachedCli(args, timeoutMs) {
  if (isCacheable(args)) {
    const key = cacheKey(args);
    const hit = CLI_CACHE.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      return Object.assign({ fromCache: true, cacheAge: Date.now() - hit.ts }, hit.data);
    }
  }
  const r = await runCli(args, timeoutMs);
  if (isCacheable(args) && r.ok) {
    CLI_CACHE.set(cacheKey(args), { data: r, ts: Date.now() });
  }
  return r;
}

function clearCache() { CLI_CACHE.clear(); clearRestCache(); }

module.exports = { runCli, cachedCli, isCacheable, clearCache };
