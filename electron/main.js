const { app, BrowserWindow, ipcMain, globalShortcut, Notification, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const moment = require('moment');

// 引入 IPC 处理器模块
const { registerTodoHandlers } = require('./ipc/todos');
const { registerNotificationHandlers } = require('./ipc/notification');
const { registerShortcutHandlers } = require('./ipc/shortcuts');
const { registerStorageHandlers } = require('./ipc/storage');

// 主窗口实例
let mainWindow = null;
// 编辑器窗口实例
let editorWindow = null;
// 设置窗口实例
let settingsWindow = null;
// 系统托盘实例
let tray = null;
// 应用是否正在退出
let isQuitting = false;
// 悬停提示窗口实例
let tooltipWindow = null;

// 数据存储目录路径
const DATA_DIR = path.join(app.getPath('userData'), 'data');
// 待办数据文件路径
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
// 设置文件路径
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
// 图片存储目录路径
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// 默认设置配置
const DEFAULT_SETTINGS = {
  shortcuts: {
    toggleWindow: 'CommandOrControl+Alt+J', // 切换主窗口显示
    newTodo: 'CommandOrControl+Alt+N',      // 新建待办
    newNote: 'CommandOrControl+Alt+M'       // 新建笔记
  },
  theme: 'light',
  autoStart: false
};

// Windows 通知必须设置 AppUserModelId
if (process.platform === 'win32') {
  app.setAppUserModelId('com.jianjiban.app');
}

// 确保应用单实例运行
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // 当第二个实例启动时，聚焦已有窗口
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

/**
 * 初始化数据目录
 * 创建数据存储目录和初始化数据文件
 */
async function initializeDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    // 初始化待办数据文件
    try { await fs.access(TODOS_FILE); } catch {
      await fs.writeFile(TODOS_FILE, JSON.stringify([], null, 2));
    }
    // 初始化设置文件
    try { await fs.access(SETTINGS_FILE); } catch {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    }
    console.log('数据目录初始化完成:', DATA_DIR);
  } catch (error) {
    console.error('初始化数据目录失败:', error);
  }
}

/**
 * 创建主窗口
 * 显示待办/笔记列表
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 350,
    height: 600,
    minWidth: 300,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1f1f1f',
    title: 'Sticky Notes',
    show: false
  });

  // 加载页面
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 关闭窗口时隐藏而非退出（托盘运行）
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

/**
 * 创建系统托盘
 * 创建托盘图标和右键菜单
 */
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('简记办');

  // 托盘右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        // 打开窗口时停止闪烁
        stopTrayFlashing();
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

  // 鼠标进入托盘图标时显示提示窗口
  tray.on('mouse-enter', () => {
    // 只有有待提醒待办时才显示提示窗口
    if (pendingReminders.length > 0) {
      const bounds = tray.getBounds();
      showTooltipWindow(bounds);
    }
  });

  // 鼠标离开托盘图标时延迟隐藏提示窗口
  tray.on('mouse-leave', () => {
    // 延迟检查鼠标是否移到窗口上
    setTimeout(() => {
      if (!isMouseInTooltip) {
        hideTooltipWindow();
      }
    }, 100);
  });

  // 双击托盘图标切换窗口显示
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        // 打开窗口时停止闪烁
        stopTrayFlashing();
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });
}

/**
 * 创建编辑器窗口
 * @param {String|null} todoId - 待办ID，null 表示新建
 * @param {String} type - 类型（todo/note）
 */
function createEditorWindow(todoId = null, type = 'note') {
  // 如果编辑器窗口已存在，复用并加载新内容
  if (editorWindow) {
    editorWindow.focus();
    editorWindow.webContents.send('load-todo', todoId, type);
    return;
  }

  editorWindow = new BrowserWindow({
    width: 500,
    height: 550,
    minWidth: 480,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false,
    backgroundColor: '#624a75',
    title: (type === 'todo' ? (todoId ? '编辑待办' : '新待办') : (todoId ? '编辑笔记' : '新笔记'))
  });

  // 构建 URL 并加载页面
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

/**
 * 创建设置窗口
 * 作为主窗口的模态窗口
 */
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
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: true,
    autoHideMenuBar: true,
    title: '设置',
    backgroundColor: '#2c2c2c'
  });

  settingsWindow.removeMenu();

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

