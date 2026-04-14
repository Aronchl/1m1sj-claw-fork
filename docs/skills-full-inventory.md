# ClawX 技能整理（内置 + 当前已安装市场）

## 统计口径（已修正）

- 数据来源：`~/.openclaw/openclaw.json` 的 `skills.entries`（当前环境）
- 当前总数：**70**
- 内置技能：**8**（来自 `resources/skills/preinstalled-manifest.json`）
- 当前已安装市场技能：**62**（总数 - 内置）

> 说明：  
> - “内置技能”这里按 ClawX 预装清单定义。  
> - “市场技能”这里指你当前环境已安装且不在内置清单中的技能。  
> - 作用说明分为“高置信”和“推断”两档。

## 一、内置技能（8）

| Skill | 作用 | 置信度 |
|---|---|---|
| `pdf` | PDF 文档解析与问答 | 高（preinstalled） |
| `xlsx` | Excel 表格解析与处理 | 高（preinstalled） |
| `docx` | Word 文档解析与处理 | 高（preinstalled） |
| `pptx` | PPT 文档解析与处理 | 高（preinstalled） |
| `find-skills` | 搜索/发现可安装技能 | 高（preinstalled） |
| `self-improving-agent` | 自我改进型 Agent 能力 | 高（preinstalled） |
| `tavily-search` | Tavily 联网搜索（需 `TAVILY_API_KEY`） | 高（preinstalled + README） |
| `brave-web-search` | Brave 联网搜索（需 `BRAVE_SEARCH_API_KEY`） | 高（preinstalled + README） |

## 二、当前已安装市场技能（62）

| Skill | 作用 | 置信度 |
|---|---|---|
| `1password` | 1Password 密钥/密码管理集成 | 高（bundle: security） |
| `apple-notes` | Apple Notes 笔记读写/检索 | 高（bundle: productivity） |
| `apple-reminders` | Apple Reminders 提醒事项管理 | 高（bundle: productivity） |
| `bear-notes` | Bear 笔记应用集成 | 推断 |
| `blogwatcher` | 订阅博客/站点更新监控 | 高（bundle: information） |
| `blucli` | 蓝牙/本机设备相关 CLI 能力 | 推断 |
| `bluebubbles` | BlueBubbles/iMessage 桥接能力 | 推断 |
| `camsnap` | 摄像头抓拍/图像采集 | 推断 |
| `clawhub` | ClawHub 市场相关能力（搜索/安装协助） | 推断 |
| `coding-agent` | 代码任务代理（生成/重构/解释） | 高（bundle: developer） |
| `discord` | Discord 消息与频道操作 | 高（bundle: communication） |
| `eightctl` | `eightctl` 系统控制接口 | 推断 |
| `feishu-bitable` | 飞书多维表格操作 | 推断 |
| `feishu-calendar` | 飞书日历查询/创建日程 | 推断 |
| `feishu-channel-rules` | 飞书频道规则管理 | 推断 |
| `feishu-create-doc` | 飞书文档创建 | 推断 |
| `feishu-fetch-doc` | 飞书文档读取 | 推断 |
| `feishu-im-read` | 飞书 IM 消息读取 | 推断 |
| `feishu-task` | 飞书任务管理 | 推断 |
| `feishu-troubleshoot` | 飞书故障排查 | 推断 |
| `feishu-update-doc` | 飞书文档更新 | 推断 |
| `gemini` | Gemini 模型/服务相关调用 | 推断 |
| `gh-issues` | GitHub Issues 查询与处理 | 推断（命名清晰） |
| `gifgrep` | GIF/动图内容检索 | 推断 |
| `github` | GitHub 通用能力（仓库/PR/Issue） | 高（bundle: developer） |
| `gog` | GOG 平台相关能力 | 推断 |
| `goplaces` | 地理位置检索/推荐 | 推断 |
| `gstack-openclaw` | OpenClaw 相关增强/集成能力 | 推断 |
| `healthcheck` | 服务/任务健康检查 | 推断 |
| `himalaya` | 邮件工作流（Himalaya） | 高（bundle: productivity） |
| `imsg` | iMessage 消息能力 | 高（bundle: communication） |
| `mcporter` | MCP/服务迁移导出类工具 | 推断 |
| `model-usage` | 模型调用/Token 使用统计 | 推断 |
| `nano-pdf` | 轻量 PDF 处理能力 | 推断 |
| `node-connect` | Node 运行时/服务连接能力 | 推断 |
| `notion` | Notion 页面/数据库操作 | 高（bundle: productivity） |
| `obsidian` | Obsidian 知识库读写检索 | 高（bundle: productivity） |
| `openai-whisper` | Whisper 语音转文本 | 推断 |
| `openai-whisper-api` | OpenAI Whisper API 语音转文本 | 高（bundle: media） |
| `openhue` | Philips Hue 智能灯控制 | 高（bundle: smart-home） |
| `oracle` | Oracle/数据库相关能力 | 推断 |
| `ordercli` | 订单类流程处理 CLI | 推断 |
| `peekaboo` | 屏幕/窗口内容查看工具 | 推断 |
| `sag` | 任务规划/Agent 辅助工具 | 推断 |
| `self-improvement` | Agent 自我改进/反思迭代 | 推断 |
| `session-logs` | 会话日志读取分析 | 推断 |
| `sherpa-onnx-tts` | ONNX TTS 语音合成 | 推断（命名清晰） |
| `skill-creator` | 技能创建脚手架 | 推断 |
| `slack` | Slack 消息与频道操作 | 高（bundle: communication） |
| `songsee` | 音乐识别/音频理解能力 | 推断 |
| `sonoscli` | Sonos 设备控制 | 高（bundle: smart-home） |
| `spotify-player` | Spotify 播放控制 | 高（bundle: smart-home） |
| `summarize` | 通用摘要能力 | 高（bundle: information） |
| `things-mac` | Things（Mac 任务管理）集成 | 推断 |
| `tmux` | tmux 终端会话管理 | 高（bundle: developer） |
| `trello` | Trello 看板任务管理 | 高（bundle: productivity） |
| `video-frames` | 视频抽帧/关键帧处理 | 高（bundle: media） |
| `voice-call` | 语音通话能力 | 高（bundle: communication） |
| `wacli` | WhatsApp/WA CLI 能力 | 推断 |
| `weather` | 天气查询 | 高（bundle: information） |
| `web-search` | 通用 Web 搜索 | 推断 |
| `xurl` | URL 抓取/请求/解析 | 推断 |

## 三、备注

- 推荐包（`resources/skills/bundles.json`）里有 25 个技能，属于“推荐可安装集合”；不等于你当前已安装集合。
- 你当前集合里出现了 `gstack-openclaw`，这项是之前文档遗漏，现已补齐。
