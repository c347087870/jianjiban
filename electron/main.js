const { app, BrowserWindow, ipcMain, globalShortcut, Notification, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const moment = require('moment');

// 导入 IPC 处理器
const { registerTodoHandlers } = require('./ipc/todos');
const { registerNotificationHandlers } = require('./ipc/notification');
const { registerShortcutHandlers } = require('./ipc/shortcuts');
const { registerStorageHandlers } = require('./ipc/storage');

let mainWindow = null;
let editorWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;

// 数据目录
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// 默认设置
const DEFAULT_SETTINGS = {
  shortcuts: {
    toggleWindow: 'CommandOrControl+Alt+J',
    newTodo: 'CommandOrControl+Alt+N',
    newNote: 'CommandOrControl+Alt+M'
  },
  theme: 'light',
  autoStart: false
};

// Windows 通知必须设置 AppUserModelId
if (process.platform === 'win32') {
  app.setAppUserModelId('com.jianjiban.app');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
    if (editorWindow) {
      editorWindow.show();
      editorWindow.focus();
    }
  });
}

// 初始化数据目录
async function initializeDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(IMAGES_DIR, { recursive: true });

    // 初始化 todos.json
    try {
      await fs.access(TODOS_FILE);
    } catch {
      await fs.writeFile(TODOS_FILE, JSON.stringify([], null, 2));
    }

    // 初始化 settings.json
    try {
      await fs.access(SETTINGS_FILE);
    } catch {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    }

    console.log('数据目录初始化完成:', DATA_DIR);
  } catch (error) {
    console.error('初始化数据目录失败:', error);
  }
}

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 350, // Narrower for sticky note hub feel
    height: 600,
    minWidth: 300,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false, // Frameless for custom UI
    titleBarStyle: 'hidden',
    backgroundColor: '#1f1f1f',
    title: 'Sticky Notes',
    show: false // Start hidden, let ready-to-show or tray handle it
  });

  // 开发环境加载 Vite 服务器
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // 生产环境加载构建后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('简记办');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });
}

// 创建编辑器窗口
function createEditorWindow(todoId = null, type = 'note') {
  if (editorWindow) {
    editorWindow.focus();
    // 无论是新建还是编辑，都发送事件给编辑器窗口
    // 编辑器窗口需要监听 'load-todo' 事件，如果 todoId 为 null，则重置为新建状态
    editorWindow.webContents.send('load-todo', todoId, type);
    return;
  }

  editorWindow = new BrowserWindow({
    width: 500,
    height: 550,
    minWidth: 480, // 增加最小宽度，防止时间选择器显示不全
    minHeight: 500,
    parent: mainWindow, // Optional: make it independent for sticky note hub feel? Let's keep parent for now
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false, // Frameless
    backgroundColor: '#624a75',
    title: todoId ? '编辑笔记' : '新笔记'
  });

  // 构建 URL，包含 type 参数
  let url = '';
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const params = new URLSearchParams();
    if (todoId) params.append('id', todoId);
    if (type) params.append('type', type);
    const queryString = params.toString();
    url = `http://localhost:5173/#/editor${queryString ? '?' + queryString : ''}`;
    editorWindow.loadURL(url);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    let hash = '/editor';
    const qs = new URLSearchParams();
    if (todoId) qs.append('id', todoId);
    if (typeof type === 'string' && type) qs.append('type', type);
    const qsStr = qs.toString();
    if (qsStr) hash += '?' + qsStr;
    editorWindow.loadFile(indexPath, { hash });
  }

  editorWindow.on('closed', () => {
    editorWindow = null;
  });
}

