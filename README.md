# Deepseek Translate Tool

一个基于 Electron + Vue3 + TypeScript + Deepseek 开发的智能翻译工具，支持多种翻译场景和文件格式。

[English](./README_EN.md) | 简体中文

## ✨ 功能特性

- 🌍 支持多语言翻译
  - 支持多个主流语言之间的互译
  - 智能识别源语言
  - 支持自定义语言对

- 📝 多场景翻译
  - 文本翻译：支持单行和多行文本翻译
  - 文档翻译：支持Word、PDF等格式文档翻译
  - 字幕翻译：支持SRT、ASS等格式字幕翻译

- 💾 本地存储
  - 自动保存翻译历史
  - 支持查看和管理翻译记录
  - 支持导出翻译结果

- ⚙️ 自定义设置
  - 可配置翻译API
  - 自定义存储路径
  - 界面主题切换

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建应用

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## 📖 使用说明

1. 选择翻译类型（文本/文档/字幕）
2. 选择源语言和目标语言
3. 输入需要翻译的内容或选择需要翻译的文件
4. 点击翻译按钮开始翻译
5. 在翻译结果页面可以查看、复制或导出翻译结果

## 🛠️ 技术栈

- Electron
- Vue 3
- TypeScript
- Vuetify
- Pinia
- Vite

## 📝 开发计划

- [ ] 支持更多文件格式
- [ ] 批量翻译功能
- [ ] 翻译API负载均衡
- [ ] 离线翻译支持
- [ ] 自定义翻译模板

## 🤝 贡献指南

欢迎提交问题和改进建议！提交代码请遵循以下步骤：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 开源协议

本项目基于 MIT 协议开源 - 查看 [LICENSE](./LICENSE) 文件了解更多细节
