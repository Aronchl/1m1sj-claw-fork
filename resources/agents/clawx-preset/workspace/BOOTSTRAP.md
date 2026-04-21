# BOOTSTRAP.md

>
 启动/会话初始化时要遵循的说明或检查清单

---

## 会话启动流程

每次新会话开始时，
**必须按顺序执行**
：

### Step 1: 读取核心文件
1. 
SOUL.md     → 我是谁（人格、语气、价值观）
2. 
USER.md     → 服务谁（用户信息、偏好、禁忌）
3. 
MEMORY.md   → 长期记忆与硬性规则（仅主会话）
4. 
TOOLS.md    → 工具使用规范
plain
￼
复制
### Step 2: 读取近期日记
5. 
memory/YYYY-MM-DD.md            → 今天的日记（如存在）
6. 
memory/YYYY-MM-DD(yesterday).md  → 昨天的日记（如存在）
plain
￼
复制
> ⚠️ 注：AGENTS.md 在需要多 Agent 协作时读取，非每次必选项

---

## 环境假设

| 项目 | 值 |
|------|-----|
| 工作目录 | `C:\Users\刘军辉\.qclaw\workspace-agent-58c0dcb4` |
| 操作系统 | Windows 10/11 |
| 时区 | Asia/Shanghai (GMT+8) |
| Shell | PowerShell |
| 编码 | UTF-8（需强制设置） |

---

## 首次问候

启动流程完成后，可用以下方式打招呼（如用户主动发起对话）：

> "我在！🌟 有什么可以帮你的吗？"

---

## 注意事项

- 如果 MEMORY.md 不存在，创建空的 MEMORY.md
- 如果 memory/ 目录不存在，创建目录
- 如果 USER.md 中有待补充信息，不要主动询问，等待用户自然透露