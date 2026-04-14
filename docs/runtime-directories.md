# `~/.openclaw` 目录树与说明

**根路径**：`join(homedir(), '.openclaw')`（`electron/utils/paths.ts` `getOpenClawConfigDir()`）。  
**主配置位置**：默认 `~/.openclaw/openclaw.json`；若设置环境变量 `OPENCLAW_CONFIG` 为**文件路径**，则主配置在该路径，但下文仍以「数据根 `.openclaw`」为约定名。

以下 **(1)** 为完整树形（`├──` / `└──`）；**(2)** 为与树节点一一对应的**作用说明**（ClawX 仓库源码检索；**不含** OpenClaw 上游在运行时可能新增的其它目录，见文末）。

---

## (1) 目录树

```
~/.openclaw/
├── openclaw.json
├── .clawx-preinstalled-agents.json
├── .clawhub/
│   └── lock.json
├── agents/
│   └── <agentId>/
│       ├── agent/
│       │   ├── auth-profiles.json
│       │   └── models.json
│       └── sessions/
│           ├── sessions.json
│           ├── <id>.jsonl
│           ├── <id>.deleted.jsonl
│           ├── <name>.jsonl.reset.<suffix>
│           └── .openclaw-weixin-sync/
├── credentials/
│   ├── whatsapp/
│   │   └── <accountId>/
│   └── openclaw-weixin/
├── extensions/
│   ├── dingtalk/
│   │   ├── openclaw.plugin.json
│   │   ├── package.json
│   │   └── …
│   ├── wecom/
│   │   ├── openclaw.plugin.json
│   │   ├── package.json
│   │   └── …
│   ├── feishu-openclaw-plugin/
│   │   ├── openclaw.plugin.json
│   │   ├── package.json
│   │   └── …
│   ├── qqbot/
│   │   ├── openclaw.plugin.json
│   │   ├── package.json
│   │   └── …
│   ├── openclaw-weixin/
│   │   ├── openclaw.plugin.json
│   │   ├── package.json
│   │   └── …
│   ├── discord/
│   ├── telegram/
│   └── …
├── skills/
│   └── <slug>/
│       ├── SKILL.md
│       ├── .clawx-preinstalled.json
│       └── …
├── media/
│   └── outbound/
│       └── <id>.<ext>
├── workspace/
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── USER.md
│   ├── IDENTITY.md
│   ├── HEARTBEAT.md
│   ├── BOOT.md
│   └── …
├── workspace-<agentId>/
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── USER.md
│   ├── IDENTITY.md
│   ├── HEARTBEAT.md
│   ├── BOOT.md
│   └── …
├── cron/
│   └── runs/
│       └── <jobId>.jsonl
├── wecom/
│   └── reqid-map-<accountId>.json
├── qqbot/
│   └── data/
│       └── known-users.json
└── openclaw-weixin/
    ├── accounts.json
    └── accounts/
        └── <accountId>.json
```

---

## Workspace 引导文件详解（`workspace/`、`workspace-<agentId>/`）

### 工作区目录本身是干什么的

- **工作区**是 OpenClaw 给每个 Agent 配置的「文件系统根」：模型与工具在运行时常会**读这里的 Markdown 与其它文件**作为长期记忆、人设与操作说明（路径由 `openclaw.json` 里 `agents.defaults.workspace` 与各 `agents.list[].workspace` 指定，默认主区多为 `~/.openclaw/workspace`，其它 Agent 多为 `~/.openclaw/workspace-<agentId>`）。
- **与 `agents/<id>/` 的区别**：`agents/<id>/agent/` 放 **JSON 运行时**（鉴权、模型）；`workspace*` 放 **给人和模型看的说明文档、用户资料、项目文件** 等。

### 这些 `.md` 从哪来、ClawX 改动了什么

1. **首轮内容**：一般由 **OpenClaw Gateway** 在首次就绪时按上游模板**播种**完整引导文件（若文件尚不存在）。
2. **ClawX 追加片段**：应用启动后会执行 `ensureClawXContext()`（`electron/utils/openclaw-workspace.ts`）：读取打包资源里的 `resources/context/*.clawx.md`，在**目标 `*.md` 已存在**的前提下，把片段合并进同名文件（`AGENTS.clawx.md` → `AGENTS.md`，`TOOLS.clawx.md` → `TOOLS.md`）。合并使用标记 `<!-- clawx:begin -->` … `<!-- clawx:end -->`：已存在则**替换**该段，否则**追加**在文末。
3. **新建 Agent 继承主 Agent 工作区时**：若创建时选择继承，`copyBootstrapFiles` 会把主工作区里上述引导文件**拷贝**到新工作区（`electron/utils/agent-config.ts`）。
4. **修复占位文件**：若某 `.md` **只有** ClawX 标记段、没有其它正文，会被 `repairClawXOnlyBootstrapFiles()` **删除**，以便 Gateway 下次用完整模板重新播种。

### 七个固定文件名的常见分工（OpenClaw 约定 + 本仓库行为）

