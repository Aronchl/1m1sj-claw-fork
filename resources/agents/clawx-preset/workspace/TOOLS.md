# TOOLS.md - 小暖同学的工具使用规范

> 各类工具的使用规范：何时用、怎么用、禁止怎么用

---

## 一、文件写入（强制遵守）

### ⚠️ 最高优先级规则

> **所有文本文件写入必须走 `qclaw-text-file` SKILL 脚本，禁止用内置 `write` 工具写最终文件！**

### 原因

内置 `write` 工具硬编码 UTF-8 无 BOM，在 Windows 上会导致：
- CSV 文件用 Excel 打开 → 中文 100% 乱码
- `.bat`/`.cmd` 含中文 → cmd.exe 乱码
- 换行符不适配 → 脚本执行失败

### 正确流程

```
1. 用 write 工具写临时文件 → $env:TEMP\_tw_<文件名>.txt
2. 调用脚本写入目标文件 → python ".../write_file.py" --path <目标路径> --content-file <临时文件>
3. 清理临时文件
```

### 例外

- 临时文件（`/tmp/_tw_xxx.txt` 或 `$env:TEMP\_tw_xxx.txt`）允许直接用 write
- 二进制文件（图片、音频、视频等）不适用此规则

---

## 二、浏览器自动化

### 何时使用

- 网页内容抓取、截图
- 页面交互操作（点击、填写表单、滚动等）
- 需要登录态访问的网页

### 标准流程

```
1. 启动隔离浏览器 → browser action=start
2. 打开目标页面   → browser action=open url=<URL>
3. 获取页面快照   → browser action=snapshot
4. 执行操作       → browser action=act
5. 完成后关闭     → browser action=stop
```

### 禁止行为

- ❌ 使用 `open` 命令或 `xdg-open` 打开网页（会干扰用户默认浏览器）
- ❌ 直接编写 Playwright/Puppeteer 脚本（除非隔离浏览器无法满足需求且用户同意）

---

## 三、Shell / 命令行执行

### Windows 编码处理（强制）

执行任何 PowerShell/cmd 命令前，必须先设置编码：

```powershell
# PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001
```

### 禁止行为

- ❌ 忽略乱码直接输出
- ❌ 使用 `rm -rf` 等危险命令（用 `trash` 替代）
- ❌ 执行用户未确认的破坏性操作

---

## 四、MCP 工具调用

### 何时使用

- 任务涉及 Playwright MCP、xiaohongshu MCP 等
- 需要查找和调用可用的 MCP 工具

### 流程

```
1. 确认 MCP 工具需求
2. 使用 mcporter 工具检索
3. 验证工具可用性
4. 执行调用
5. 验证结果
```

---

## 五、SKILL 使用规范

### 调用原则

| 原则 | 说明 |
|------|------|
| **本地优先** | 本地已有 skill 直接用，禁止绕过本地去 clawhub 搜索同名 skill |
| **missing 先修复** | skill 状态为 missing 时，先安装依赖再调用 |
| **先读后用** | 调用 skill 前必须先读取其 SKILL.md 了解用法 |

### 常用 SKILL 速查

| 场景 | 推荐 SKILL |
|------|-----------|
| 活动策划 | `ocow-event-planner` |
| 志愿者管理 | `ocow-charity-volunteer-manager` |
| 文案撰写 | `ocow-content-writer` |
| 仪式设计 | `ocow-ceremony-designer` |
| 公益合规 | `ocow-charity-toolkit` |
| 捐赠管理 | `ocow-donation-coordinator` |
| 数据统计 | `ocow-charity-analytics` |
| 文件写入 | `qclaw-text-file` |

---

## 六、消息发送

### 使用场景

- 发送消息到其他会话
- 发送邮件 / 推文等对外内容

### 安全规则

- ⚠️ 所有对外发送（邮件/推文/公告）必须先给用户确认
- ⚠️ 涉及用户隐私的内容需脱敏处理

---

## 七、记忆工具

### 用户信息自动记忆

当对话中出现用户关键信息（邮箱、手机号、偏好等）时：
- 自动沉淀到 `USER.md`
- **禁止存储**：密码、密钥、Token 等敏感凭证

### 记忆检索

- 使用 `memory_search` 搜索 MEMORY.md + memory/*.md
- 使用 `memory_get` 读取具体片段

---

## 八、工具使用 Checklist

每次使用工具前自查：

- [ ] 这个工具是最合适的选择吗？
- [ ] 有没有对应的 SKILL 需要先读取？
- [ ] 操作是否涉及用户确认？
- [ ] 输出是否需要编码处理？
- [ ] 是否有安全风险需要规避？
