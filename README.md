# 影刀 RPA 网页控制台

零 npm 依赖的影刀 RPA 控制台服务端 + 单文件控制台前端，含触发器跨账号迁移功能。

## 功能模块

| 模块 | 说明 |
|------|------|
| 仪表盘 | 账号信息、系统状态、应用/触发器/消息/扩展数量统计、本机/局域网访问地址 |
| 应用管理 | 搜索、分组、分页、运行（异步）、跳转任务 |
| 任务管理 | 历史记录、状态筛选、日志查看、视频回放、停止/重跑 |
| 触发器管理 | 全部/定时/邮件/文件夹/热键分类、启用/禁用开关、新增/编辑/删除 |
| 触发器迁移 | 跨账号导出 → 名称匹配 → 人工映射兜底 → dry-run 预览 → 批量导入 |
| 消息中心 | 已读/未读、标记已读、全部已读 |
| 扩展管理 | 扩展列表与安装状态 |
| 系统设置 | 配置管理、console/assistant 模式切换 |

## 目录结构

```
├── server.js              # 服务入口（精简）
├── config.js              # 配置加载（.env + 默认值）
├── .env.example           # 配置模板（脱敏，复制为 .env 使用）
├── lib/
│   ├── utils.js           # 通用工具
│   ├── rest.js            # 影刀 REST 客户端
│   ├── cli.js             # CLI 封装 + 缓存
│   └── business.js        # 业务逻辑（导出/匹配/导入）
├── routes/
│   ├── index.js           # 路由聚合与分发
│   ├── system.js          # 健康检查/状态/分组/CLI 执行
│   ├── apps.js            # 应用
│   ├── tasks.js           # 任务/日志/视频
│   ├── auth.js            # 账号
│   └── migration.js       # 触发器迁移
├── public/
│   ├── index.html         # 页面骨架
│   ├── style.css          # 样式
│   └── app.js             # 前端逻辑
├── Dockerfile             # 可选 Docker 部署
├── docker-compose.yml     # 可选 Docker Compose
├── start.bat / stop.bat   # Windows 一键启停
├── start.sh / stop.sh     # Linux/Mac 一键启停
└── backups/               # 触发器备份目录（已被 .gitignore 排除）
```

## 快速开始

### 前置条件

- 影刀 RPA 客户端已安装并登录
- `shadowbot.shell-cli.exe` 在 PATH 中（默认随客户端附带）
- Node.js ≥ 16（无需任何 npm 依赖）

### 方式一：一键脚本（推荐）

**Windows**：
- 启动：双击 `start.bat`
- 停止：双击 `stop.bat`

**Linux / Mac**：
```bash
chmod +x start.sh stop.sh
./start.sh          # 启动
./stop.sh           # 停止
```

### 方式二：命令行

```bash
node server.js
# 或
npm start
```

访问 `http://127.0.0.1:18923`（局域网访问地址会在页面侧边栏和仪表盘显示）。

### 方式三：Docker（可选）

> ⚠️ 说明：影刀客户端（CLI 与本地 REST API 42500）运行在 Windows 宿主机且仅监听 127.0.0.1，
> 容器内无法直接访问。Docker 方式主要用于统一运行环境/简化分发的场景，
> 一般建议直接在 Windows 宿主机运行。

```bash
docker compose up -d --build
```

## 配置

复制 `.env.example` 为 `.env` 后按需修改（`.env` 已被 `.gitignore` 排除，不会提交）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `18923` | 监听端口 |
| `HOST` | `0.0.0.0` | `0.0.0.0` 局域网可访问，`127.0.0.1` 仅本机 |
| `CLI_EXE` | `shadowbot.shell-cli.exe` | CLI 可执行文件名 |
| `CLI_CWD` | `D:\ShadowBot` | 影刀安装目录 |
| `SCREENCAST_DIR` | `D:\ShadowBot\screencast` | 视频回放目录 |
| `BACKUP_DIR` | 项目下 `backups/` | 备份存储目录 |
| `REST_HOST` / `REST_PORT` | `127.0.0.1` / `42500` | 影刀本地 REST API |

也可通过环境变量直接设置（Docker 用 `-e` 传入）。

## 触发器迁移工作流

1. **导出/上传备份**：在源账号登录态下点击"导出当前账号触发器"，或上传已有备份 JSON
2. **切换账号**：在记住的账号列表中选择目标账号并切换（免密登录），或手动在影刀客户端切换后刷新
3. **匹配确认**：按应用名称自动匹配 → 重名应用人工选择 → 未匹配手动指定或跳过 → 已存在同名触发器默认跳过
4. **执行导入**：dry-run 预览命令列表 → 确认后正式导入 → 逐条结果报告

### 注意事项

- 邮件触发器导出数据不含 IMAP 授权码（影刀 DPAPI 加密），导入后需手动填写
- 热键触发器通过 `details-json` 创建，如失败会在结果中显示原因
- 同一台电脑同一时刻只能登录一个账号，导出与导入必须串行完成

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 控制台页面 |
| GET | `/api/health` | 健康检查（含局域网 IP） |
| POST | `/api/exec` | 通用 CLI 执行（白名单） |
| POST | `/api/cache/clear` | 清除缓存 |
| GET | `/api/system/status` | 系统状态汇总 |
| GET | `/api/app-groups` | 应用分组列表 |
| GET | `/api/apps` | 应用列表 |
| GET | `/api/tasks` | 任务历史 |
| GET | `/api/tasks/:id/logs` | 任务日志 |
| GET | `/api/tasks/:id/video` | 视频回放文件查询 |
| GET | `/api/tasks/:id/video/open` | 打开视频播放器 |
| GET | `/api/auth/accounts` | 记住的账号列表 |
| POST | `/api/auth/switch` | 切换账号（免密） |
| POST | `/api/migration/export` | 导出当前账号触发器 |
| GET | `/api/migration/backups` | 列出备份文件 |
| POST | `/api/migration/backups/delete` | 删除备份文件 |
| POST | `/api/migration/backups/upload` | 上传备份文件 |
| POST | `/api/migration/match` | 名称匹配 |
| POST | `/api/migration/import` | 导入（支持 dry-run） |


## License

MIT
