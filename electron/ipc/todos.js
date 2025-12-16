const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

/**
 * 注册待办相关的 IPC 处理器
 */
function registerTodoHandlers(ipcMain, todosFilePath, onStopReminder) {
    // 读取所有待办
    ipcMain.handle('todo:getAll', async () => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            throw error;
        }
    });

    // 根据 ID 获取待办
    ipcMain.handle('todo:getById', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);
            return todos.find(todo => todo.id === id) || null;
        } catch (error) {
            throw error;
        }
    });

    // 创建待办
    ipcMain.handle('todo:create', async (event, todoData) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const newTodo = {
                id: uuidv4(),
                title: todoData.title || '无标题',
                content: todoData.content || '',
                images: todoData.images || [],
                type: todoData.type || 'note',  // 添加类型字段，默认为笔记
                remindAt: todoData.remindAt || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completed: false
            };

            todos.push(newTodo);
            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口待办列表已更新
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return newTodo;
        } catch (error) {
            throw error;
        }
    });

    // 更新待办
    ipcMain.handle('todo:update', async (event, id, updateData) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const index = todos.findIndex(todo => todo.id === id);
            if (index === -1) {
                throw new Error('待办不存在');
            }

            todos[index] = {
                ...todos[index],
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return todos[index];
        } catch (error) {
            throw error;
        }
    });

    // 删除待办
    ipcMain.handle('todo:delete', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            let todos = JSON.parse(data);

            const initialLength = todos.length;
            todos = todos.filter(todo => todo.id !== id);

            if (todos.length === initialLength) {
                throw new Error('待办不存在');
            }

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return true;
        } catch (error) {
            throw error;
        }
    });

    // 完成待办
    ipcMain.handle('todo:complete', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const index = todos.findIndex(todo => todo.id === id);
            if (index === -1) {
                throw new Error('待办不存在');
            }

            todos[index].completed = !todos[index].completed;
            todos[index].updatedAt = new Date().toISOString();

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return todos[index];
        } catch (error) {
            throw error;
        }
    });
    // 停止提醒
    ipcMain.handle('todo:stopReminder', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const index = todos.findIndex(todo => todo.id === id);
            if (index === -1) {
                throw new Error('待办不存在');
            }

            const todo = todos[index];

            // 如果是重复任务，计算下一次提醒时间
            if (todo.repeat && todo.repeat !== 'none') {
                const currentRemindAt = new Date(todo.remindAt);
                // Ensure we advance from the *current* reminder time, not just "now", to maintain schedule
                // But if it's way in the past, maybe we should advance to future? 
                // For simplicity and consistency with "stop reminder" meaning "I'm done with this instance",
                // let's advance from the current reminder time.
                todo.remindAt = calculateNextReminder(currentRemindAt, todo.repeat);
            } else {
                // 非重复任务，清除提醒
                todo.remindAt = null;
            }

            todo.updatedAt = new Date().toISOString();

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            // 停止托盘闪烁
            if (onStopReminder) {
                onStopReminder();
            }

            return todo;
        } catch (error) {
            throw error;
        }
    });
}

// 计算下一次提醒时间
function calculateNextReminder(currentDate, repeatType) {
    const date = new Date(currentDate);

    switch (repeatType) {
        case 'daily':
            date.setDate(date.getDate() + 1);
            break;
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'weekdays':
            do {
                date.setDate(date.getDate() + 1);
            } while (date.getDay() === 0 || date.getDay() === 6); // Skip Sunday (0) and Saturday (6)
            break;
    }

    return date.toISOString();
}

module.exports = { registerTodoHandlers };
