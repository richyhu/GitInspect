# GitHub 仓库浏览器

一个简洁优雅的 GitHub 仓库浏览工具，支持查看仓库信息、文件结构、发布版本等功能。

## 🌟 功能特性

- 🔍 **仓库信息查看** - 显示stars、forks、语言、描述等信息
- 📁 **文件结构浏览** - 树形结构展示仓库文件和文件夹
- 🏷️ **发布版本管理** - 查看和管理仓库的releases
- 📱 **响应式设计** - 完美适配移动端和桌面端
- 🌙 **深色模式** - 支持深色/浅色主题切换
- ⚡ **快速搜索** - 即时搜索文件和文件夹
- 📦 **文件下载** - 支持子目录打包下载
- 📊 **数据统计** - 显示代码统计和语言分布

## 🚀 快速开始

### 在线使用

直接访问项目页面即可使用，无需安装任何依赖。

### 本地开发

```bash
# 克隆项目
git clone [你的仓库地址]

# 进入项目目录
cd github1

# 安装依赖
npm install

# 启动开发服务器
npm run dev:client

# 构建生产版本
npm run build
```

### 本地运行构建版本

```bash
# 构建项目
npm run build

# 启动静态服务器
npx serve dist/static
```

## 📁 项目结构

```
GitInspect/
├── src/                    # 源代码
│   ├── components/          # React组件
│   ├── contexts/           # React上下文
│   ├── hooks/              # 自定义Hook
│   ├── lib/                # 工具函数
│   ├── pages/              # 页面组件
│   └── App.tsx             # 主应用组件
├── help/                   # 帮助文档
├── dist/                   # 构建输出
└── scripts/                # 构建脚本
```

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **路由**: React Router
- **状态管理**: Zustand
- **动画**: Framer Motion
- **图标**: Lucide React + Font Awesome
- **测试**: Vitest

## 📋 使用说明

1. **查看仓库**: 输入GitHub仓库地址或owner/repo格式
2. **浏览文件**: 点击文件夹展开，点击文件查看内容
3. **搜索功能**: 使用搜索框快速定位文件
4. **下载文件**: 点击下载按钮获取文件或文件夹
5. **主题切换**: 点击主题按钮切换深色/浅色模式

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目！

## 📄 许可证

MIT License

## 🆘 帮助

如有问题，请查看 [帮助文档](https://gitinspect.huruiqi.my/help/index.html) 或提交Issue。

---

**⭐ 如果这个项目对你有帮助，请给个Star支持一下！**
