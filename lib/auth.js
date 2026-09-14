/**
 * 控制台登录鉴权（单管理员）
 *
 * 机制：.env 配置 AUTH_USER（默认 admin）+ AUTH_PASS + AUTH_TTL_DAYS（默认 7）。
 *   - AUTH_PASS 为空 = 不启用鉴权（本机单用户场景，保持开放）
 *   - AUTH_PASS 非空 = 启用账号密码登录；登录签发带过期时间的签名 token：
 *       token = `<expiresAtMs>.<hmac>`，hmac = HMAC-SHA256(expiresAtMs, key=sha256(AUTH_PASS))
 *     有效期默认 7 天，到期后前端会因 401 重新弹出登录框。
 *
 * 注意：这是本地工具的简单访问控制，密码明文存于 .env（已被 gitignore），
 *       token 经本地 HTTP 明文传输，不防中间人。
 */
const crypto = require('crypto');
const config = require('../config');

const TTL_MS = config.AUTH_TTL_DAYS * 24 * 60 * 60 * 1000;

function enabled() {
  return !!config.AUTH_PASS;
}

// 对过期时间戳签名（密钥 = 密码哈希）
function sign(expiresAt) {
  const key = crypto.createHash('sha256').update(config.AUTH_PASS).digest();
  return crypto.createHmac('sha256', key).update(String(expiresAt)).digest('hex');
}

// 签发 token：`<expiresAtMs>.<hmac>`
function issueToken() {
  const expiresAt = Date.now() + TTL_MS;
  return `${expiresAt}.${sign(expiresAt)}`;
}

// 校验请求 token：签名有效且未过期
function verify(token) {
  if (!enabled()) return true;
  if (typeof token !== 'string') return false;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return false;
  const expiresAt = parseInt(token.slice(0, idx), 10);
  const sig = token.slice(idx + 1);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return false;
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(sign(expiresAt), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// 登录校验：成功返回 { ok: true, token, expiresIn }，失败返回 { ok: false, error }
function login(username, password) {
  if (!enabled()) return { ok: true, token: null };
  if (username === config.AUTH_USER && password === config.AUTH_PASS) {
    return { ok: true, token: issueToken(), expiresIn: TTL_MS };
  }
  return { ok: false, error: '账号或密码错误' };
}

module.exports = { enabled, issueToken, verify, login };
