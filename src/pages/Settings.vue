<template>
  <div class="settings-page">
    <div class="settings-content">
      <h1>设置</h1>
      <div class="settings-group">
        <h3>快捷键</h3>
        <div class="setting-item">
          <label>显示/隐藏主窗口</label>
          <el-input :model-value="formatShortcut(shortcuts.toggleWindow)" readonly
            @keydown.prevent="recordShortcut($event, 'toggleWindow')" placeholder="按下快捷键..." />
        </div>
        <div class="setting-item">
          <label>新建待办</label>
          <el-input :model-value="formatShortcut(shortcuts.newTodo)" readonly
            @keydown.prevent="recordShortcut($event, 'newTodo')" placeholder="按下快捷键..." />
        </div>
        <div class="setting-item">
          <label>新建笔记</label>
          <el-input :model-value="formatShortcut(shortcuts.newNote)" readonly
            @keydown.prevent="recordShortcut($event, 'newNote')" placeholder="按下快捷键..." />
        </div>
      </div>
      <el-divider />
      <div class="settings-group">
        <h3>显示设置</h3>
        <div class="setting-item">
          <el-checkbox v-model="displaySettings.showTodos">显示待办事项</el-checkbox>
        </div>
        <div class="setting-item">
          <el-checkbox v-model="displaySettings.showNotes">显示笔记</el-checkbox>
        </div>
        <div class="setting-item">
          <el-checkbox v-model="autoStart">开机自启</el-checkbox>
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

defineOptions({ name: 'Settings' });

// 快捷键配置
const shortcuts = ref({
  toggleWindow: '', // 显示/隐藏主窗口快捷键
  newTodo: '',      // 新建待办快捷键
  newNote: ''       // 新建笔记快捷键
});

// 显示设置
const displaySettings = ref({
  showTodos: true,  // 是否显示待办事项
  showNotes: true   // 是否显示笔记
});

// 是否开机自启
const autoStart = ref(false);

/**
 * 加载用户设置
 */
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
    // 设置加载失败
  }
};

/**
 * 格式化快捷键显示
 * @param {String} shortcut - 快捷键字符串
 * @returns {String} 格式化后的快捷键
 */
const formatShortcut = (shortcut) => {
  if (!shortcut) return '';
  return shortcut.replace('CommandOrControl', 'Ctrl');
};

/**
 * 录制快捷键
 * @param {KeyboardEvent} event - 键盘事件
 * @param {String} key - 快捷键配置项名称
 */
const recordShortcut = (event, key) => {
  const { key: eventKey, ctrlKey, metaKey, altKey, shiftKey } = event;
  // 忽略单独的修饰键
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(eventKey)) return;
  // 构建修饰键数组
  const modifiers = [];
  if (ctrlKey || metaKey) modifiers.push('CommandOrControl');
  if (altKey) modifiers.push('Alt');
  if (shiftKey) modifiers.push('Shift');
  // 至少需要一个修饰键
  if (modifiers.length === 0) return;
  // 构建快捷键字符串
  const code = eventKey.toUpperCase();
  const shortcut = [...modifiers, code].join('+');
  shortcuts.value[key] = shortcut;
};

/**
 * 保存设置
 */
const saveSettings = async () => {
  // 验证至少选择一种显示类型
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
    setTimeout(() => { window.close(); }, 1000);
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message);
  }
};

// 关闭设置窗口
const handleClose = () => { window.close(); };

// 组件挂载时加载设置
onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.settings-page { height: 100vh; background-color: var(--bg-page); padding: 20px; color: var(--text-primary); box-sizing: border-box; overflow-y: auto; position: relative; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.settings-content { max-width: 100%; margin: 0 auto; position: relative; padding-top: 16px; }
h1 { font-size: 24px; margin-bottom: 24px; color: var(--text-primary); font-weight: 600; border-bottom: 2px solid var(--mi-orange); padding-bottom: 12px; letter-spacing: 0.5px; }
.settings-group { margin-bottom: 24px; background: var(--bg-card); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border-main); transition: all 0.2s ease; box-shadow: var(--shadow-sm); }
.settings-group:hover { border-color: var(--mi-orange); box-shadow: var(--shadow-md); }
.settings-group h3 { font-size: 15px; margin-bottom: 16px; color: var(--text-primary); font-weight: 600; border-left: 3px solid var(--mi-orange); padding-left: 10px; }
.setting-item { margin-bottom: 16px; }
.setting-item:last-child { margin-bottom: 0; }
.setting-item label { display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.settings-footer { margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px; padding: 16px 20px; border-top: 1px solid var(--border-main); background: var(--bg-card); border-radius: var(--radius-lg); }
::v-deep(.el-input__wrapper) { background-color: var(--bg-card); border: 1px solid var(--border-main); border-radius: var(--radius-md); box-shadow: none !important; transition: all 0.2s ease; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; font-weight: 400; }
::v-deep(.el-input__wrapper:hover) { border-color: var(--mi-orange); box-shadow: 0 2px 8px rgba(255, 105, 0, 0.1); }
::v-deep(.el-input__wrapper.is-focus) { border-color: var(--mi-orange); box-shadow: 0 0 0 3px rgba(255, 105, 0, 0.15); }
::v-deep(.el-input__inner) { color: var(--text-primary); font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; font-weight: 400; }
::v-deep(.el-divider) { border-color: var(--border-main); border-style: dashed; margin: 20px 0; }
::v-deep(.el-checkbox) { color: var(--text-secondary); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; font-weight: 500; }
::v-deep(.el-checkbox__inner) { background: var(--bg-card); border: 1px solid var(--border-main); border-radius: 4px; }
::v-deep(.el-checkbox__inner:hover) { border-color: var(--mi-orange); }
::v-deep(.el-checkbox__input.is-checked .el-checkbox__inner) { background: var(--mi-orange); border-color: var(--mi-orange); }
::v-deep(.el-checkbox__input.is-checked + .el-checkbox__label) { color: var(--mi-orange); font-weight: 500; }
::v-deep(.el-button) { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; font-weight: 500; border-radius: var(--radius-md); transition: all 0.2s ease; letter-spacing: 0.3px; }
::v-deep(.el-button--default) { background: var(--bg-card) !important; border: 1px solid var(--border-main) !important; color: var(--text-secondary) !important; }
::v-deep(.el-button--default:hover) { border-color: var(--mi-orange) !important; color: var(--mi-orange) !important; background: rgba(255, 105, 0, 0.05) !important; }
::v-deep(.el-button--primary) { background: var(--mi-orange) !important; border: 1px solid var(--mi-orange) !important; color: #FFFFFF !important; font-weight: 500 !important; }
::v-deep(.el-button--primary:hover) { background: var(--mi-orange-hover) !important; border-color: var(--mi-orange-hover) !important; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3) !important; }
</style>
