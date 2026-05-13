<template>
  <div class="editor-page">
    <div class="drag-bar drag-region"></div>
    <div class="window-controls no-drag">
      <div class="close-btn-wrapper" @mouseenter="isHoverClose = true" @mouseleave="isHoverClose = false">
        <div v-if="isDirty && !isHoverClose" class="unsaved-dot"></div>
        <button v-else @click="handleCancel">✕</button>
      </div>
    </div>
    <div class="editor-main">
      <div class="title-row">
        <el-input v-model="title" placeholder="标题 (可选)" class="title-input" clearable :disabled="viewMode === 'show'" />
        <div class="mode-toggle">
          <el-button
            v-if="viewMode === 'show'"
            class="btn-toggle"
            @click="switchToEdit"
            size="default"
          >
            <el-icon><Edit /></el-icon>编辑
          </el-button>
          <el-button
            v-else
            class="btn-toggle"
            @click="switchToShow"
            size="default"
          >
            <el-icon><View /></el-icon>预览
          </el-button>
        </div>
      </div>
      <RichEditor
        v-model="content"
        :mode="viewMode === 'show' ? 'preview' : 'edit'"
        @image-uploaded="handleImageUploaded"
        class="rich-editor"
      />
      <div class="reminder-section" v-if="type === 'todo' && viewMode === 'edit'">
        <div class="reminder-header">
          <div class="reminder-switch-row">
            <label class="switch-label"><el-icon><Bell /></el-icon>设置提醒</label>
            <el-switch v-model="isRemind" active-color="#00ff41" inactive-color="#333" />
          </div>
        </div>
        <div class="reminder-body" v-if="isRemind">
          <div class="reminder-row-combined">
            <div class="reminder-item">
              <label>提醒时间</label>
              <el-date-picker v-if="repeatType === 'none'" v-model="reminderDateTime" type="datetime"
                placeholder="选择日期时间" :disabled-date="disabledDate" format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm" class="datetime-picker" size="default" :teleported="false" />
              <el-time-picker v-if="repeatType === 'daily' || repeatType === 'weekdays'" v-model="reminderTime"
                placeholder="选择时间" format="HH:mm" value-format="HH:mm" class="time-picker" size="default" :teleported="false" />
              <div v-if="repeatType === 'weekly'" class="weekly-picker">
                <el-select v-model="reminderWeekday" placeholder="选择周几" class="weekday-select" size="default" :teleported="false">
                  <el-option label="周一" :value="1" /><el-option label="周二" :value="2" />
                  <el-option label="周三" :value="3" /><el-option label="周四" :value="4" />
                  <el-option label="周五" :value="5" /><el-option label="周六" :value="6" />
                  <el-option label="周日" :value="0" />
                </el-select>
                <el-time-picker v-model="reminderTime" placeholder="选择时间" format="HH:mm"
                  value-format="HH:mm" class="time-picker" size="default" :teleported="false" />
              </div>
              <div v-if="repeatType === 'monthly'" class="monthly-picker">
                <el-select v-model="reminderDay" placeholder="选择日期" class="day-select" size="default" :teleported="false">
                  <el-option v-for="day in 31" :key="day" :label="day + '日'" :value="day" />
                </el-select>
                <el-time-picker v-model="reminderTime" placeholder="选择时间" format="HH:mm"
                  value-format="HH:mm" class="time-picker" size="default" :teleported="false" />
              </div>
            </div>
            <div class="reminder-item">
              <label>重复</label>
              <el-select v-model="repeatType" placeholder="请选择" class="repeat-select" size="default" :teleported="false" clearable>
                <el-option label="不重复" value="none" /><el-option label="每天" value="daily" />
                <el-option label="周一至周五" value="weekdays" /><el-option label="每周" value="weekly" />
                <el-option label="每月" value="monthly" />
              </el-select>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="bottom-actions">
      <el-button class="btn-save" @click="handleSave(true)" type="primary" size="large">完成</el-button>
    </div>
    <el-dialog v-model="showCloseConfirm" title="提示" width="300px" :show-close="false"
      :close-on-click-modal="false" :close-on-press-escape="false" class="confirm-dialog" append-to-body>
      <span v-if="isEdit">检测到未保存的内容，是否保存？</span>
      <span v-else>是否取消新增？</span>
      <template #footer>
        <div class="dialog-footer">
          <el-button v-if="isEdit" type="primary" @click="handleSaveAndClose">保存</el-button>
          <el-button v-if="isEdit" @click="handleDiscardAndClose">不保存</el-button>
          <el-button v-if="isEdit" @click="showCloseConfirm = false">取消</el-button>
          <el-button v-if="!isEdit" type="primary" @click="handleDiscardAndClose">确认取消</el-button>
          <el-button v-if="!isEdit" @click="showCloseConfirm = false">继续编辑</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Bell, Edit, View } from '@element-plus/icons-vue';
