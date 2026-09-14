/**
 * 通用工具函数（零依赖）
 */
const fs = require('fs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readBody(req, limitMb) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    const limit = (limitMb || 10) * 1024 * 1024;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, code, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
}

function sendFile(res, filePath, mime) {
  fs.readFile(filePath, (err, data) => {
    if (err) { sendJson(res, 500, { ok: false, error: 'read file failed: ' + filePath }); return; }
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length });
    res.end(data);
  });
}

// 本地时间戳（YYYY-MM-DD-HH-mm），用于备份文件名（避免 UTC 慢 8 小时）
function localTs(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;
}

// 获取本机局域网 IPv4 地址（用于提示局域网访问地址）
function getLanIP() {
  try {
    const ifaces = require('os').networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) return iface.address;
      }
    }
  } catch (e) { /* 忽略 */ }
  return null;
}

function argsToDisplay(args) {
  return args.map((a) => {
    if (/[\s"]/.test(a)) return '"' + a.replace(/"/g, '\\"') + '"';
    return a;
  }).join(' ');
}

module.exports = { ensureDir, readBody, sendJson, sendFile, localTs, getLanIP, argsToDisplay };
