<template>
  <div class="editor-page">
    <div class="drag-bar drag-region"></div>
    <div class="window-controls no-drag">
      <button @click="handleCancel">✕</button>
    </div>

    <div class="editor-main">
      <!-- Hidden Title Input (Auto-generated or Optional) -->
      <el-input 
        v-model="title" 
        placeholder="标题 (可选)"
        class="title-input"
        clearable
      />
      
      <RichEditor 
        v-model="content"
        @image-uploaded="handleImageUploaded"
        class="rich-editor"
      />

      <!-- Reminder Settings -->
      <div class="reminder-section" v-if="type === 'todo'">
        <div class="reminder-header">
          <div class="reminder-switch-row">
            <label class="switch-label">
              <el-icon><Bell /></el-icon>
              设置提醒
            </label>
            <el-switch
              v-model="isRemind"
              active-color="#00ff41"
              inactive-color="#333"
            />
          </div>
        </div>
        
        <div class="reminder-body" v-if="isRemind">
          <div class="reminder-row-combined">
            <div class="reminder-item">
              <label>提醒时间</label>
              <el-date-picker
                v-if="repeatType === 'none'"
                v-model="reminderDateTime"
                type="datetime"
                placeholder="选择日期时间"
                :disabled-date="disabledDate"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm"
                class="datetime-picker"
                size="default"
                :teleported="false"
              />
              <el-time-picker
                v-if="repeatType === 'daily' || repeatType === 'weekdays'"
                v-model="reminderTime"
                placeholder="选择时间"
                format="HH:mm"
                value-format="HH:mm"
                class="time-picker"
                size="default"
                :teleported="false"
              />
              <div v-if="repeatType === 'weekly'" class="weekly-picker">
                <el-select
                  v-model="reminderWeekday"
                  placeholder="选择周几"
                  class="weekday-select"
                  size="default"
                  :teleported="false"
                >
                  <el-option label="周一" :value="1" />
                  <el-option label="周二" :value="2" />
                  <el-option label="周三" :value="3" />
                  <el-option label="周四" :value="4" />
                  <el-option label="周五" :value="5" />
                  <el-option label="周六" :value="6" />
                  <el-option label="周日" :value="0" />
                </el-select>
                <el-time-picker
                  v-model="reminderTime"
                  placeholder="选择时间"
                  format="HH:mm"
                  value-format="HH:mm"
                  class="time-picker"
                  size="default"
                  :teleported="false"
                />
              </div>
              <div v-if="repeatType === 'monthly'" class="monthly-picker">
                <el-select
                  v-model="reminderDay"
                  placeholder="选择日期"
                  class="day-select"
                  size="default"
                  :teleported="false"
                >
                  <el-option
                    v-for="day in 31"
                    :key="day"
                    :label="day + '日'"
                    :value="day"
                  />
                </el-select>
                <el-time-picker
                  v-model="reminderTime"
                  placeholder="选择时间"
                  format="HH:mm"
                  value-format="HH:mm"
                  class="time-picker"
                  size="default"
                  :teleported="false"
                />
              </div>
            </div>
            <div class="reminder-item">
              <label>重复</label>
              <el-select 
                v-model="repeatType" 
                placeholder="请选择" 
                class="repeat-select" 
                size="default"
                :teleported="false"
                clearable
              >
                <el-option label="不重复" value="none" />
                <el-option label="每天" value="daily" />
                <el-option label="周一至周五" value="weekdays" />
                <el-option label="每周" value="weekly" />
                <el-option label="每月" value="monthly" />
              </el-select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-actions">
      <el-button 
        class="btn-save" 
        @click="handleSave"
        type="primary"
        size="large"
      >
        完成
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Bell } from '@element-plus/icons-vue';
import RichEditor from '../components/RichEditor.vue';
import moment from 'moment';

defineOptions({
  name: 'Editor'
});

const todoId = ref(null); // 待办事项ID
const title = ref(''); // 标题
const content = ref(''); // 内容
const images = ref([]); // 图片列表
const type = ref('note'); // 类型：note/todo
const reminderDateTime = ref(''); // 提醒日期时间（一次性）
const reminderTime = ref(''); // 提醒时间（重复提醒）
const reminderWeekday = ref(1); // 提醒周几（1-7, 1=周一）
const reminderDay = ref(1); // 提醒日期（1-31）
const repeatType = ref('none'); // 重复类型：none/daily/weekdays/weekly/monthly
const isRemind = ref(false); // 是否开启提醒
const isEdit = computed(() => !!todoId.value); // 是否为编辑模式

