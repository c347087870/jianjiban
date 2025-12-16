const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 注册存储相关的 IPC 处理器
 */
function registerStorageHandlers(ipcMain, imagesDir) {

    // 保存图片
    ipcMain.handle('image:save', async (event, base64Data) => {
        try {
            // 去除 base64 前缀
            const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                throw new Error('无效的图片数据');
            }

            const ext = matches[1];
            const data = matches[2];
            const buffer = Buffer.from(data, 'base64');

            // 生成唯一文件名
            const filename = `${uuidv4()}.${ext}`;
            const filepath = path.join(imagesDir, filename);

            // 保存文件
            await fs.writeFile(filepath, buffer);

            return {
                path: `images/${filename}`,
                url: `file://${filepath}`
            };
        } catch (error) {
            throw error;
        }
    });

    // 删除图片
    ipcMain.handle('image:delete', async (event, imagePath) => {
        try {
            const filename = path.basename(imagePath);
            const filepath = path.join(imagesDir, filename);

            await fs.unlink(filepath);
            return true;
        } catch (error) {
            throw error;
        }
    });

    // 获取图片路径
    ipcMain.handle('image:getPath', async (event, filename) => {
        try {
            const filepath = path.join(imagesDir, filename);
            return `file://${filepath}`;
        } catch (error) {
            throw error;
        }
    });
}

module.exports = { registerStorageHandlers };