下列文件名来自 ClawX 常量 `AGENT_BOOTSTRAP_FILES`（`electron/utils/agent-config.ts`）。**语义以 OpenClaw 加载逻辑为准**；下表便于理解与编辑。

| 文件 | 常见用途（OpenClaw 侧） | ClawX 在本仓库中的额外行为 |
|------|-------------------------|----------------------------|
| **AGENTS.md** | 描述 Agent 如何协作、任务边界、对用户的总体行为准则（多 Agent / 子任务时常用）。 | 合并 `resources/context/AGENTS.clawx.md`：标明 ClawX 桌面端身份，并提示阅读 `TOOLS.md`。 |
| **SOUL.md** | 「灵魂」层：人格、语气、价值观、回答风格，偏感性长期设定。 | 无专用 `.clawx.md`；内容由 Gateway 模板与用户维护为主。 |
| **TOOLS.md** | 各类**工具**的使用规范：何时用、怎么用、禁止怎么用（含浏览器、Shell、文件等）。 | 合并 `resources/context/TOOLS.clawx.md`：强调使用捆绑 **uv**（勿裸用 `python`/`pip`）、**browser** 工具的标准流程（start → snapshot → act）及与 `openExternal` 的分工。 |
| **USER.md** | **终端用户**侧信息：称呼、偏好、禁忌、常驻上下文（如职业、时区），便于模型个性化回复。 | 无专用 `.clawx.md`。 |
| **IDENTITY.md** | Agent **对外身份**：名称、角色定位、自我介绍要点（与 SOUL 偏「怎么说」、IDENTITY 偏「我是谁」可配合使用）。 | 无专用 `.clawx.md`。 |
| **HEARTBEAT.md** | OpenClaw 会话层与**周期性自检 / 心跳类提示**相关的说明（与 Gateway 的 WebSocket `ping/pong` **不是同一概念**：后者是连接保活，见网关 `connection-monitor`）。 | 无专用 `.clawx.md`。 |
| **BOOT.md** | **启动 / 会话初始化**时要遵循的说明或检查清单（例如环境假设、必须先读哪些文件）。 | 无专用 `.clawx.md`。 |

### 其它可能出现在工作区里的内容

- 除上表外，工作区还可包含**任意** `.md`、代码、数据文件等；Skills 也可能从工作区发现技能（README 中「managed dir、workspace、extra skill dirs」多源）。  
- 具体哪些文件会被 OpenClaw 注入上下文，以 **OpenClaw 版本与配置**为准。

---

## (2) 逐项说明（路径 → 作用）