/**
 * 注册全局快捷键
 * 根据设置注册全局快捷键，并应用开机自启设置
 */
async function registerGlobalShortcuts() {
  try {
    // 先注销所有快捷键
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
      // 开机自启设置失败
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
    // 快捷键注册失败
  }
}

// 闪烁定时器
let flashTimer = null;
// 当前闪烁状态
let isFlashOn = true;
// 托盘图标
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
const emptyIcon = nativeImage.createEmpty();
// 待提醒的待办列表
let pendingReminders = [];
// 鼠标是否在提示窗口内
let isMouseInTooltip = false;
// 隐藏窗口的定时器
let hideTooltipTimer = null;

/**
 * 创建悬停提示窗口
 * 鼠标悬停托盘图标时显示待提醒待办列表
 */
function createTooltipWindow() {
  if (tooltipWindow) return tooltipWindow;
  tooltipWindow = new BrowserWindow({
    width: 280,
    height: 200,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // 加载 Vue 页面
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    tooltipWindow.loadURL('http://localhost:5173/#/tooltip');
  } else {
    tooltipWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/tooltip'
    });
  }
  // 鼠标进入窗口时设置标记
  tooltipWindow.on('focus', () => {
    isMouseInTooltip = true;
  });
  // 窗口关闭时清理引用
  tooltipWindow.on('closed', () => {
    tooltipWindow = null;
    isMouseInTooltip = false;
  });
  return tooltipWindow;
}

/**
 * 计算提示窗口高度
 * @param {Number} todoCount - 待办数量
 * @returns {Number} 窗口高度
 */
function calculateTooltipHeight(todoCount) {
  const headerHeight = 45;
  const itemHeight = 60;
  const padding = 24;
  const moreHintHeight = 30;
  // 最多显示3条
  const displayCount = Math.min(todoCount, 3);
  let height = headerHeight + itemHeight * displayCount + padding;
  // 超过3条时添加提示高度
  if (todoCount > 3) {
    height += moreHintHeight;
  }
  return height;
}

/**
 * 显示悬停提示窗口
 * @param {Object} trayBounds - 托盘图标位置信息
 */
function showTooltipWindow(trayBounds) {
  // 清除隐藏定时器
  if (hideTooltipTimer) {
    clearTimeout(hideTooltipTimer);
    hideTooltipTimer = null;
  }
  if (!tooltipWindow) {
    createTooltipWindow();
  }
  if (!tooltipWindow) return;
  // 计算窗口位置：托盘图标上方
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  // 获取窗口尺寸
  const windowWidth = 280;
  const windowHeight = calculateTooltipHeight(pendingReminders.length);
  // 计算窗口位置：托盘图标左上角对齐
  let x = trayBounds.x;
  let y = trayBounds.y - windowHeight - 8;
  // 边界检测：确保窗口在屏幕内
  if (x + windowWidth > width) {
    x = width - windowWidth - 8;
  }
  if (x < 0) x = 8;
  if (y < 0) {
    y = trayBounds.y + trayBounds.height + 8;
  }
  // 设置窗口位置并显示
  tooltipWindow.setPosition(x, y);
  tooltipWindow.setSize(windowWidth, windowHeight);
  // 发送数据给窗口
  tooltipWindow.webContents.send('tooltip:update', pendingReminders);
  tooltipWindow.showInactive();
}

/**
 * 隐藏悬停提示窗口
 * @param {Boolean} immediate - 是否立即隐藏
 */
function hideTooltipWindow(immediate = false) {
  if (immediate) {
    // 立即隐藏
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
    if (tooltipWindow && tooltipWindow.isVisible()) {
      tooltipWindow.hide();
    }
    isMouseInTooltip = false;
  } else {
    // 延迟隐藏：检查鼠标是否在窗口内
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
    }
    hideTooltipTimer = setTimeout(() => {
      if (!isMouseInTooltip && tooltipWindow && tooltipWindow.isVisible()) {
        tooltipWindow.hide();
      }
      hideTooltipTimer = null;
    }, 300);
  }
}

/**
 * 鼠标进入提示窗口时调用
 */
function onTooltipMouseEnter() {
  isMouseInTooltip = true;
  // 清除隐藏定时器
  if (hideTooltipTimer) {
    clearTimeout(hideTooltipTimer);
    hideTooltipTimer = null;
  }
}

