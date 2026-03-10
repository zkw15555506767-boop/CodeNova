# CodeNova 🚀

**CodeNova** 是一款基于 Electron + Next.js 打造的现代化、高颜值的桌面端 AI 编程助手。它深度集成了 Anthropic 的 Claude Code 核心能力，并针对国内开发者优化了 **MiniMax-M2.5** 和 **智谱 GLM** 等顶尖大模型的接入。

---

## ✨ 核心特性

### 1️⃣ 一键闪电部署 (One-Click Setup v2)
告别复杂的终端环境配置！CodeNova 内置全自动检测与安装流程。
- **智能环境检测**: 自动探测 Node.js 环境及 Claude CLI。
- **多引擎一键映射**: 预设 MiniMax (M2.5)、智谱等路由规则，模型别名自动劫持，确保第三方 API 在官方 SDK 中完美运行。
- **沙盒隔离模式**: 凭证仅存于应用内部，不污染全局环境，支持一键同步至系统全局。

![环境扫描](https://raw.githubusercontent.com/zkw15555506767-boop/CodeNova/main/docs/setup-1.png)
![选择大脑](https://raw.githubusercontent.com/zkw15555506767-boop/CodeNova/main/docs/setup-2.png)
![配置配置](https://raw.githubusercontent.com/zkw15555506767-boop/CodeNova/main/docs/setup-3.png)

### 2️⃣ 🔌 MCP 服务器可视化管理
Model Context Protocol 原生支持，通过 UI 轻松扩展 AI 的能力边界。
- **可视化启停**: 一键开关 MCP 服务器，配置无损保留（移至 `disabledMcpServers`）。
- **参数动态解析**: 简单的空格或逗号分割即可定义启动参数。
- **环境隔离**: 为每个 MCP 单独配置环境变量。

![MCP 管理](https://raw.githubusercontent.com/zkw15555506767-boop/CodeNova/main/docs/mcp-manager.png)

### 3️⃣ 智能技能系统 (Skills)
- **卡片式管理**: 像开关灯一样管理你的 AI 技能插件。
- **一键追溯**: 直接在界面打开 Skills 源代码目录。

---

## 🛠 快速开始

### 方式一：直接下载安装包 (推荐)
前往项目的 [Release 页面](https://github.com/zkw15555506767-boop/CodeNova/releases/tag/v1.0.3) 下载最新的 **v1.0.3 版本** DMG 安装文件。
1. 下载 `CodeNova-1.0.3-arm64.dmg`。
2. 双击打开，将 **CodeNova** 图标拖拽进入 `Applications` (应用程序) 文件夹。
3. 在启动台中打开即可使用！

### 方式二：源码编译
```bash
# 克隆仓库
git clone https://github.com/zkw15555506767-boop/CodeNova.git
cd CodeNova

# 安装依赖
npm install

# 启动开发环境
npm run electron:dev

# 打包正式版
npm run electron:build
```

---

## 📝 开发者备注
本项目目前处于快速迭代期。如果你发现了 Bug 或有更好的功能建议，欢迎提交 Issue 或 Pull Request。

- **版本**: v1.0.3
- **协议**: MIT
- **作者**: CodeNova Team
