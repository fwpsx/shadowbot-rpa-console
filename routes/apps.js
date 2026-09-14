/**
 * 应用类路由：应用列表
 */
const { sendJson } = require('../lib/utils');
const { fetchAllApps } = require('../lib/business');

const routes = [
  {
    method: 'GET', pattern: /^\/api\/apps$/, handler: async (req, res) => {
      try {
        const items = await fetchAllApps();
        sendJson(res, 200, { ok: true, data: { items, total: items.length }, via: 'rest' });
      } catch (e) {
        sendJson(res, 200, { ok: false, error: e.message });
      }
    },
  },
];

module.exports = { routes };
