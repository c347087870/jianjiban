# 简记办（JianJiBan）

> 基于 Node.js + Electron 的桌面端待办与笔记工具（单文件 exe）

![Node Version](https://img.shields.io/badge/node-22.20.0-brightgreen)
![Electron](https://img.shields.io/badge/electron-30%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 目录

- 项目简介
- 功能列表
- 架构与数据存储
- 目录结构
- 快捷键与设置
- 开发与运行
- 打包与发布（单 exe）
- 常见问题（网络与权限）
- 后续扩展建议

## 项目简介

**简记办（JianJiBan）** 旨在提供一个轻量、即开即用的桌面端记录工具：支持富文本、图片插入、提醒、快捷键、开机自启，并以“单个 exe”交付便于分发。

## 功能列表

- 快速新增笔记/待办（窗口或全局快捷键）
- 富文本编辑（格式、图片粘贴/拖拽上传）
- 提醒设置（到点系统通知，可点击打开对应待办）
- 开机自启（设置页可开启/关闭）
- 单实例运行（重复启动将聚焦已有窗口）
- 单 exe 打包（Portable，无需安装）
- 本地 JSON 存储，离线使用，无外部依赖

## 架构与数据存储

```
┌──────────────────────────────┐
│        Electron 主进程        │
│ - 创建/管理窗口               │
│ - 注册全局快捷键              │
│ - 处理系统通知                │
│ - 定时扫描提醒                │
│ - IPC 与渲染层通信            │
└───────────────▲──────────────┘
                │ IPC
┌───────────────┴────────────────┐
│        渲染进程（前端 UI）        │
│ - 待办列表 / 编辑器 / 设置       │
│ - 富文本编辑与图片上传           │
│ - 用户设置与快捷键录入           │
└──────────────────────────────┘

┌──────────────────────────────┐
│        本地存储系统            │
│ - data/todos.json              │
│ - data/images/                 │
│ - data/settings.json           │
└──────────────────────────────┘
```

**数据目录（Windows）：**
- 文本与待办：`%APPDATA%/<应用名>/data/todos.json`
- 图片文件：`%APPDATA%/<应用名>/data/images/`
- 设置文件：`%APPDATA%/<应用名>/data/settings.json`

代码位置：`electron/main.js:19-23`

## 目录结构

```
简记办/
├── electron/
│   ├── main.js                 # 主进程入口
│   ├── preload.js              # 预加载脚本（安全暴露 API）
│   └── ipc/                    # IPC 模块
│       ├── todos.js            # 待办 CRUD
│       ├── notification.js     # 系统通知
│       └── shortcuts.js        # 设置与快捷键
│
├── src/                        # 渲染层（前端）
│   ├── pages/                  # 页面
│   │   ├── Home.vue
│   │   ├── Editor.vue
│   │   └── Settings.vue
│   ├── components/             # 组件
│   │   └── RichEditor.vue
│   └── assets/
│
├── data/                       # 运行时数据（开发模式）
│   ├── todos.json
│   ├── settings.json
│   └── images/
│
├── index.html                  # 前端入口
├── vite.config.js              # Vite 配置
├── electron-builder.json       # 打包配置
├── package.json                # 脚本与依赖
└── README.md
```

## 快捷键与设置

- 默认快捷键（可在设置页修改）：
  - 显示/隐藏主窗口：`Ctrl + Alt + J`
  - 新建待办：`Ctrl + Alt + N`
  - 新建笔记：`Ctrl + Alt + M`
- 开机自启：设置页勾选“开机自启”后，打包版会在系统启动目录生成快捷方式。
- 相关代码：
  - 快捷键注册：`electron/main.js:263-297`
  - 设置读写与自启：`electron/ipc/shortcuts.js:21-61`，`electron/main.js:259-279`

## 开发与运行

```bash
npm install
npm run dev
```

开发模式说明：
- 渲染层通过 Vite HMR 热更新
- 主进程通过 `electronmon` 自动重启
- 数据写入到用户目录的 `data/` 下

## 打包与发布（单 exe）

目标：`Windows Portable` 单文件 exe（无需安装）

```bash
# 可选：解决构建时下载慢或失败（国内镜像）
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'

# 生成单 exe
npm run build
```

输出：`dist/简记办.exe`

图标要求：`electron/assets/icon.ico` 至少 256x256（已自动生成），托盘与通知使用 `electron/assets/icon.png`。

## 常见问题（网络与权限）

- 下载工具包失败（winCodeSign 7z）：使用镜像变量或手动缓存到 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`。
- Windows 符号链接权限：建议开启“开发者模式”，或用管理员权限运行构建。
- 单实例与聚焦：重复启动时自动聚焦已有窗口（`electron/main.js:40-64`）。


## 许可证

MIT License

---

**Made with ❤️ by JianJiBan Team**
