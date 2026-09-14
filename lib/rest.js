/**
 * 影刀本地 REST API 客户端
 *
 * 影刀客户端（ShadowBot.Shell.exe）内置 EmbedIO HTTP 服务器，监听 127.0.0.1:42500，
 * 前缀 /api/v1。CLI 本质是它的封装，每条 CLI 命令有 ~1.1s 进程启动开销。
 * 直连 REST 只需 1~80ms，比 CLI 快 30~1000 倍。
 */
const http = require('http');
const config = require('../config');

/**
 * 调影刀本地 REST API，返回 { ok, status, code, data } 统一结构
 * 影刀响应体是 PascalCase 的 { Code, Message, Data }，这里转成小写便于前端使用
 */
function rest(path, method, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: config.REST_HOST, port: config.REST_PORT,
      path: config.REST_BASE + path,
      method: method || 'GET',
      timeout: config.REST_TIMEOUT,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          // 影刀标准响应 { Code, Message, Data }
          if (j && typeof j.Code !== 'undefined') {
            resolve({ ok: j.Code === 0, status: res.statusCode, code: j.Code, message: j.Message, data: j.Data });
          } else {
            resolve({ ok: true, status: res.statusCode, data: j });
          }
        } catch {
          resolve({ ok: false, status: res.statusCode, error: d.substring(0, 300) });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'TIMEOUT', error: 'REST 超时' }); });
    req.on('error', (e) => resolve({ ok: false, status: 'ERR', error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

// REST 可用性探测：可用则返回 true（首次调用时检测一次）
let REST_AVAILABLE = null;
async function restReady() {
  if (REST_AVAILABLE !== null) return REST_AVAILABLE;
  const r = await rest('/operator/state');
  REST_AVAILABLE = !!(r && r.ok);
  return REST_AVAILABLE;
}
function resetRestReady() { REST_AVAILABLE = null; }

// REST 重查询缓存（apps 全量列表返回 34KB，是 Dashboard 最慢的子查询）
// 只缓存少量稳定的大结果，写操作后清空
const REST_CACHE = new Map();
async function cachedRest(path, ttl) {
  const ttlMs = ttl || config.REST_CACHE_TTL;
  const hit = REST_CACHE.get(path);
  if (hit && Date.now() - hit.ts < ttlMs) {
    return Object.assign({ fromCache: true }, hit.data);
  }
  const r = await rest(path);
  if (r.ok) REST_CACHE.set(path, { data: r, ts: Date.now() });
  return r;
}
function clearRestCache() { REST_CACHE.clear(); }

module.exports = { rest, restReady, resetRestReady, cachedRest, clearRestCache };