import RichEditor from '../components/RichEditor.vue';
import moment from 'moment';
import TurndownService from 'turndown';

defineOptions({ name: 'Editor' });

// Turndown 实例，用于 HTML → Markdown 转换
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

/**
 * 修正图片 URL 协议为 local-file:/// 格式
 * 兼容旧数据中的 file:// 和 local-file:// 双斜杠格式
 * @param {String} content - 内容字符串
 * @returns {String} 修正后的内容
 */
const fixImageUrl = (content) => {
  if (!content) return '';
  return content
    .replace(/file:\/\/([A-Za-z]:)/g, 'local-file:///$1')
    .replace(/local-file:\/\/([A-Za-z]:)/g, 'local-file:///$1');
};

/**
 * 将 HTML 内容转换为 Markdown
 * @param {String} html - HTML 字符串
 * @returns {String} Markdown 字符串
 */
const htmlToMarkdown = (html) => {
  if (!html) return '';
  if (!html.startsWith('<')) return fixImageUrl(html);
  return fixImageUrl(turndownService.turndown(html));
};

// 当前编辑的待办ID，null 表示新建模式
const todoId = ref(null);
// 标题
const title = ref('');
// 内容（Markdown 格式）
const content = ref('');
// 图片路径列表
const images = ref([]);
// 类型（note/todo）
const type = ref('note');
// 提醒日期时间（一次性提醒）
const reminderDateTime = ref('');
// 提醒时间（重复提醒）
const reminderTime = ref('');
// 提醒周几（每周提醒，1=周一，0=周日）
const reminderWeekday = ref(1);
// 提醒日期（每月提醒，1-31）
const reminderDay = ref(1);
// 重复类型（none/daily/weekdays/weekly/monthly）
const repeatType = ref('none');
// 是否开启提醒
const isRemind = ref(false);
// 当前视图模式（show=展示/preview，edit=编辑）
const viewMode = ref('edit');

// 是否为编辑模式（有 ID 即为编辑）
const isEdit = computed(() => !!todoId.value);

// 初始数据快照（用于脏检查）
const initialSnapshot = ref('');
// 是否显示关闭确认弹窗
const showCloseConfirm = ref(false);
// 鼠标是否悬停在关闭按钮区域
const isHoverClose = ref(false);

/**
 * 获取当前数据快照
 * @returns {String} JSON 格式的数据快照
 */
const getSnapshot = () => {
  return JSON.stringify({
    title: title.value, content: content.value, images: images.value, type: type.value,
    isRemind: isRemind.value, reminderDateTime: reminderDateTime.value, reminderTime: reminderTime.value,
    reminderWeekday: reminderWeekday.value, reminderDay: reminderDay.value, repeatType: repeatType.value
  });
};

// 数据是否已修改
const isDirty = computed(() => {
  if (!initialSnapshot.value) return false;
  return getSnapshot() !== initialSnapshot.value;
});

/**
 * 切换到编辑模式
 */
const switchToEdit = () => {
  viewMode.value = 'edit';
};

/**
 * 切换到展示模式
 */