// 计算背景色 - 小米风格
const editorBgColor = computed(() => {
  return type.value === 'todo' ? 'linear-gradient(135deg, rgba(255, 105, 0, 0.03) 0%, rgba(255, 185, 0, 0.03) 100%)' : 'linear-gradient(135deg, rgba(46, 125, 255, 0.03) 0%, rgba(0, 184, 148, 0.03) 100%)';
});

const disabledDate = (time) => {
  return moment(time).isBefore(moment(), 'day');
};

const loadTodo = async (id) => {
  try {
    const todo = await window.api.getTodoById(id);
    if (todo) {
      title.value = todo.title;
      content.value = todo.content;
      images.value = todo.images || [];
      type.value = todo.type || 'note';
      
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
    }
  } catch (error) {
    ElMessage.error('加载待办事项失败');
  }
};

const handleImageUploaded = (imagePath) => {
  if (!images.value.includes(imagePath)) {
    images.value.push(imagePath);
  }
};

const triggerImageUpload = () => {
  // Find the image upload button in Quill toolbar and click it
  const imageBtn = document.querySelector('.ql-image');
  if (imageBtn) imageBtn.click();
};

const handleSave = async () => {
  let saveTitle = title.value.trim();
  
  if (!saveTitle) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content.value;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    saveTitle = text.slice(0, 20) || '未命名笔记';
  }

  let remindAt = null;
  if (isRemind.value) {
    const now = moment();
    
    if (repeatType.value === 'none') {
      if (!reminderDateTime.value) {
        ElMessage.warning('请选择提醒时间');
        return;
      }
      const selectedDate = moment(reminderDateTime.value);
      
      if (selectedDate.isSameOrBefore(now)) {
        ElMessage.warning('提醒时间必须晚于当前时间');
        return;
      }
      
      remindAt = selectedDate.toISOString();
    } else if (repeatType.value === 'daily') {
      if (!reminderTime.value) {
        ElMessage.warning('请选择提醒时间');
        return;
      }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      const nextReminder = moment().hours(hours).minutes(minutes).seconds(0);

      if (nextReminder.isSameOrBefore(now)) {
        nextReminder.add(1, 'day');
      }

      // 使用与 weekdays 一致的格式
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    } else if (repeatType.value === 'weekdays') {
      if (!reminderTime.value) {
        ElMessage.warning('请选择提醒时间');
        return;
      }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      let nextReminder = moment().hours(hours).minutes(minutes).seconds(0);

      if (nextReminder.isSameOrBefore(now)) {
        nextReminder.add(1, 'day');
      }

      while (nextReminder.day() === 0 || nextReminder.day() === 6) {
        nextReminder.add(1, 'day');
      }

      // 存储时间格式为 "YYYY-MM-DDTHH:mm:ss"，保留用户选择的时间
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    } else if (repeatType.value === 'weekly') {
      if (reminderWeekday.value === null || reminderWeekday.value === undefined || !reminderTime.value) {
        ElMessage.warning('请选择提醒时间和周几');
        return;
      }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      let nextReminder = moment().day(reminderWeekday.value).hours(hours).minutes(minutes).seconds(0);

      if (nextReminder.isSameOrBefore(now)) {
        nextReminder.add(1, 'week');
      }

      // 使用与 weekdays 一致的格式
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    } else if (repeatType.value === 'monthly') {
      if (reminderDay.value === null || reminderDay.value === undefined || !reminderTime.value) {
        ElMessage.warning('请选择提醒时间和日期');
        return;
      }
      const [hours, minutes] = reminderTime.value.split(':').map(Number);
      let nextReminder = moment().date(reminderDay.value).hours(hours).minutes(minutes).seconds(0);
      
      if (nextReminder.isSameOrBefore(now)) {
        nextReminder.add(1, 'month');
      }
      
      if (nextReminder.date() !== reminderDay.value) {
        nextReminder.date(nextReminder.daysInMonth());
        if (nextReminder.isSameOrBefore(now)) {
          nextReminder.add(1, 'month');
          nextReminder.date(nextReminder.daysInMonth());
        }
      }

      // 使用与 weekdays 一致的格式
      remindAt = nextReminder.format('YYYY-MM-DD') + 'T' + reminderTime.value + ':00';
    }
  }

  const todoData = {
    title: String(saveTitle),
    content: String(content.value || ''),
    images: Array.isArray(images.value) ? images.value.map(img => String(img)) : [],
    type: String(type.value),
    remindAt: remindAt,
    repeat: String(repeatType.value),
    updatedAt: new Date().toISOString()
  };

  if (isEdit.value) {
    try {
      const existingTodo = await window.api.getTodoById(todoId.value);
      if (existingTodo) {
        if (existingTodo.repeat !== repeatType.value || 
            (existingTodo.remindAt && remindAt && existingTodo.remindAt !== remindAt)) {
          todoData.lastRemindedAt = null;
        }
      }
    } catch (error) {
    }
  }
  
  try {
    if (isEdit.value) {
      await window.api.updateTodo(todoId.value, todoData);
      ElMessage.success('保存成功');
    } else {
      await window.api.createTodo(todoData);
      ElMessage.success('创建成功');
    }
    setTimeout(() => {
      window.api.closeEditor();
    }, 500);
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message);
  }
};

