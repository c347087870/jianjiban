const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
    // 待办管理
    getTodos: () => ipcRenderer.invoke('todo:getAll'),
    getTodoById: (id) => ipcRenderer.invoke('todo:getById', id),
    createTodo: (data) => ipcRenderer.invoke('todo:create', data),
    updateTodo: (id, data) => ipcRenderer.invoke('todo:update', id, data),
    deleteTodo: (id) => ipcRenderer.invoke('todo:delete', id),
    completeTodo: (id) => ipcRenderer.invoke('todo:complete', id),
    stopReminder: (id) => ipcRenderer.invoke('todo:stopReminder', id),

    // 图片管理
    saveImage: (base64Data) => ipcRenderer.invoke('image:save', base64Data),
    deleteImage: (path) => ipcRenderer.invoke('image:delete', path),
    getImagePath: (filename) => ipcRenderer.invoke('image:getPath', filename),

    // 通知
    showNotification: (options) => ipcRenderer.invoke('notification:show', options),

    // 设置
    getSettings: () => ipcRenderer.invoke('settings:get'),
    updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

    // 窗口管理
    openEditor: (todoId, type) => ipcRenderer.send('open-editor', todoId, type),
    closeEditor: () => ipcRenderer.send('close-editor'),
    openSettings: () => ipcRenderer.send('open-settings'),
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    maximizeWindow: () => ipcRenderer.send('window:maximize'),
    closeWindow: () => ipcRenderer.send('window:close'),

    // 事件监听
    onTodoChanged: (callback) => {
        ipcRenderer.on('todo:changed', (event, todos) => callback(todos));
    },
    onNotificationClick: (callback) => {
        ipcRenderer.on('notification:click', (event, todoId) => callback(todoId));
    },
    onOpenTodo: (callback) => {
        ipcRenderer.on('open-todo', (event, todoId) => callback(todoId));
    },
    onLoadTodo: (callback) => {
        ipcRenderer.on('load-todo', (event, todoId, type) => callback(todoId, type));
    },

    // 移除事件监听
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