const switchToShow = () => {
  viewMode.value = 'show';
};

/**
 * 禁用过去的日期
 * @param {Date} time - 日期对象
 * @returns {Boolean} 是否禁用
 */
const disabledDate = (time) => {
  return moment(time).isBefore(moment(), 'day');
};

/**
 * 加载待办数据
 * @param {String} id - 待办ID
 */
const loadTodo = async (id) => {
  try {
    const todo = await window.api.getTodoById(id);
    if (todo) {
      title.value = todo.title;
      // 自动将旧 HTML 数据转换为 Markdown
      content.value = htmlToMarkdown(todo.content || '');
      images.value = todo.images || [];
      type.value = todo.type || 'note';
      // 解析提醒时间
      if (todo.remindAt) {
        isRemind.value = true;
        const remindDate = moment(todo.remindAt);
        if (todo.repeat === 'none') {
          reminderDateTime.value = remindDate.format('YYYY-MM-DDTHH:mm');
        } else if (todo.repeat === 'daily' || todo.repeat === 'weekdays') {
          reminderTime.value = remindDate.format('HH:mm');
        } else if (todo.repeat === 'weekly') {
          reminderWeekday.value = remindDate.day();
          reminderTime.value = remindDate.format('HH:mm');
        } else if (todo.repeat === 'monthly') {
          reminderDay.value = remindDate.date();
          reminderTime.value = remindDate.format('HH:mm');
        }
      } else {
        isRemind.value = false;
      }
      repeatType.value = todo.repeat || 'none';
      // 有 ID 时默认展示模式
      viewMode.value = 'show';
      initialSnapshot.value = getSnapshot();
    }
  } catch (error) {
    ElMessage.error('加载待办事项失败');
  }
};

/**
 * 处理图片上传完成事件
 * @param {String} imagePath - 图片路径
 */
const handleImageUploaded = (imagePath) => {
  if (!images.value.includes(imagePath)) {
    images.value.push(imagePath);
  }
};

/**
 * 从 Markdown 内容提取纯文本
 * @param {String} md - Markdown 字符串
 * @returns {String} 纯文本内容
 */
const stripMarkdown = (md) => {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/>\s+/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\d+\.\s+/g, '')
    .replace(/\n{2,}/g, ' ')
    .trim();
};

/**
 * 保存待办/笔记
 * @param {Boolean} closeAfterSave - 保存后是否关闭窗口
 */