// 创建设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    minWidth: 350,
    minHeight: 400,
    parent: mainWindow,
    modal: true, // 模态窗口
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: true, // 使用系统窗框
    autoHideMenuBar: true, // 隐藏菜单栏
    title: '设置',
    backgroundColor: '#2c2c2c'
  });

  settingsWindow.removeMenu(); // 确保菜单栏被移除

  let url = '';
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    url = `http://localhost:5173/#/settings`;
    settingsWindow.loadURL(url);
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/settings'
    });
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// 注册全局快捷键
async function registerGlobalShortcuts() {
  try {
    // Unregister all first
    globalShortcut.unregisterAll();

    const settingsData = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(settingsData);

    // 应用开机自启设置
    try {
      if (typeof settings.autoStart !== 'undefined') {
        const enable = !!settings.autoStart;
        if (process.platform === 'darwin') {
          app.setLoginItemSettings({ openAtLogin: enable });
        }
        if (process.platform === 'win32' && app.isPackaged) {
          const startupDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
          const linkPath = path.join(startupDir, '简记办.lnk');
          if (enable) {
            shell.writeShortcutLink(linkPath, {
              target: process.execPath,
              workingDirectory: path.dirname(process.execPath),
              description: '简记办 - 开机自启'
            });
          } else {
            const fsSync = require('fs');
            if (fsSync.existsSync(linkPath)) fsSync.unlinkSync(linkPath);
          }
        }
      };
    } catch (e) {
      // Auto-start setting failed
    }

    // 注册切换主窗口快捷键
    if (settings.shortcuts.toggleWindow) {
      globalShortcut.register(settings.shortcuts.toggleWindow, () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
    }

    // 注册新建待办快捷键
    if (settings.shortcuts.newTodo) {
      globalShortcut.register(settings.shortcuts.newTodo, () => {
        createEditorWindow(null, 'todo');
      });
    }

    // 注册新建笔记快捷键
    if (settings.shortcuts.newNote) {
      globalShortcut.register(settings.shortcuts.newNote, () => {
        createEditorWindow(null, 'note');
      });
    }
  } catch (error) {
    // Register shortcuts failed
  }
}

// 托盘闪烁控制
let flashTimer = null;
let isFlashOn = true;
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
const emptyIcon = nativeImage.createEmpty();

function startTrayFlashing() {
  if (flashTimer) return; // Already flashing

  flashTimer = setInterval(() => {
    if (tray) {
      if (isFlashOn) {
        tray.setImage(emptyIcon);
      } else {
        tray.setImage(icon);
      }
      isFlashOn = !isFlashOn;
    }
  }, 500);
}

function stopTrayFlashing() {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  if (tray) {
    tray.setImage(icon);
  }
  isFlashOn = true;
}

// 提醒检查定时器
function startReminderTimer() {
  setInterval(async () => {
    try {
      const todosData = await fs.readFile(TODOS_FILE, 'utf-8');
      let todos = JSON.parse(todosData);
      const now = moment();
      let hasUpdates = false;

      for (const todo of todos) {
        if (!todo.completed && todo.remindAt) {
          const remindTime = moment(todo.remindAt);
          const lastReminded = todo.lastRemindedAt ? moment(todo.lastRemindedAt) : null;

          // Check if due AND (never reminded OR reminded before this due time)
          if (remindTime.isSameOrBefore(now) && (!lastReminded || lastReminded.isBefore(remindTime))) {
            showReminder(todo);
            todo.lastRemindedAt = now.toISOString();
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        await fs.writeFile(TODOS_FILE, JSON.stringify(todos, null, 2));
        // Notify windows
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('todo:changed', todos);
        });
      }
    } catch (error) {
      // Check reminders failed
    }
  }, 10000); // Check every 10 seconds
}

// 显示提醒通知
function showReminder(todo) {
  startTrayFlashing(); // Start flashing

  const notification = new Notification({
    title: '📝 待办提醒',
    body: todo.title || todo.content.substring(0, 50),
    icon: path.join(__dirname, 'assets', 'icon.png'),
    silent: false, // 播放系统提示音
    timeoutType: 'never', // Windows: 通知不会自动消失
    urgency: 'critical', // Linux: 设置为紧急
    sound: 'default', // macOS: 播放默认提示音
    actions: [ // macOS: 添加操作按钮
      {
        type: 'button',
        text: '查看'
      },
      {
        type: 'button',
        text: '稍后提醒'
      }
    ]
  });

  // 点击通知时
  notification.on('click', () => {
    stopTrayFlashing(); // 停止闪烁
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('open-todo', todo.id);
    }
  });

  // macOS: 点击操作按钮时
  notification.on('action', (event, index) => {
    if (index === 0) { // 查看
      stopTrayFlashing();
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('open-todo', todo.id);
      }
    } else if (index === 1) { // 稍后提醒
      // 可以在这里实现稍后提醒的逻辑
      stopTrayFlashing();
    }
  });

  // 通知关闭时
  notification.on('close', () => {
    // Notification closed
  });

  // Windows: 通知显示失败时
  notification.on('failed', (event, error) => {
    // Failed to show notification
  });

  notification.show();
}

// 应用启动
app.whenReady().then(async () => {
  await initializeDataDirectory();

  createMainWindow();
  createTray();

  // 注册 IPC 处理器
  registerTodoHandlers(ipcMain, TODOS_FILE, stopTrayFlashing); // Pass stop callback
  registerNotificationHandlers(ipcMain);
  registerShortcutHandlers(ipcMain, SETTINGS_FILE);
  registerStorageHandlers(ipcMain, IMAGES_DIR);

  // 注册全局快捷键
  await registerGlobalShortcuts();

  // 启动提醒定时器
  startReminderTimer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 窗口控制 IPC
ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// 窗口管理 IPC
ipcMain.on('open-editor', (event, todoId, type) => {
  createEditorWindow(todoId, type);
});

ipcMain.on('close-editor', () => {
  if (editorWindow) {
    editorWindow.close();
  }
});

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

// 应用退出
app.on('window-all-closed', () => {
  // Do nothing, keep running in tray
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  isQuitting = true;
});

// IPC handler for re-registering shortcuts
ipcMain.on('shortcuts:reregister', async () => {
  await registerGlobalShortcuts();
});

// 导出路径供 IPC 使用
module.exports = {
  DATA_DIR,
  TODOS_FILE,
  SETTINGS_FILE,
  IMAGES_DIR,
  registerGlobalShortcuts
};
