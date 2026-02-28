# CodeNova

桌面端 AI 编程助手 - Claude Code 的可视化客户端

## 功能特性

- 🤖 **AI 对话** - 实时流式响应，支持 Markdown 渲染和代码高亮
- 📁 **项目感知** - 右侧面板展示文件树和文件预览
- 🎨 **主题切换** - 浅色/深色/渐变三种主题可选
- 💬 **多模式** - 对话模式 / 代码模式 / 规划模式
- 🔄 **模型切换** - 支持 Opus / Sonnet / Haiku 模型
- 📱 **桌面集成** - 系统托盘、窗口管理、全局快捷键

## 技术栈

- **框架**: Next.js 16 (App Router)
- **桌面**: Electron 40
- **UI**: Radix UI + Tailwind CSS
- **数据库**: SQLite (better-sqlite3)
- **AI**: Claude Agent SDK

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# Electron 开发
npm run electron:dev
```

## 环境要求

- Node.js 18+
- npm 9+

## 许可证

MIT