const handleSave = async (closeAfterSave = true) => {
  // 自动生成标题
  let saveTitle = title.value.trim();
  if (!saveTitle) {
    const text = stripMarkdown(content.value);
    saveTitle = text.slice(0, 20) || '未命名笔记';
  }
  // 计算提醒时间
  let remindAt = null;
  if (isRemind.value) {
    const now = moment();
    // 一次性提醒
    if (repeatType.value === 'none') {
      if (!reminderDateTime.value) { ElMessage.warning('请选择提醒时间'); return; }
      const selectedDate = moment(reminderDateTime.value);
      if (selectedDate.isSameOrBefore(now)) { ElMessage.warning('提醒时间必须晚于当前时间'); return; }
      remindAt = selectedDate.toISOString();
    }
    // 每天提醒
    else if (repeatType.value === 'daily') {
      if (!reminderTime.value) { ElMessage.warning('请选择提醒时间'); return; }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      const nextReminder = moment().hours(hours).minutes(minutes).seconds(0);
      if (nextReminder.isSameOrBefore(now)) { nextReminder.add(1, 'day'); }
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    }
    // 工作日提醒
    else if (repeatType.value === 'weekdays') {
      if (!reminderTime.value) { ElMessage.warning('请选择提醒时间'); return; }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      let nextReminder = moment().hours(hours).minutes(minutes).seconds(0);
      if (nextReminder.isSameOrBefore(now)) { nextReminder.add(1, 'day'); }
      while (nextReminder.day() === 0 || nextReminder.day() === 6) { nextReminder.add(1, 'day'); }
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    }
    // 每周提醒
    else if (repeatType.value === 'weekly') {
      if (reminderWeekday.value === null || reminderWeekday.value === undefined || !reminderTime.value) {
        ElMessage.warning('请选择提醒时间和周几'); return;
      }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      let nextReminder = moment().day(reminderWeekday.value).hours(hours).minutes(minutes).seconds(0);
      if (nextReminder.isSameOrBefore(now)) { nextReminder.add(1, 'week'); }
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    }
    // 每月提醒
    else if (repeatType.value === 'monthly') {
      if (reminderDay.value === null || reminderDay.value === undefined || !reminderTime.value) {
        ElMessage.warning('请选择提醒时间和日期'); return;
      }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      let nextReminder = moment().date(reminderDay.value).hours(hours).minutes(minutes).seconds(0);
      if (nextReminder.isSameOrBefore(now)) { nextReminder.add(1, 'month'); }
      if (nextReminder.date() !== reminderDay.value) {
        nextReminder.date(nextReminder.daysInMonth());
        if (nextReminder.isSameOrBefore(now)) {
          nextReminder.add(1, 'month');
          nextReminder.date(nextReminder.daysInMonth());
        }
      }
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    }
  }
  // 构建待办数据
  const todoData = {
    title: String(saveTitle),
    content: String(content.value || ''),
    images: Array.isArray(images.value) ? images.value.map(img => String(img)) : [],
    type: String(type.value),
    remindAt: remindAt,
    repeat: String(repeatType.value),
    updatedAt: moment().toISOString()
  };
  // 编辑模式：检查是否需要重置提醒状态
  if (isEdit.value) {
    try {
      const existingTodo = await window.api.getTodoById(todoId.value);
      if (existingTodo) {
        if (existingTodo.repeat !== repeatType.value || (existingTodo.remindAt && remindAt && existingTodo.remindAt !== remindAt)) {
          todoData.lastRemindedAt = null;
        }
      }
    } catch (error) { /* 获取待办失败 */ }
  }
  // 执行保存
  try {
    if (isEdit.value) {
      await window.api.updateTodo(todoId.value, todoData);
      ElMessage.success('保存成功');
    } else {
      await window.api.createTodo(todoData);
      ElMessage.success('创建成功');
    }
    initialSnapshot.value = getSnapshot();
    showCloseConfirm.value = false;
    if (closeAfterSave) {
      setTimeout(() => { window.api.closeEditor(); }, 500);
    }
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message);
  }
};

// 处理关闭按钮点击
const handleCancel = () => {
  if (isDirty.value) {
    showCloseConfirm.value = true;
  } else {
    window.api.closeEditor();
  }
};

// 保存并关闭
const handleSaveAndClose = () => { handleSave(true); };

// 丢弃更改并关闭
const handleDiscardAndClose = () => { window.api.closeEditor(); };

/**
 * 处理键盘快捷键
 * @param {KeyboardEvent} e - 键盘事件
 */
const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (isEdit.value) { handleSave(false); }
  }
};

// 组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

// 组件挂载时初始化
onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const id = urlParams.get('id');
  const urlType = urlParams.get('type');
  if (urlType) { type.value = urlType; }
  if (id) {
    todoId.value = id;
    loadTodo(id);
  } else {
    // 新建时默认编辑模式
    viewMode.value = 'edit';
    initialSnapshot.value = getSnapshot();
  }
  // 监听来自主进程的 load-todo 事件
  if (window.api && window.api.onLoadTodo) {
    window.api.onLoadTodo((id, newType) => {
      title.value = ''; content.value = ''; images.value = [];
      reminderDateTime.value = ''; reminderTime.value = '';
      reminderWeekday.value = 1; reminderDay.value = 1;
      isRemind.value = false; repeatType.value = 'none';
      if (id) {
        todoId.value = id;
        loadTodo(id);
      } else {
        todoId.value = null;
        if (newType) { type.value = newType; }
        viewMode.value = 'edit';
        initialSnapshot.value = getSnapshot();
      }
    });
  }
});
</script>