/**
 * 鼠标离开提示窗口时调用
 */
function onTooltipMouseLeave() {
  isMouseInTooltip = false;
  // 延迟隐藏窗口
  hideTooltipWindow();
}

/**
 * 更新托盘悬停提示
 * 更新提示窗口内容
 */
function updateTrayTooltip() {
  if (!tray) return;
  // 无待提醒时恢复默认提示并隐藏窗口
  if (pendingReminders.length === 0) {
    tray.setToolTip('简记办');
    hideTooltipWindow(true);
    return;
  }
  // 发送数据给提示窗口（如果窗口存在）
  if (tooltipWindow && tooltipWindow.webContents) {
    tooltipWindow.webContents.send('tooltip:update', pendingReminders);
  }
  // 更新托盘基本提示
  tray.setToolTip(`有 ${pendingReminders.length} 条待办提醒`);
}

/**
 * 开始托盘闪烁
 * 用于提醒通知时引起用户注意
 */
function startTrayFlashing() {
  if (flashTimer) return;
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

/**
 * 停止托盘闪烁
 * 恢复正常托盘图标，清除待提醒列表
 */
function stopTrayFlashing() {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  if (tray) {
    tray.setImage(icon);
  }
  isFlashOn = true;
  // 清除待提醒列表并恢复默认提示
  pendingReminders = [];
  updateTrayTooltip();
}

/**
 * 启动提醒检查定时器
 * 每 10 秒检查一次是否有待办需要提醒
 */
function startReminderTimer() {
  setInterval(async () => {
    try {
      const todosData = await fs.readFile(TODOS_FILE, 'utf-8');
      let todos = JSON.parse(todosData);
      const now = moment();
      let hasUpdates = false;

      for (const todo of todos) {
        if (!todo.completed && todo.remindAt) {
          // 处理工作日重复提醒
          if (todo.repeat === 'weekdays') {
            const currentDay = now.day();
            if (currentDay >= 1 && currentDay <= 5) { // 周一到周五
              const remindTime = moment(todo.remindAt);
              const remindHour = remindTime.hour();
              const remindMinute = remindTime.minute();
              const todayRemindTime = moment().hour(remindHour).minute(remindMinute).second(0);
              const lastReminded = todo.lastRemindedAt ? moment(todo.lastRemindedAt) : null;

              if (now.isSameOrAfter(todayRemindTime) && (!lastReminded || lastReminded.isBefore(todayRemindTime, 'day'))) {
                showReminder(todo);
                todo.lastRemindedAt = now.toISOString();
                hasUpdates = true;
              }
            } else {
              // 周末时更新 lastRemindedAt，避免周一重复提醒
              const remindTime = moment(todo.remindAt);
              const remindHour = remindTime.hour();
              const remindMinute = remindTime.minute();
              const todayRemindTime = moment().hour(remindHour).minute(remindMinute).second(0);
              const lastReminded = todo.lastRemindedAt ? moment(todo.lastRemindedAt) : null;
              if (now.isSameOrAfter(todayRemindTime) && (!lastReminded || lastReminded.isBefore(todayRemindTime, 'day'))) {
                todo.lastRemindedAt = now.toISOString();
                hasUpdates = true;
              }
            }
          } else {
            // 其他重复类型或一次性提醒
            const remindTime = moment(todo.remindAt);
            const lastReminded = todo.lastRemindedAt ? moment(todo.lastRemindedAt) : null;

            if (remindTime.isSameOrBefore(now) && (!lastReminded || lastReminded.isBefore(remindTime))) {
              showReminder(todo);
              todo.lastRemindedAt = now.toISOString();
              hasUpdates = true;
            }
          }
        }
      }

      if (hasUpdates) {
        await fs.writeFile(TODOS_FILE, JSON.stringify(todos, null, 2));
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('todo:changed', todos);
        });
      }
    } catch (error) {
      // 提醒检查失败
    }
  }, 10000);
}

/**
 * 显示提醒通知
 * @param {Object} todo - 待办对象
 */
