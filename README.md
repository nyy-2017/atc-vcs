# 空管语音通信交换系统 ATC-VCS

面向塔台 / 进近 / 区域管制 / 机坪管制的**地空话音交换与调度**演示系统，包含前端、后端与本地持久化数据库，开箱即可运行。

- 前端：Vue 3 + Ant Design Vue 4 + Vite 6 + Pinia + Vue Router + ECharts
- 后端：Node.js + Express，SSE 实时推送，内置通信流模拟引擎
- 数据库：本地 **SQLite**（Node 22 内置 `node:sqlite`，无需编译原生模块），文件位于 `server/data/atc-vcs.db`

---

## 快速开始

```bash
# 1. 安装依赖（首次）
npm run setup

# 2A. 开发模式（后端 :3001 + 前端 :5180 热更新）
npm run dev

# 2B. 生产模式（构建前端并由后端统一托管）
npm run serve
```

打开 <http://localhost:3001>（生产模式）或 <http://127.0.0.1:5180>（开发模式）。

### 演示账号

| 用户名 | 密码 | 角色 | 说明 |
| --- | --- | --- | --- |
| `admin` | `admin123` | 系统管理员 | 全部权限，可清理日志 |
| `supervisor` | `super123` | 主任管制员 | 监控、告警处置 |
| `controller` | `ctrl123` | 管制员 | 通信指挥台操作 |

> 数据库首次启动自动建表并注入 12 条信道、8 个席位、200+ 条通话记录、告警与审计日志。执行 `npm run reset` 可清空并重新生成演示数据。

---

## 界面预览

| 登录 | 运行总览 |
| --- | --- |
| ![登录](docs/screenshots/00-login.png) | ![运行总览](docs/screenshots/01-dashboard.png) |

| 通信指挥台（通话中） | 信道频率管理 |
| --- | --- |
| ![通信指挥台](docs/screenshots/02-console.png) | ![信道频率管理](docs/screenshots/03-channels.png) |

| 席位管理 | 通话记录 |
| --- | --- |
| ![席位管理](docs/screenshots/04-positions.png) | ![通话记录](docs/screenshots/05-calls.png) |

| 告警中心 | 系统设置 |
| --- | --- |
| ![告警中心](docs/screenshots/06-alarms.png) | ![系统设置](docs/screenshots/07-settings.png) |

---

## 功能模块

| 模块 | 说明 |
| --- | --- |
| 运行总览 | 今日通话 / 活动链路 / 在位席位 / 信道占用 / 语音质量 / 待处理告警；24 小时业务趋势、信道状态环形图、扇区分布、实时通话与告警列表 |
| 通信指挥台 | 席位选择、信道切换（主用/备用/应急快捷切换）、建立与结束通话、按住 PTT 发话（支持空格键）、实时计时与波形、语音质量评估、实时事件流 |
| 信道频率管理 | 信道 CRUD、频率/频段/功率/覆盖/静噪维护、置忙/置闲、今日话务量统计 |
| 席位管理 | 席位 CRUD、扇区与类型维护、绑定默认信道、在位状态切换、耳机状态 |
| 通话记录 | 多条件检索（编号/呼号/管制员/状态/席位/信道/日期）、服务端分页、详情抽屉与录音波形回放、CSV 导出 |
| 告警中心 | 按级别汇总、确认 / 清除 / 删除、人工上报，SSE 实时刷新 |
| 用户与权限 | 三级角色（管理员 / 主任管制员 / 管制员）、绑定席位、启停账号、重置密码 |
| 操作日志 | 登录、调度、配置变更等操作全量留痕，支持按模块与日期检索（管理员可清理） |
| 系统设置 | 系统名称、台站、录音保留天数、PTT 超时、质量阈值、主备自动切换与告警声音开关 |

---

## 目录结构

```
atc-vcs/
├─ package.json            # 根级脚本（setup / dev / build / serve / reset）
├─ scripts/dev.js          # 同时拉起后端与 Vite 开发服务器
├─ docs/screenshots/       # 界面截图（README 预览用）
├─ server/                 # 后端服务
│  ├─ src/
│  │  ├─ index.js          # Express 入口、路由挂载、SSE、静态托管
│  │  ├─ db.js             # SQLite 建表、索引、种子数据
│  │  ├─ auth.js           # 令牌签发与校验中间件
│  │  ├─ callService.js    # 通话建立/结束/PTT 业务逻辑
│  │  ├─ simulator.js      # 通信流模拟引擎（通话、告警、电平）
│  │  ├─ realtime.js       # SSE 广播中心
│  │  ├─ util.js           # 时间格式、令牌签名等工具
│  │  └─ routes/           # auth / overview / positions / channels / calls / alarms / users / logs
│  └─ data/atc-vcs.db      # 本地 SQLite 数据库（自动生成）
└─ web/                    # 前端工程
   ├─ src/
   │  ├─ api/              # fetch 封装 + SSE 客户端
   │  ├─ store/auth.js     # Pinia 登录态
   │  ├─ router/           # 路由与登录守卫
   │  ├─ layouts/          # 侧边栏 + 顶栏骨架
   │  ├─ components/       # 统计卡、状态徽标、ECharts 包装
   │  ├─ views/            # 9 个业务页面
   │  └─ utils/dict.js     # 状态字典与格式化
   └─ dist/                # 构建产物（由后端托管）
```

---

## 数据模型

| 表 | 说明 |
| --- | --- |
| `users` | 账号、角色、绑定席位、状态、最近登录 |
| `positions` | 席位编号、扇区、类型、默认信道、值守人、在位状态 |
| `channels` | 信道编号、频率、频段、类型、状态、功率、覆盖范围 |
| `calls` | 通话编号、席位/信道快照、呼号、方向、起止时间、时长、PTT 次数、质量分 |
| `alarms` | 级别、来源、告警码、内容、状态、确认人 |
| `logs` | 操作人、模块、动作、详情、来源 IP |
| `metrics` | 小时级话务指标（趋势备用数据） |
| `settings` | 系统配置键值对 |

---

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 登录，返回令牌与用户信息 |
| GET | `/api/overview` | 总览统计、趋势、分布、最近记录 |
| GET | `/api/stream?token=` | SSE 实时事件（tick / call / alarm / channel / position） |
| GET/POST/PUT/DELETE | `/api/channels` `/api/positions` `/api/users` | 基础资料 CRUD |
| POST | `/api/calls/start` | 建立通话（占用信道 + 席位置忙） |
| POST | `/api/calls/:id/ptt` | PTT 计数与电平刷新 |
| POST | `/api/calls/:id/end` | 结束通话并回写时长与质量 |
| GET | `/api/calls` | 分页检索通话记录 |
| GET | `/api/calls/export` | 导出 CSV（UTF-8 BOM） |
| POST | `/api/alarms/:id/ack` `/clear` | 告警确认与清除 |
| GET/DELETE | `/api/logs` | 审计日志查询与清理 |

除登录与健康检查外，所有接口需携带 `Authorization: Bearer <token>`。

---

## 环境要求

- Node.js **≥ 22.5**（依赖内置 `node:sqlite`）
- 默认端口 3001（后端）、5180（Vite），可通过环境变量 `PORT` 调整后端端口
- 模拟引擎心跳间隔可用 `SIM_INTERVAL` 调整（毫秒，默认 6000）