const handleCancel = () => {
  window.api.closeEditor();
};

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const id = urlParams.get('id');
  const urlType = urlParams.get('type');
  
  if (urlType) {
    type.value = urlType;
  }
  
  if (id) {
    todoId.value = id;
    loadTodo(id);
  }
  
  // 监听来自主进程的 load-todo 事件
  if (window.api && window.api.onLoadTodo) {
    window.api.onLoadTodo((id, newType) => {
      // 重置数据
      title.value = '';
      content.value = '';
      images.value = [];
      reminderDateTime.value = '';
      reminderTime.value = '';
      reminderWeekday.value = 1;
      reminderDay.value = 1;
      isRemind.value = false;
      repeatType.value = 'none';

      if (id) {
        todoId.value = id;
        loadTodo(id);
      } else {
        todoId.value = null;
        if (newType) {
            type.value = newType;
        }
      }
    });
  }
});
</script>

<style scoped>
/* Editor Page - 小米风格 */
.editor-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}

.drag-bar {
  height: 32px;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 50;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-main);
}

.window-controls {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 100;
  display: flex;
  gap: 0;
  height: 32px;
  align-items: center;
  padding: 0 4px;
}

.window-controls button {
  padding: 6px 10px;
  font-size: 16px;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 28px;
  margin: 2px;
}

.window-controls button:hover {
  color: var(--mi-orange);
  background: rgba(255, 105, 0, 0.1);
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 32px;
  overflow: hidden;
  background: var(--bg-page);
}

.title-input {
  padding: 16px 20px;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--bg-card) !important;
  border: none !important;
  border-bottom: 1px solid var(--border-main) !important;
  color: var(--text-primary) !important;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
  border-radius: 0 !important;
}

.title-input::placeholder {
  color: var(--text-tertiary);
  font-weight: 400;
  opacity: 0.8;
}

.title-input:focus {
  background: var(--bg-card) !important;
  border-bottom-color: var(--mi-orange) !important;
  box-shadow: 0 2px 8px rgba(255, 105, 0, 0.1) !important;
}

.rich-editor {
  flex: 1;
  overflow: hidden;
  padding: 16px 20px;
}

.bottom-actions {
  height: 56px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0 20px;
  flex-shrink: 0;
  z-index: 100;
  background: var(--bg-card);
  border-top: 1px solid var(--border-main);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
  gap: 12px;
}

.btn-action {
  background: var(--bg-card);
  border: 1px solid var(--border-main);
  border-radius: var(--radius-md);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
  cursor: pointer;
  color: var(--text-secondary);
  font-weight: 500;
}

.btn-action:hover {
  border-color: var(--mi-orange);
  color: var(--mi-orange);
  background: rgba(255, 105, 0, 0.05);
  transform: translateY(-1px);
}

.btn-save {
  background: var(--mi-orange);
  border: 1px solid var(--mi-orange);
  color: #FFFFFF;
  font-weight: 600;
  border-radius: var(--radius-lg);
  padding: 10px 32px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.btn-save:hover {
  background: var(--mi-orange-hover);
  border-color: var(--mi-orange-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.btn-save:active {
  transform: translateY(0);
}

.reminder-section {
  padding: 0;
  background: var(--bg-card);
  margin-top: auto;
  flex-shrink: 0;
  border-top: 1px solid var(--border-main);
  transition: all 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}

.reminder-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-main);
}

.reminder-switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.reminder-body {
  padding: 0 20px 16px 20px;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.reminder-row-combined {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.reminder-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.reminder-item label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.datetime-picker,
.repeat-select,
.time-picker,
.weekday-select,
.day-select {
  width: 100%;
}

.weekly-picker,
.monthly-picker {
  display: flex;
  gap: 8px;
}

.weekday-select,
.day-select {
  flex: 1;
  min-width: 80px;
}

.time-picker {
  flex: 1;
}
</style>
