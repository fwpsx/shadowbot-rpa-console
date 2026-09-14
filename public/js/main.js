/* ============================================================
 * 入口：副作用 import 各页面模块（触发 register 注册），
 * 然后构建导航并启动到仪表盘。
 * ============================================================ */
import './pages/dashboard.js';
import './pages/apps.js';
import './pages/tasks.js';
import './pages/triggers.js';
import './pages/migration.js';
import './pages/groupSync.js';
import './pages/messages.js';
import './pages/extensions.js';
import './pages/settings.js';

import { buildNav, navigate, refreshAccount, updateLanAddr } from './router.js';

(async function init() {
  buildNav();
  updateLanAddr();
  await refreshAccount();
  navigate('dashboard');
  // 定时刷新账号状态
  setInterval(refreshAccount, 60000);
})();