| 路径 | 作用 |
|------|------|
| `~/.openclaw/` | OpenClaw / Gateway 用户数据根；channel-config 等在首次写入配置前可能创建该目录。 |
| `openclaw.json` | 主配置：agents、channels、skills、gateway、providers、bindings 等；ClawX 多处读写与 sanitize（openclaw-auth、channel-config、skill-config、reload-policy 等）。 |
| `.clawx-preinstalled-agents.json` | ClawX 预装 Agent 版本标记：仅对带标记的受管 Agent 进行升级覆盖；无标记视为用户自管，不会被预装逻辑覆盖（agent-config）。 |
| `.clawhub/` | ClawHub CLI 工作时的锁目录。 |
| `.clawhub/lock.json` | 防止并发安装/卸载技能等操作冲突（`electron/gateway/clawhub.ts`）。 |
| `agents/` | 按 Agent ID 存放运行时与会话数据。 |
| `agents/<agentId>/` | 单个 Agent 的 `agent/`（模型与鉴权）与 `sessions/`（会话）根；删除 Agent 时整目录可删（`agent-config`）。 |
| `agents/<agentId>/agent/` | Agent 私有运行时目录，默认等价于 `~/.openclaw/agents/<id>/agent`。 |
| `agents/<agentId>/agent/auth-profiles.json` | 各 Provider 的 API Key / OAuth 等鉴权配置（openclaw-auth、device-oauth 等）。 |
| `agents/<agentId>/agent/models.json` | 该 Agent 的模型选用等持久化（openclaw-auth）。 |
| `agents/<agentId>/sessions/` | 会话转录与索引目录。 |
| `agents/<agentId>/sessions/sessions.json` | 会话列表/键与转录文件名的映射；删除会话、cron 读会话等使用（sessions 路由、cron 路由、ipc-handlers）。 |
| `agents/<agentId>/sessions/<id>.jsonl` | 会话 JSONL 转录正文（聊天与工具记录）。 |
| `agents/<agentId>/sessions/<id>.deleted.jsonl` | 在 UI/API 删除会话时，将原 `.jsonl` 重命名而来，表示已删除会话（sessions 路由）。 |
| `agents/<agentId>/sessions/<name>.jsonl.reset.<suffix>` | 会话重置/分支类转录命名；用量统计仍会扫描（token-usage-core）。 |
| `agents/<agentId>/sessions/.openclaw-weixin-sync/` | 遗留微信同步目录（channel-config `LEGACY_WECHAT_SYNC_DIR`，与旧 `default` 会话布局相关）。 |
| `credentials/` | 渠道登录凭据根（与 `extensions` 内插件并存）。 |
| `credentials/whatsapp/<accountId>/` | WhatsApp（Baileys）多文件登录态目录（whatsapp-login）。 |
| `credentials/openclaw-weixin/` | 遗留微信凭据目录（channel-config `LEGACY_WECHAT_CREDENTIALS_DIR`）。 |
| `extensions/` | OpenClaw 插件扩展根；启动时从安装包同步渠道插件至此（plugin-install、config-sync）。 |
| `extensions/dingtalk/` | 钉钉渠道插件目录（CHANNEL_PLUGIN_MAP）。 |
| `extensions/wecom/` | 企业微信渠道插件目录。 |
| `extensions/feishu-openclaw-plugin/` | 飞书渠道插件目录（与 `openclaw-lark` 包对应）。 |
| `extensions/qqbot/` | QQ 机器人渠道插件目录。 |
| `extensions/openclaw-weixin/` | 微信渠道插件目录（与 `openclaw-weixin` 渠道类型对应）。 |
| `extensions/<插件名>/openclaw.plugin.json` | 插件清单（id、版本、入口等）；用于安装校验与 channel 解析。 |
| `extensions/<插件名>/package.json` | npm 包元数据；config-sync 可读版本号。 |
| `extensions/<插件名>/…` | 插件自身代码、node_modules、资源等（随插件变化）。 |
| `extensions/discord/`、`extensions/telegram/` | 若曾被旧版本拷入，启动时会被**整目录删除**，以免覆盖内置实现（config-sync `BUILTIN_CHANNEL_EXTENSIONS`）；**非正常长期保留结构**。 |
| `skills/` | 技能包根；ClawX 预装技能、ClawHub 安装技能均落此（skill-config、README）。 |
| `skills/<slug>/` | 单个技能目录（slug 为技能 id）。 |
| `skills/<slug>/SKILL.md` | 技能主文档（必须）。 |
| `skills/<slug>/.clawx-preinstalled.json` | ClawX 预装技能版本标记，用于升级时强覆盖策略（skill-config）。 |
| `skills/<slug>/…` | 技能附带的脚本、资源等。 |
| `media/` | 媒体相关根。 |
| `media/outbound/` | 发往渠道前的文件暂存（files 路由、ipc-handlers）。 |
| `media/outbound/<id>.<ext>` | 单次外发任务的临时文件。 |
| `workspace/` | 默认主 Agent 工作区目录（路径可由 `openclaw.json` 修改；未配置时常为 `~/.openclaw/workspace`）。 |
| `workspace/AGENTS.md` … `BOOT.md` | 七个引导文件名见上文 **「Workspace 引导文件详解」**；Gateway 播种 + ClawX 对 `AGENTS.md` / `TOOLS.md` 合并 `resources/context/*.clawx.md`。 |
| `workspace/…` | 用户、技能或工具在工作区下的其它任意文件（不限于七个 `.md`）。 |
| `workspace-<agentId>/` | 非 main Agent 的独立工作区（agent-config 默认 `~/.openclaw/workspace-<id>`，仍以配置为准）。 |
| `workspace-<agentId>/（同上各 .md）` | 与同目录名的主工作区相同机制，**按 Agent 隔离**各自人设与文件。 |
| `cron/` | 定时任务相关根。 |
| `cron/runs/` | 定时任务每次运行的 JSONL 日志目录（cron 路由）。 |
| `cron/runs/<jobId>.jsonl` | 单个定时任务 job 的运行记录。 |
| `wecom/` | 企业微信插件落盘数据（与 `extensions/wecom` 不同：此处为运行期映射数据）。 |
| `wecom/reqid-map-<accountId>.json` | 企业微信 reqId 与聊天目标等映射，供目标列表/路由（channels 路由）。 |
| `qqbot/` | QQ 机器人插件侧数据根。 |
| `qqbot/data/` | QQ 机器人持久化数据子目录。 |
| `qqbot/data/known-users.json` | 已知的用户/群等缓存，供目标选项（channels 路由）。 |
| `openclaw-weixin/` | 微信渠道（插件 id `openclaw-weixin`）账号状态根，与 `extensions/openclaw-weixin` 不同。 |
| `openclaw-weixin/accounts.json` | 已登录账号 id 列表（wechat-login、channel-config）。 |
| `openclaw-weixin/accounts/` | 各账号详细状态目录。 |
| `openclaw-weixin/accounts/<accountId>.json` | 该微信账号 token、baseUrl、userId 等（wechat-login）。 |

---

## OpenClaw Gateway 可能额外创建的条目

ClawX 仓库**未**枚举 OpenClaw 运行时全部落盘路径。实际使用后还可能出现例如缓存、索引、渠道专属子目录等，**以 OpenClaw 官方文档与本机 `~/.openclaw` 为准**。若需 100% 机械清单，可在安装运行后对本目录执行 `find` 并与上游版本对照。
