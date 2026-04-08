const fs = require('fs').promises;
const { globalShortcut, app, shell } = require('electron');
const path = require('path');

/**
 * 注册快捷键相关的 IPC 处理器
 * @param {Object} ipcMain - Electron IPC 主进程对象
 * @param {String} settingsFilePath - 设置文件路径
 */
function registerShortcutHandlers(ipcMain, settingsFilePath) {

    /**
     * 获取设置
     * @returns {Object} 设置对象
     */
    ipcMain.handle('settings:get', async () => {
        try {
            const data = await fs.readFile(settingsFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            throw error;
        }
    });

    /**
     * 更新设置
     * @param {Object} newSettings - 新设置对象
     * @returns {Object} 更新后的设置对象
     */
    ipcMain.handle('settings:update', async (event, newSettings) => {
        try {
            const data = await fs.readFile(settingsFilePath, 'utf-8');
            const currentSettings = JSON.parse(data);

            const updatedSettings = {
                ...currentSettings,
                ...newSettings
            };

            // 如果快捷键有更新，触发重新注册
            if (newSettings.shortcuts) {
                const { ipcMain } = require('electron');
                process.nextTick(() => {
                    ipcMain.emit('shortcuts:reregister');
                });
            }

            // 如果开机自启有更新
            if (typeof newSettings.autoStart !== 'undefined') {
                const enable = !!newSettings.autoStart;

                try {
                    // macOS 使用系统 API
                    if (process.platform === 'darwin') {
                        app.setLoginItemSettings({ openAtLogin: enable });
                    }
                    // Windows 使用启动文件夹快捷方式
                    if (process.platform === 'win32') {
                        if (!app.isPackaged) {
                            // 开发模式跳过
                        } else {
                            const startupDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
                            const linkPath = path.join(startupDir, '简记办.lnk');
                            if (enable) {
                                shell.writeShortcutLink(linkPath, {
                                    target: process.execPath,
                                    workingDirectory: path.dirname(process.execPath),
                                    description: '简记办 - 开机自启',
                                    icon: path.join(process.resourcesPath || path.dirname(process.execPath), 'electron.asar', '..', 'default_app', 'icon.ico')
                                });
                            } else {
                                try {
                                    const fs = require('fs');
                                    if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
                                } catch (e) {
                                    // 删除快捷方式失败
                                }
                            }
                        }
                    }
                } catch (e) {
                    // 开机自启设置失败
                }
            }

            await fs.writeFile(settingsFilePath, JSON.stringify(updatedSettings, null, 2));

            return updatedSettings;
        } catch (error) {
            throw error;
        }
    });
}

module.exports = { registerShortcutHandlers };
