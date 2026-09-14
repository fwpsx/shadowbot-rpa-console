/**
 * 任务类路由：任务历史、日志、视频回放
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const { rest, restReady } = require('../lib/rest');
const { cachedCli } = require('../lib/cli');
const { sendJson } = require('../lib/utils');
const { normTask } = require('../lib/business');

const routes = [
  // 任务历史（REST 全量，前端本地分页）
  {
    method: 'GET', pattern: /^\/api\/tasks$/, handler: async (req, res) => {
      if (await restReady()) {
        const r = await rest('/tasks?PageIndex=1&PageSize=100000');
        if (r.ok && r.data) {
          const items = (r.data.Items || []).map(normTask);
          sendJson(res, 200, { ok: true, data: { items, total: items.length }, via: 'rest' });
          return;
        }
      }
      // REST 不可用回退 CLI：分页拉全量
      const all = [];
      let page = 1;
      while (page <= 100) {
        const r = await cachedCli(['console', 'task', 'history', '--page', String(page), '--page-size', '100']);
        if (!r.ok) throw new Error(r.message || r.error || 'task history 调用失败');
        const items = (r.data && r.data.items) || [];
        all.push(...items);
        if (items.length < 100) break;
        page++;
      }
      sendJson(res, 200, { ok: true, data: { items: all, total: all.length }, via: 'cli' });
    },
  },

  // 任务日志
  {
    method: 'GET', pattern: /^\/api\/tasks\/([^/]+)\/logs$/, handler: async (req, res, m) => {
      const taskId = decodeURIComponent(m[1]);
      if (await restReady()) {
        const r = await rest(`/tasks/${taskId}/logs`);
        if (r.ok && r.data) {
          const d = r.data;
          const lines = (d.Lines || []).map((l) => {
            if (typeof l === 'string') return l;
            const t = l.Time || '';
            const lv = l.Level || '';
            const msg = l.Message || l.Content || JSON.stringify(l);
            return [t, lv, msg].filter(Boolean).join('  ');
          });
          sendJson(res, 200, {
            ok: true,
            data: {
              taskId: d.TaskId,
              logs: lines,
              cursor: d.Cursor, nextCursor: d.NextCursor, hasMore: d.HasMore, cursorReset: d.CursorReset,
            },
            via: 'rest',
          });
          return;
        }
      }
      const r = await cachedCli(['console', 'task', 'logs', '--task-id', taskId]);
      sendJson(res, 200, r);
    },
  },

  // 视频回放文件查询
  {
    method: 'GET', pattern: /^\/api\/tasks\/([^/]+)\/video$/, handler: (req, res, m) => {
      const taskId = decodeURIComponent(m[1]);
      let files = [];
      try {
        const all = fs.readdirSync(config.SCREENCAST_DIR);
        files = all.filter((f) => f.includes(taskId)).map((f) => ({
          name: f,
          path: path.join(config.SCREENCAST_DIR, f),
          size: fs.statSync(path.join(config.SCREENCAST_DIR, f)).size,
        }));
      } catch { /* 目录不存在时返回空 */ }
      sendJson(res, 200, { ok: true, taskId, count: files.length, files });
    },
  },

  // 打开视频播放器
  {
    method: 'GET', pattern: /^\/api\/tasks\/([^/]+)\/video\/open$/, handler: (req, res, m) => {
      const taskId = decodeURIComponent(m[1]);
      let found = null;
      try {
        const all = fs.readdirSync(config.SCREENCAST_DIR);
        found = all.find((f) => f.includes(taskId));
      } catch { /* ignore */ }
      if (!found) { sendJson(res, 404, { ok: false, error: '未找到该任务的视频回放文件' }); return; }
      const full = path.join(config.SCREENCAST_DIR, found);
      spawn('cmd', ['/c', 'start', '', full], { detached: true, stdio: 'ignore' }).unref();
      sendJson(res, 200, { ok: true, file: found });
    },
  },
];

module.exports = { routes };
