/* ============================================================
 * API 层：fetch 封装（带登录令牌）、CLI 调用、登录弹窗
 * 依赖：utils.js（el、modal）
 * ============================================================ */
import { el, modal } from './utils.js';

let AUTH_TOKEN = (() => { try { return localStorage.getItem('rpa_auth_token') || ''; } catch (e) { return ''; } })();

// 不带鉴权的请求（登录接口自身使用，避免递归）
async function rawFetch(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  return fetch(path, Object.assign({}, opts, { headers }));
}

export async function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (AUTH_TOKEN) headers['X-Auth-Token'] = AUTH_TOKEN;

  let r = await fetch(path, Object.assign({}, opts, { headers }));
  if (r.status === 401) {
    // 需要登录：弹窗输入账号密码，成功后重试一次
    const token = await promptLogin();
    if (!token) throw new Error('未授权：未登录');
    AUTH_TOKEN = token;
    try { localStorage.setItem('rpa_auth_token', token); } catch (e) { /* 忽略 */ }
    headers['X-Auth-Token'] = AUTH_TOKEN;
    r = await fetch(path, Object.assign({}, opts, { headers }));
    if (r.status === 401) {
      // 登录态失效：清除并报错，避免死循环
      AUTH_TOKEN = '';
      try { localStorage.removeItem('rpa_auth_token'); } catch (e) { /* 忽略 */ }
      throw new Error('未授权：登录失效');
    }
  }
  return r.json();
}

// 登录弹窗：账号 + 密码 → /api/login 换取 token
function promptLogin() {
  return new Promise((resolve) => {
    const userInp = el('input', { class: 'input', placeholder: '账号' });
    const passInp = el('input', { class: 'input', type: 'password', placeholder: '密码' });
    const errBox = el('div', { style: 'font-size:12px;color:var(--danger);min-height:18px;margin-top:2px' });
    let closed = false;
    const done = (v) => { if (!closed) { closed = true; resolve(v); } };
    const close = modal({
      title: '登录',
      body: el('div', { style: 'display:flex;flex-direction:column;gap:10px' },
        el('p', { style: 'font-size:13px;line-height:1.6;color:var(--muted)' }, '此服务已启用访问控制，请登录后继续。'),
        userInp, passInp, errBox,
      ),
      footer: [
        el('button', { class: 'btn btn-ghost', onclick: () => { close(); done(null); } }, '取消'),
        el('button', { class: 'btn btn-primary', onclick: submit }, '登录'),
      ],
    });
    async function submit() {
      try {
        const r = await rawFetch('/api/login', { method: 'POST', body: JSON.stringify({ username: userInp.value.trim(), password: passInp.value }) });
        const j = await r.json();
        if (j.ok && j.token) { close(); done(j.token); }
        else { errBox.textContent = j.error || '登录失败'; }
      } catch (e) { errBox.textContent = '登录失败: ' + e.message; }
    }
    passInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    setTimeout(() => userInp.focus(), 50);
  });
}

export async function cli(args) {
  const j = await api('/api/exec', { method: 'POST', body: JSON.stringify({ args }) });
  if (!j.ok) {
    const err = new Error(j.message || j.error || 'CLI 调用失败');
    err.apiCode = j.apiCode;
    throw err;
  }
  return j;
}
