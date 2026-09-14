/**
 * 路由聚合与分发
 *
 * 每个业务模块导出 { method, pattern, handler(req, res, match) } 数组。
 * pattern 支持字符串精确匹配或正则（用于带参数的路径）。
 */
const system = require('./system');
const apps = require('./apps');
const tasks = require('./tasks');
const auth = require('./auth');
const migration = require('./migration');

// 顺序敏感：更具体的正则路由放在前面，静态路由放后面兜底
const allRoutes = [
  ...migration.routes,
  ...auth.routes,
  ...tasks.routes,
  ...apps.routes,
  ...system.routes,
];

/**
 * 分发请求到匹配的路由。返回 true 表示已处理，false 表示未匹配。
 */
async function dispatch(req, res, pathname, method) {
  for (const route of allRoutes) {
    if (route.method && route.method !== method) continue;
    const m = pathname.match(route.pattern);
    if (!m) continue;
    await route.handler(req, res, m);
    return true;
  }
  return false;
}

module.exports = { dispatch };
