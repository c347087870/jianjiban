<template>
  <div class="settings-page">
    <div class="settings-content">
      <h1>设置</h1>
      
      <div class="settings-group">
        <h3>快捷键</h3>
        
        <div class="setting-item">
          <label>显示/隐藏主窗口</label>
          <el-input
            :model-value="formatShortcut(shortcuts.toggleWindow)"
            readonly
            @keydown.prevent="recordShortcut($event, 'toggleWindow')"
            placeholder="按下快捷键..."
          />
        </div>

        <div class="setting-item">
          <label>新建待办</label>
          <el-input
            :model-value="formatShortcut(shortcuts.newTodo)"
            readonly
            @keydown.prevent="recordShortcut($event, 'newTodo')"
            placeholder="按下快捷键..."
          />
        </div>

        <div class="setting-item">
          <label>新建笔记</label>
          <el-input
            :model-value="formatShortcut(shortcuts.newNote)"
            readonly
            @keydown.prevent="recordShortcut($event, 'newNote')"
            placeholder="按下快捷键..."
          />
        </div>
      </div>

      <el-divider />

      <div class="settings-group">
        <h3>显示设置</h3>
        <div class="setting-item">
          <el-checkbox v-model="displaySettings.showTodos">
            显示待办事项
          </el-checkbox>
        </div>
        <div class="setting-item">
          <el-checkbox v-model="displaySettings.showNotes">
            显示笔记
          </el-checkbox>
        </div>
        <div class="setting-item">
          <el-checkbox v-model="autoStart">
            开机自启
          </el-checkbox>
        </div>
      </div>

      <div class="settings-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

defineOptions({
  name: 'Settings'
});

const shortcuts = ref({
  toggleWindow: '',
  newTodo: '',
  newNote: ''
});

const displaySettings = ref({
  showTodos: true,
  showNotes: true
});

const autoStart = ref(false);

const loadSettings = async () => {
  try {
    const settings = await window.api.getSettings();
    if (settings && settings.shortcuts) {
      shortcuts.value = {
        toggleWindow: settings.shortcuts.toggleWindow || '',
        newTodo: settings.shortcuts.newTodo || '',
        newNote: settings.shortcuts.newNote || ''
      };
    }
    if (settings && settings.display) {
      displaySettings.value = { ...settings.display };
    }
    if (typeof settings?.autoStart !== 'undefined') {
      autoStart.value = !!settings.autoStart;
    }
  } catch (error) {
    // Load settings failed
  }
};

const formatShortcut = (shortcut) => {
  if (!shortcut) return '';
  return shortcut.replace('CommandOrControl', 'Ctrl');
};

const recordShortcut = (event, key) => {
  const { key: eventKey, ctrlKey, metaKey, altKey, shiftKey } = event;
  
  // Ignore standalone modifier keys
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(eventKey)) return;

  const modifiers = [];
  if (ctrlKey || metaKey) modifiers.push('CommandOrControl');
  if (altKey) modifiers.push('Alt');
  if (shiftKey) modifiers.push('Shift');

  if (modifiers.length === 0) return; // Require at least one modifier

  const code = eventKey.toUpperCase();
  const shortcut = [...modifiers, code].join('+');
  
  shortcuts.value[key] = shortcut;
};

const saveSettings = async () => {
  if (!displaySettings.value.showTodos && !displaySettings.value.showNotes) {
    ElMessage.warning('请至少选择显示一种类型（待办或笔记）');
    return;
  }
  
  try {
    const currentSettings = await window.api.getSettings();
    
    const newSettings = {
      ...currentSettings,
      shortcuts: JSON.parse(JSON.stringify(shortcuts.value)),
      display: JSON.parse(JSON.stringify(displaySettings.value)),
      autoStart: !!autoStart.value
    };
    
    await window.api.updateSettings(newSettings);
    
    ElMessage.success('设置已保存，重启应用后生效');
    
    setTimeout(() => {
      window.close();
    }, 1000);
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message);
  }
};

const handleClose = () => {
  window.close();
};

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.settings-page {
  height: 100vh;
  background-color: #1e1e1e; /* 更深的背景色 */
  padding: 20px;
  color: #e0e0e0;
  box-sizing: border-box;
  overflow-y: auto;
}

.settings-content {
  max-width: 100%;
  margin: 0 auto;
}

h1 {
  font-size: 20px;
  margin-bottom: 20px;
  color: #fff;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
}

.settings-group {
  margin-bottom: 25px;
  background: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 8px;
}

.settings-group h3 {
  font-size: 14px;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.setting-item {
  margin-bottom: 15px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #ccc;
}

.settings-footer {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Element Plus 覆盖样式 */
:deep(.el-input__wrapper) {
  background-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

:deep(.el-input__inner) {
  color: #fff;
  font-size: 13px;
}

:deep(.el-divider) {
  border-color: rgba(255, 255, 255, 0.1);
  margin: 20px 0;
}

:deep(.el-checkbox) {
  color: #ccc;
}
</style>
