const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

/**
 * 注册待办相关的 IPC 处理器
 * @param {Object} ipcMain - Electron IPC 主进程对象
 * @param {String} todosFilePath - 待办数据文件路径
 * @param {Function} onStopReminder - 停止提醒回调函数
 * @param {Function} onRemovePending - 移除待提醒待办回调函数
 */
function registerTodoHandlers(ipcMain, todosFilePath, onStopReminder, onRemovePending) {

    /**
     * 获取所有待办
     * @returns {Array} 待办数组
     */
    ipcMain.handle('todo:getAll', async () => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            throw error;
        }
    });

    /**
     * 根据 ID 获取待办
     * @param {String} id - 待办ID
     * @returns {Object|null} 待办对象或 null
     */
    ipcMain.handle('todo:getById', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);
            return todos.find(todo => todo.id === id) || null;
        } catch (error) {
            throw error;
        }
    });

    /**
     * 创建待办
     * @param {Object} todoData - 待办数据
     * @returns {Object} 创建的待办对象
     */
    ipcMain.handle('todo:create', async (event, todoData) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const newTodo = {
                id: uuidv4(),
                title: todoData.title || '无标题',
                content: todoData.content || '',
                images: todoData.images || [],
                type: todoData.type || 'note',
                remindAt: todoData.remindAt || null,
                repeat: todoData.repeat || 'none',
                createdAt: moment().toISOString(),
                updatedAt: moment().toISOString(),
                completed: false
            };

            todos.push(newTodo);
            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口数据已更新
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return newTodo;
        } catch (error) {
            throw error;
        }
    });

    /**
     * 更新待办
     * @param {String} id - 待办ID
     * @param {Object} updateData - 更新数据
     * @returns {Object} 更新后的待办对象
     */
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
                updatedAt: moment().toISOString()
            };

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口数据已更新
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return todos[index];
        } catch (error) {
            throw error;
        }
    });

    /**
     * 删除待办
     * @param {String} id - 待办ID
     * @returns {Boolean} 是否删除成功
     */
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

            // 通知所有窗口数据已更新
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return true;
        } catch (error) {
            throw error;
        }
    });

    /**
     * 切换待办完成状态
     * @param {String} id - 待办ID
     * @returns {Object} 更新后的待办对象
     */
    ipcMain.handle('todo:complete', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const index = todos.findIndex(todo => todo.id === id);
            if (index === -1) {
                throw new Error('待办不存在');
            }

            todos[index].completed = !todos[index].completed;
            todos[index].updatedAt = moment().toISOString();

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口数据已更新
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return todos[index];
        } catch (error) {
            throw error;
        }
    });
    
    /**
     * 停止提醒
     * @param {String} id - 待办ID
     * @returns {Object} 更新后的待办对象
     */
    ipcMain.handle('todo:stopReminder', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const index = todos.findIndex(todo => todo.id === id);
            if (index === -1) {
                throw new Error('待办不存在');
            }

            const todo = todos[index];

            // 根据重复类型处理
            if (todo.repeat && todo.repeat !== 'none') {
                if (todo.repeat === 'weekdays') {
                    // 工作日提醒：记录本次提醒时间
                    const now = moment();
                    todo.lastRemindedAt = now.toISOString();
                } else {
                    // 其他重复类型：计算下次提醒时间
                    const currentRemindAt = moment(todo.remindAt);
                    todo.remindAt = calculateNextReminder(currentRemindAt, todo.repeat);
                }
            } else {
                // 一次性提醒：清除提醒时间
                todo.remindAt = null;
            }

            todo.updatedAt = moment().toISOString();

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            // 通知所有窗口数据已更新
            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            // 停止托盘闪烁
            if (onStopReminder) {
                onStopReminder();
            }
            // 从待提醒列表中移除该待办
            if (onRemovePending) {
                onRemovePending(id);
            }

            return todo;
        } catch (error) {
            throw error;
        }
    });
}

/**
 * 计算下次提醒时间
 * @param {moment} currentDate - 当前提醒时间
 * @param {String} repeatType - 重复类型
 * @returns {String} 下次提醒时间的 ISO 字符串
 */
function calculateNextReminder(currentDate, repeatType) {
    const date = moment(currentDate);
    const targetDay = date.date();

    switch (repeatType) {
        case 'daily':
            date.add(1, 'day');
            break;
        case 'weekly':
            date.add(1, 'week');
            break;
        case 'monthly':
            date.add(1, 'month');
            // 处理月末日期不存在的情况
            if (date.date() !== targetDay) {
                date.date(date.daysInMonth());
            }
            break;
        case 'weekdays':
            // 跳过周末
            do {
                date.add(1, 'day');
            } while (date.day() === 0 || date.day() === 6);
            break;
    }

    return date.toISOString();
}

module.exports = { registerTodoHandlers };