<style scoped>
.editor-page { display: flex; flex-direction: column; height: 100vh; background: var(--bg-page); color: var(--text-primary); position: relative; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.drag-bar { height: 32px; width: 100%; position: absolute; top: 0; left: 0; z-index: 50; background: var(--bg-header); border-bottom: 1px solid var(--border-main); }
.window-controls { position: absolute; top: 0; right: 0; z-index: 100; display: flex; gap: 0; height: 32px; align-items: center; padding: 0 4px; }
.close-btn-wrapper { width: 36px; height: 28px; margin: 2px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: all 0.2s ease; }
.close-btn-wrapper:hover { background: rgba(255, 105, 0, 0.1); }
.unsaved-dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--mi-orange); box-shadow: 0 0 4px rgba(255, 105, 0, 0.4); }
.window-controls button { padding: 6px 10px; font-size: 16px; color: var(--text-secondary); background: transparent; border: none; border-radius: 4px; transition: all 0.2s ease; font-family: inherit; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; margin: 0; }
.window-controls button:hover { color: var(--mi-orange); }
.editor-main { flex: 1; display: flex; flex-direction: column; padding-top: 32px; overflow: hidden; background: var(--bg-page); }
.title-row { display: flex; align-items: center; flex-shrink: 0; border-bottom: 1px solid var(--border-main); background: var(--bg-card); }
.title-input { flex: 1; padding: 16px 20px; font-size: 20px; font-weight: 600; background: var(--bg-card) !important; border: none !important; color: var(--text-primary) !important; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; border-radius: 0 !important; }
.title-input::placeholder { color: var(--text-tertiary); font-weight: 400; opacity: 0.8; }
.title-input:focus { background: var(--bg-card) !important; border-bottom-color: var(--mi-orange) !important; box-shadow: 0 2px 8px rgba(255, 105, 0, 0.1) !important; }
.mode-toggle { padding-right: 16px; flex-shrink: 0; }
.btn-toggle { background: var(--bg-card) !important; border: 1px solid var(--border-main) !important; border-radius: var(--radius-md) !important; color: var(--text-secondary) !important; font-weight: 500 !important; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important; transition: all 0.2s ease !important; }
.btn-toggle:hover { border-color: var(--mi-orange) !important; color: var(--mi-orange) !important; background: rgba(255, 105, 0, 0.05) !important; }
.rich-editor { flex: 1; overflow: hidden; padding: 16px 20px; }
.bottom-actions { height: 56px; display: flex; justify-content: flex-end; align-items: center; padding: 0 20px; flex-shrink: 0; z-index: 100; background: var(--bg-card); border-top: 1px solid var(--border-main); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; gap: 12px; }
.btn-save { background: var(--mi-orange); border: 1px solid var(--mi-orange); color: #FFFFFF; font-weight: 600; border-radius: var(--radius-lg); padding: 10px 32px; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; letter-spacing: 0.5px; transition: all 0.2s ease; box-shadow: var(--shadow-sm); }
.btn-save:hover { background: var(--mi-orange-hover); border-color: var(--mi-orange-hover); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.btn-save:active { transform: translateY(0); }
.reminder-section { padding: 0; background: var(--bg-card); margin-top: auto; flex-shrink: 0; border-top: 1px solid var(--border-main); transition: all 0.2s ease; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.reminder-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); }
.reminder-switch-row { display: flex; justify-content: space-between; align-items: center; }
.switch-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-primary); font-weight: 500; }
.reminder-body { padding: 0 20px 16px 20px; animation: slideDown 0.2s ease; }
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.reminder-row-combined { display: flex; gap: 12px; align-items: flex-end; }
.reminder-item { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.reminder-item label { font-size: 12px; color: var(--text-tertiary); font-weight: 500; }
.datetime-picker, .repeat-select, .time-picker, .weekday-select, .day-select { width: 100%; }
.weekly-picker, .monthly-picker { display: flex; gap: 8px; }
</style>
