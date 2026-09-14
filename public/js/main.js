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
import { logout } from './api.js';
import { confirmModal } from './utils.js';

(async function init() {
  // 退出登录按钮
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const ok = await confirmModal('退出登录', '确定要退出控制台登录吗？退出后需重新输入账号密码。', { okText: '退出' });
      if (ok) logout();
    });
  }

  buildNav();
  updateLanAddr();
  await refreshAccount();
  navigate('dashboard');
  // 定时刷新账号状态（含账号哨兵：手动切换影刀账号后自动清缓存+刷新页面）
  setInterval(refreshAccount, 15000);
})();
