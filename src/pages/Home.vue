<template>
  <div class="home-page">
    <div class="header drag-region">
      <div class="logo-area">
        <span class="logo-icon">📒</span>
        <h1>简记办</h1>
      </div>
      <div class="window-controls no-drag">
        <button class="btn-icon" @click="openSettings" title="设置">⚙</button>
        <button @click="minimizeWindow">─</button>
        <button @click="closeWindow">✕</button>
      </div>
    </div>

    <div class="home-body">
      <div class="search-bar">
        <el-input v-model="searchQuery" placeholder="搜索..." :prefix-icon="Search" clearable class="search-input" />
      </div>

      <div class="action-buttons">
        <el-button type="primary" class="btn-add" @click="openEditor(null, 'todo')">
          <span class="btn-icon">+</span> 待办
        </el-button>
        <el-button type="success" class="btn-add" @click="openEditor(null, 'note')">
          <span class="btn-icon">+</span> 笔记
        </el-button>
      </div>

      <!-- Todo List -->
      <div class="todo-list" v-if="activeTab === 'todo'">
        <div v-if="filteredTodos.length === 0" class="empty-state">
          <div class="empty-text">没有待办事项</div>
        </div>
        <div v-for="todo in filteredTodos" :key="todo.id" class="todo-item"
          :class="{ completed: todo.completed, 'is-due': isDue(todo) }" @click="openEditor(todo.id, 'todo')">
          <div class="todo-main">
            <el-checkbox v-model="todo.completed" @change="toggleComplete(todo.id)" @click.stop />
            <div class="todo-content">
              <div class="todo-title">{{ todo.title || '无标题' }}</div>
              <div class="todo-preview">{{ stripHtml(todo.content) }}</div>
              <div class="todo-meta">
                <span v-if="todo.remindAt" class="meta-time" :class="{ 'todo-due': isDue(todo) }">
                  <el-icon>
                    <BellFilled />
                  </el-icon>
                  {{ formatTime(todo.remindAt) }}
                </span>
                <span v-if="todo.repeat && todo.repeat !== 'none'">🔁</span>
              </div>
            </div>
          </div>

          <div class="todo-actions" @click.stop>
            <el-button v-if="isDue(todo) && !todo.completed" type="warning" circle size="small"
              class="btn-stop-reminder" @click="stopReminder(todo.id)" title="停止提醒">
              <el-icon>
                <BellFilled />
              </el-icon>
            </el-button>
            <el-button type="danger" :icon="Delete" circle size="small" class="btn-delete" @click="deleteTodo(todo.id)"
              title="删除" />
          </div>
        </div>
      </div>

      <!-- Note List -->
      <div class="note-list" v-if="activeTab === 'note'">
        <div v-if="filteredNotes.length === 0" class="empty-state">
          <div class="empty-text">没有笔记</div>
        </div>
        <div v-for="note in filteredNotes" :key="note.id" class="note-item" @click="openEditor(note.id, 'note')">
          <div class="note-main">
            <div class="note-content">
              <div class="note-title">{{ note.title || '无标题' }}</div>
              <div class="note-preview">{{ stripHtml(note.content) }}</div>
              <div class="note-meta">
                <span class="note-date">{{ formatTime(note.updatedAt) }}</span>
              </div>
            </div>
          </div>
          <div class="note-actions" @click.stop>
            <el-button type="danger" :icon="Delete" circle size="small" class="btn-delete" @click="deleteTodo(note.id)"
              title="删除" />
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Tabs -->
    <div class="bottom-tabs">
      <div class="tab-item" :class="{ active: activeTab === 'todo' }" @click="activeTab = 'todo'">
        待办
      </div>
      <div class="tab-item" :class="{ active: activeTab === 'note' }" @click="activeTab = 'note'">
        笔记
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Search, Delete, BellFilled } from '@element-plus/icons-vue';
import moment from 'moment';

defineOptions({
  name: 'Home'
});

const todos = ref([]);
const searchQuery = ref('');
const displaySettings = ref({ showTodos: true, showNotes: true });

const activeTab = ref('todo');
const currentTime = ref(new Date());

// Update time every minute to refresh due status
setInterval(() => {
  currentTime.value = new Date();
}, 60000);

const loadSettings = async () => {
  try {
    const settings = await window.api.getSettings();
    if (settings && settings.display) {
      displaySettings.value = settings.display;
    }
  } catch (error) {
    // Settings load failed, using defaults
  }
};

