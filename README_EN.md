# Deepseek Translate Tool

An intelligent translation tool developed with Electron + Vue3 + TypeScript + Deepseek, supporting multiple translation scenarios and file formats.

English | [简体中文](./README.md)

## ✨ Features

- 🌍 Multi-language Support
  - Translation between major languages
  - Automatic source language detection
  - Custom language pair settings

- 📝 Multiple Translation Scenarios
  - Text Translation: Support for single and multi-line text
  - Document Translation: Support for Word, PDF, and other formats
  - Subtitle Translation: Support for SRT, ASS formats

- 💾 Local Storage
  - Automatic translation history saving
  - Translation record management
  - Export translation results

- ⚙️ Custom Settings
  - Configurable translation API
  - Custom storage path
  - Theme switching

## 🚀 Quick Start

### Requirements

- Node.js >= 16.0.0
- pnpm >= 8.0.0

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## 📖 Usage

1. Select translation type (Text/Document/Subtitle)
2. Choose source and target languages
3. Input content or select files for translation
4. Click translate button to start
5. View, copy, or export translation results in the results page

## 🛠️ Tech Stack

- Electron
- Vue 3
- TypeScript
- Vuetify
- Pinia
- Vite

## 📝 Roadmap

- [ ] Support for more file formats
- [ ] Batch translation
- [ ] Translation API load balancing
- [ ] Offline translation support
- [ ] Custom translation templates

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Follow these steps to contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details 