function showReminder(todo) {
  // 添加到待提醒列表（避免重复添加）
  if (!pendingReminders.find(t => t.id === todo.id)) {
    pendingReminders.push(todo);
  }
  // 更新托盘悬停提示
  updateTrayTooltip();
  // 开始托盘闪烁
  startTrayFlashing();

  const notification = new Notification({
    title: '📝 待办提醒',
    body: todo.title || todo.content.substring(0, 50),
    icon: path.join(__dirname, 'assets', 'icon.png'),
    silent: false,
    timeoutType: 'never',
    urgency: 'critical',
    sound: 'default',
    actions: [
      { type: 'button', text: '查看' },
      { type: 'button', text: '稍后提醒' }
    ]
  });

  // 点击通知时
  notification.on('click', () => {
    // 从待提醒列表中移除该待办
    pendingReminders = pendingReminders.filter(t => t.id !== todo.id);
    updateTrayTooltip();
    // 如果没有待提醒了则停止闪烁
    if (pendingReminders.length === 0) {
      stopTrayFlashing();
    }
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('open-todo', todo.id);
    }
  });

  // macOS: 点击操作按钮时
  notification.on('action', (event, index) => {
    if (index === 0) { // 查看
      // 从待提醒列表中移除该待办
      pendingReminders = pendingReminders.filter(t => t.id !== todo.id);
      updateTrayTooltip();
      // 如果没有待提醒了则停止闪烁
      if (pendingReminders.length === 0) {
        stopTrayFlashing();
      }
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('open-todo', todo.id);
      }
    } else if (index === 1) { // 稍后提醒
      // 从待提醒列表中移除该待办
      pendingReminders = pendingReminders.filter(t => t.id !== todo.id);
      updateTrayTooltip();
      // 如果没有待提醒了则停止闪烁
      if (pendingReminders.length === 0) {
        stopTrayFlashing();
      }
    }
  });

  notification.show();
}

// 应用启动入口
app.whenReady().then(async () => {
  await initializeDataDirectory();
  createMainWindow();
  createTray();

  // 注册 IPC 处理器
  registerTodoHandlers(ipcMain, TODOS_FILE, stopTrayFlashing, removePendingReminder);
  registerNotificationHandlers(ipcMain);
  registerShortcutHandlers(ipcMain, SETTINGS_FILE);
  registerStorageHandlers(ipcMain, IMAGES_DIR);

  // 注册全局快捷键
  await registerGlobalShortcuts();

  // 启动提醒定时器
  startReminderTimer();

  // macOS: 点击 Dock 图标时创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 窗口最小化
ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

// 窗口最大化/还原
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

// 窗口关闭
ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// 打开编辑器窗口
ipcMain.on('open-editor', (event, todoId, type) => {
  createEditorWindow(todoId, type);
});

// 关闭编辑器窗口
ipcMain.on('close-editor', () => {
  if (editorWindow) {
    editorWindow.close();
  }
});

// 打开设置窗口
ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

// 所有窗口关闭时不退出（托盘运行）
app.on('window-all-closed', () => {
  // 不执行任何操作，保持托盘运行
});

// 应用即将退出时注销快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 应用退出前设置标志
app.on('before-quit', () => {
  isQuitting = true;
});

// 重新注册快捷键
ipcMain.on('shortcuts:reregister', async () => {
  await registerGlobalShortcuts();
});

// 提示窗口鼠标进入
ipcMain.on('tooltip:mouseenter', () => {
  onTooltipMouseEnter();
});

// 提示窗口鼠标离开
ipcMain.on('tooltip:mouseleave', () => {
  onTooltipMouseLeave();
});

// 提示窗口点击待办
ipcMain.on('tooltip:todoClick', (_event, _todoId) => {
  // 隐藏提示窗口
  hideTooltipWindow(true);
  // 停止闪烁
  stopTrayFlashing();
  // 显示主窗口
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

/**
 * 从待提醒列表中移除指定待办
 * @param {String} todoId - 待办ID
 */
function removePendingReminder(todoId) {
  pendingReminders = pendingReminders.filter(t => t.id !== todoId);
  updateTrayTooltip();
  // 如果没有待提醒了则停止闪烁
  if (pendingReminders.length === 0) {
    stopTrayFlashing();
  }
}

module.exports = {
  DATA_DIR,
  TODOS_FILE,
  SETTINGS_FILE,
  IMAGES_DIR,
  registerGlobalShortcuts,
  removePendingReminder
};
