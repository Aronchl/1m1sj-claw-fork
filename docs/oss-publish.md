# 发布到阿里云 OSS

应用内更新从自定义域名拉取元数据（见 `electron/main/updater.ts`）。

## 为什么不用 electron-builder 的 `publish: s3`

内置的 **app-builder `publish-s3`** 对接阿里云 OSS 时常见 **`unexpected true`** / 进程退出，属于与 OSS S3 兼容实现的互操作问题。

当前流程：

1. **`publish: generic`** + `url: https://bucketclaw.1m1sj.xin/latest`（或 `/beta`）—— 只负责在本地生成的 `*.yml` 里写入**正确的下载 URL**（与自定义域名一致）。
2. **`electron-builder --publish never`** —— 不在构建阶段上传。
3. **`zx scripts/upload-release-to-oss.mjs --prefix latest|beta`** —— 用 **`@aws-sdk/client-s3`** 把 `release/` 根目录下的产物上传到 OSS 对应前缀。脚本使用**虚拟主机访问样式**（`forcePathStyle: false`），因路径样式会触发 OSS **`SecondLevelDomainForbidden`**。

## 你需要准备的参数

| 参数 | 说明 | 示例 |
|------|------|------|
| **Bucket** | OSS Bucket 名 | `1m1sj-claw-installer` |
| **Endpoint** | 外网 Endpoint | `https://oss-cn-beijing.aliyuncs.com` |
| **Region** | SDK 用 | `oss-cn-beijing` |
| **AccessKey** | RAM 用户（勿用主账号） | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |

可选环境变量（上传脚本）：`OSS_BUCKET`、`OSS_ENDPOINT`、`AWS_REGION`（默认与上表一致）。

自定义域名需能访问 **`https://bucketclaw.1m1sj.xin/<latest|beta>/...`** 下的对象（与 `generic` 的 `url` 一致）。

## 配置在哪里

1. **`electron-builder.common.yml`**：共用构建选项，**不含** `publish`。
2. **`electron-builder.yml`**：`publish.generic.url` → `.../latest`。
3. **`electron-builder.beta.yml`**：只 **extends common**（勿 extends 主 yml，否则 `publish` 数组合并重复），`url` → `.../beta`。

## 执行命令

命名规则：**`release:<通道>:<平台>`** —— `latest` / `beta` 对应 OSS 目录。稳定通道「当前 OS」用 `release` / `release:latest`（实现上对应 `release:latest:host:steps`）；内测「当前 OS」用 `release:beta`（等同于 `release:beta:host`）。显式平台则带 `:mac` / `:win` / `:linux`。

| 通道 | 平台 | 命令 | OSS 前缀 |
|------|------|------|----------|
| 稳定 | 当前 OS | `pnpm run release` 或 `pnpm run release:latest` | `latest/` |
| 稳定 | macOS | `pnpm run release:latest:mac` | `latest/` |
| 稳定 | Windows | `pnpm run release:latest:win`（在 macOS 上交叉编译时会先 `prep:win-binaries`） | `latest/` |
| 稳定 | Linux | `pnpm run release:latest:linux` | `latest/` |
| 内测 | 当前 OS | `pnpm run release:beta`（等同于 `release:beta:host`） | `beta/` |
| 内测 | macOS | `pnpm run release:beta:mac` | `beta/` |
| 内测 | Windows | `pnpm run release:beta:win` | `beta/` |
| 内测 | Linux | `pnpm run release:beta:linux` | `beta/` |

兼容旧名：`release:steps` → `release:latest:host:steps`，`release:beta:steps` → `release:beta:host:steps`（无 `dotenv`，供 CI 在已注入环境变量时调用）。

以上带 `release:*`（非 `:steps`）的入口会 **`dotenv -e .env`** 注入密钥。仅打包不上传：

```bash
pnpm run package:beta:win
```

手动补传已有 `release/`：

```bash
dotenv -e .env -- zx scripts/upload-release-to-oss.mjs --prefix beta
```

**跳过重复上传**（与 **electron-updater GenericProvider + `AppUpdater`** 对齐，不是随便扫所有 yml）：

1. 从 **`package.json` 的 `version`** 用与 **`electron/main/updater.ts`** 相同的规则得到 **channel**（如 `0.0.1-beta.1` → `beta`，`1.0.0` → `latest`）。
2. 仅当 **`--prefix` 与 channel 一致**（例如内测包应 `--prefix beta`）时才做跳过判断；不一致则**不做**跳过检测（避免路径与 feed 语义错位）。
3. 只检查 **electron-updater 会请求的 generic 文件名**：`{channel}.yml`（Windows）、`{channel}-mac.yml`、`{channel}-linux.yml`、`{channel}-linux-arm64.yml`（与 `node_modules/electron-updater/.../Provider.js` 的 `getChannelFilePrefix` 一致）。
4. **仅在本地 `release/` 里确实存在**上述文件名之一时才参与比较；对每一个这样的文件：本地 **`version:`** 须等于 **`package.json` 的 version**，且 OSS 上同 key 的对象解析出的 **`version:`** 相同 → 视为「各平台 feed 上已是当前版本」，**整次不上传**（与客户端认为「没有更新」一致：`remote version === 已安装 version`）。否则照常上传 `release/` 根目录下全部候选文件。强制上传：`--force` 或 **`OSS_UPLOAD_FORCE=1`**。

## 构建阶段：下载 uv / Node 失败

见 `.env.example` 中 `BUNDLED_UV_BASE_URL` / `BUNDLED_NODE_BASE_URL` 与代理说明。

## Windows：无效 `CSC_LINK`

无证书时不要保留占位 `CSC_LINK`。`win.signAndEditExecutable: false` 等与无签名构建相关选项在 **`electron-builder.common.yml`**。

## macOS：签名与公证

- **`electron-builder.common.yml`**：`mac.forceCodeSigning: false`、`mac.notarize: false`，**不使用** Apple Developer ID 签名与公证（与 Windows 无签名策略一致）。
- **应用内自动更新（electron-updater / Squirrel）**在无 Developer ID 时，部分用户可能仍会看到系统对更新包的签名校验错误；需接受该限制，或引导用户手动下载 DMG/ZIP 安装。
- 若日后需要公证或可靠热更：改为 `forceCodeSigning: true`、配置 `CSC_*` / `APPLE_*`，并在 `electron-builder.yml` 中按需开启 `mac.notarize: true`。

发布前在 macOS 上会跑 **`pnpm run uv:download:release`**（或各 `release:*:steps` 内已包含），一次性拉齐 **Intel + Apple Silicon** 的 bundled `uv`，避免仅当前架构时出现 `resources/bin/darwin-x64` 缺失。

## 上传失败时

- 检查 RAM **PutObject** 等权限。
- 仍失败可用 **ossutil** 将 `release/` 下本次的 `*.yml`、`*.exe`、`*.blockmap` 等同步到 `latest/` 或 `beta/`。

## 可选：GitHub Releases

在 `publish` 中增加 `provider: github` 并设置 `GH_TOKEN`；与 OSS 上传脚本**独立**。
