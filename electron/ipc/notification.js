const { Notification } = require('electron');

/**
 * 注册通知相关的 IPC 处理器
 */
function registerNotificationHandlers(ipcMain) {

    // 显示系统通知
    ipcMain.handle('notification:show', async (event, options) => {
        try {
            const notification = new Notification({
                title: options.title || '简记办',
                body: options.body || '',
                silent: options.silent || false
            });

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
