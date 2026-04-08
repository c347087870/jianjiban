const { Notification } = require('electron');

/**
 * 注册通知相关的 IPC 处理器
 * @param {Object} ipcMain - Electron IPC 主进程对象
 */
function registerNotificationHandlers(ipcMain) {

    /**
     * 显示系统通知
     * @param {Object} options - 通知配置
     * @param {String} options.title - 通知标题
     * @param {String} options.body - 通知内容
     * @param {Boolean} options.silent - 是否静音
     * @param {String} options.todoId - 关联的待办ID
     */
    ipcMain.handle('notification:show', async (event, options) => {
        try {
            const notification = new Notification({
                title: options.title || '简记办',
                body: options.body || '',
                silent: options.silent || false
            });

            // 点击通知时发送事件
            if (options.todoId) {
                notification.on('click', () => {
                    event.sender.send('notification:click', options.todoId);
                });
            }

            notification.show();
            return true;
        } catch (error) {
            throw error;
        }
    });
}

module.exports = { registerNotificationHandlers };