const filteredTodos = computed(() => {
  if (!displaySettings.value.showTodos) return [];
  let result = todos.value.filter(item => item.type === 'todo' || !item.type); // 兼容旧数据
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.content.toLowerCase().includes(query)
    );
  }
  // 按完成状态和时间排序：未完成的在前，时间从近到远
  return result.sort((a, b) => {
    // 先按完成状态排序（未完成的在前）
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // 完成状态相同时，按创建时间从近到远排序
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
});

const filteredNotes = computed(() => {
  if (!displaySettings.value.showNotes) return [];
  let result = todos.value.filter(item => item.type === 'note');
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.content.toLowerCase().includes(query)
    );
  }
  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

const loadTodos = async () => {
  try {
    todos.value = await window.api.getTodos();
  } catch (error) {
    // Todos load failed
  }
};

const openEditor = (todoId = null, type = 'note') => {
  window.api.openEditor(todoId, type);
};

const deleteTodo = async (id) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条记录吗？',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await window.api.deleteTodo(id);
    loadTodos();
  } catch (error) {
    // 用户取消删除
  }
};

const toggleComplete = async (id) => {
  try {
    await window.api.completeTodo(id);
    await loadTodos();
  } catch (error) {
    // Toggle failed
  }
};

const isDue = (todo) => {
  if (!todo.remindAt || todo.completed) return false;
  return moment(todo.remindAt).isSameOrBefore(moment());
};

const stopReminder = async (id) => {
  try {
    await window.api.stopReminder(id);
    await loadTodos();
  } catch (error) {
    // Stop reminder failed
  }
};

const handleScreenshot = () => {
  // For now, open a new note and trigger image upload dialog
  // In a real app, this might trigger a screen capture tool
  openEditor();
  setTimeout(() => {
    // We can't easily trigger the upload in the new window from here without IPC
    // So just opening the editor is the fallback
  }, 500);
};

const minimizeWindow = () => window.api.minimizeWindow();
const closeWindow = () => window.api.closeWindow();
const openSettings = () => window.api.openSettings();

const stripHtml = (html) => {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  return moment(isoString).format('YYYY-MM-DD HH:mm');
};

const handleTodoChanged = (updatedTodos) => {
  todos.value = updatedTodos;
};

onMounted(() => {
  loadSettings();
  loadTodos();
  window.api.onTodoChanged(handleTodoChanged);
});

onUnmounted(() => {
  window.api.removeAllListeners('todo:changed');
});
</script>

<style scoped>
/* Global & Layout */
.home-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1e1e1e;
  color: #e0e0e0;
  position: relative;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px 20px;
  flex-shrink: 0;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.window-controls {
  display: flex;
  gap: 8px;
}

.window-controls button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  transition: color 0.2s;
}

.window-controls button:hover {
  color: #fff;
}

.home-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px 80px 20px;
  /* Bottom padding for tabs */
}

/* Search & Actions */
.search-bar {
  margin-bottom: 16px;
}

:deep(.search-input .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: none;
  border-radius: 12px;
  padding: 4px 12px;
}

:deep(.search-input .el-input__wrapper.is-focus) {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}

:deep(.search-input .el-input__inner) {
  color: #fff;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.btn-add {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon {
  margin-right: 6px;
  font-size: 16px;
  font-weight: bold;
}

/* Lists */
.todo-list,
.note-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.todo-item,
.note-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  position: relative;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.todo-item:hover,
.note-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.todo-main,
.note-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.todo-content,
.note-content {
  flex: 1;
  min-width: 0;
  padding-right: 60px;
  /* Space for actions */
}

.todo-title,
.note-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  line-height: 1.4;
}

.todo-preview,
.note-preview {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.todo-meta,
.note-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.meta-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.todo-due {
  color: #ff6b6b;
  font-weight: 600;
}

.todo-item.completed {
  opacity: 0.5;
}

.todo-item.completed .todo-title {
  text-decoration: line-through;
}

/* Actions */
.todo-actions,
.note-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transform: translateX(10px);
  transition: all 0.2s ease;
}

.todo-item:hover .todo-actions,
.note-item:hover .note-actions {
  opacity: 1;
  transform: translateX(0);
}

/* Bottom Tabs */
.bottom-tabs {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 60px;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 10;
}

.tab-item {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.tab-item.active {
  color: var(--el-color-primary);
  font-weight: 600;
  position: relative;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 3px;
  background: var(--el-color-primary);
  border-radius: 0 0 3px 3px;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
}
</style>
