const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

function registerTodoHandlers(ipcMain, todosFilePath, onStopReminder) {
    ipcMain.handle('todo:getAll', async () => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            throw error;
        }
    });

    ipcMain.handle('todo:getById', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);
            return todos.find(todo => todo.id === id) || null;
        } catch (error) {
            throw error;
        }
    });

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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completed: false
            };

            todos.push(newTodo);
            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return newTodo;
        } catch (error) {
            throw error;
        }
    });

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

            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return todos[index];
        } catch (error) {
            throw error;
        }
    });

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

            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return true;
        } catch (error) {
            throw error;
        }
    });

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

            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            return todos[index];
        } catch (error) {
            throw error;
        }
    });
    
    ipcMain.handle('todo:stopReminder', async (event, id) => {
        try {
            const data = await fs.readFile(todosFilePath, 'utf-8');
            const todos = JSON.parse(data);

            const index = todos.findIndex(todo => todo.id === id);
            if (index === -1) {
                throw new Error('待办不存在');
            }

            const todo = todos[index];

            if (todo.repeat && todo.repeat !== 'none') {
                if (todo.repeat === 'weekdays') {
                    const now = new Date();
                    todo.lastRemindedAt = now.toISOString();
                } else {
                    const currentRemindAt = new Date(todo.remindAt);
                    todo.remindAt = calculateNextReminder(currentRemindAt, todo.repeat);
                }
            } else {
                todo.remindAt = null;
            }

            todo.updatedAt = new Date().toISOString();

            await fs.writeFile(todosFilePath, JSON.stringify(todos, null, 2));

            const { BrowserWindow } = require('electron');
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('todo:changed', todos);
            });

            if (onStopReminder) {
                onStopReminder();
            }

            return todo;
        } catch (error) {
            throw error;
        }
    });
}

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
            if (date.date() !== targetDay) {
                date.date(date.daysInMonth());
            }
            break;
        case 'weekdays':
            do {
                date.add(1, 'day');
            } while (date.day() === 0 || date.day() === 6);
            break;
    }

    return date.toISOString();
}

module.exports = { registerTodoHandlers };
