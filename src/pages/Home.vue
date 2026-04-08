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
                  <el-icon><BellFilled /></el-icon>
                  {{ formatTime(todo.remindAt) }}
                </span>
                <span v-if="todo.repeat && todo.repeat !== 'none'">🔁</span>
              </div>
            </div>
          </div>
          <div class="todo-actions" @click.stop>
            <el-button v-if="isDue(todo) && !todo.completed" type="warning" circle size="small"
              class="btn-stop-reminder" @click="stopReminder(todo.id)" title="停止提醒">
              <el-icon><BellFilled /></el-icon>
            </el-button>
            <el-button type="danger" :icon="Delete" circle size="small" class="btn-delete" @click="deleteTodo(todo.id)"
              title="删除" />
          </div>
        </div>
      </div>
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
    <div class="bottom-tabs">
      <div class="tab-item" :class="{ active: activeTab === 'todo' }" @click="activeTab = 'todo'">待办</div>
      <div class="tab-item" :class="{ active: activeTab === 'note' }" @click="activeTab = 'note'">笔记</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessageBox } from 'element-plus';
import { Search, Delete, BellFilled } from '@element-plus/icons-vue';
import moment from 'moment';

defineOptions({ name: 'Home' });

// 待办/笔记列表数据
const todos = ref([]);
// 搜索关键词
const searchQuery = ref('');
// 显示设置
const displaySettings = ref({ showTodos: true, showNotes: true });
// 当前激活的标签页
const activeTab = ref('todo');
// 当前时间（用于刷新到期状态）
const currentTime = ref(moment());

// 每分钟更新时间以刷新到期状态
setInterval(() => {
  currentTime.value = moment();
}, 60000);

/**
 * 加载用户设置
 */
const loadSettings = async () => {
  try {
    const settings = await window.api.getSettings();
    if (settings && settings.display) {
      displaySettings.value = settings.display;
    }
  } catch (error) {
    // 设置加载失败，使用默认值
  }
};

// 过滤后的待办列表，按完成状态、到期状态排序
const filteredTodos = computed(() => {
  if (!displaySettings.value.showTodos) return [];
  let result = todos.value.filter(item => item.type === 'todo' || !item.type);
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(query) || t.content.toLowerCase().includes(query));
  }
  return result.sort((a, b) => {
    // 先按完成状态排序（未完成的在前）
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    // 未完成状态：到期的排在最前面
    const aIsDue = isDue(a);
    const bIsDue = isDue(b);
    if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
    // 都是到期状态：按到期时间从早到晚排列
    if (aIsDue && bIsDue) return moment(a.remindAt).diff(moment(b.remindAt));
    // 都未到期：按创建时间从近到远排列
    return moment(b.createdAt).diff(moment(a.createdAt));
  });
});

// 过滤后的笔记列表，按创建时间倒序
const filteredNotes = computed(() => {
  if (!displaySettings.value.showNotes) return [];
  let result = todos.value.filter(item => item.type === 'note');
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(query) || t.content.toLowerCase().includes(query));
  }
  return result.sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt)));
});

/**
 * 加载所有待办/笔记数据
 */
const loadTodos = async () => {
  try {
    todos.value = await window.api.getTodos();
  } catch (error) {
    // 数据加载失败
  }
};

/**
 * 打开编辑器窗口
 * @param {String|null} todoId - 待办ID，null 表示新建
 * @param {String} type - 类型（todo/note）
 */
const openEditor = (todoId = null, type = 'note') => {
  window.api.openEditor(todoId, type);
};

/**
 * 删除待办/笔记
 * @param {String} id - 待办/笔记ID
 */
const deleteTodo = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await window.api.deleteTodo(id);
    loadTodos();
  } catch (error) {
    // 用户取消删除
  }
};

/**
 * 切换待办完成状态
 * @param {String} id - 待办ID
 */
const toggleComplete = async (id) => {
  try {
    await window.api.completeTodo(id);
    await loadTodos();
  } catch (error) {
    // 切换失败
  }
};

/**
 * 判断待办是否到期
 * @param {Object} todo - 待办对象
 * @returns {Boolean} 是否到期
 */
const isDue = (todo) => {
  if (!todo.remindAt || todo.completed) return false;
  return moment(todo.remindAt).isSameOrBefore(moment());
};

/**
 * 停止提醒
 * @param {String} id - 待办ID
 */
const stopReminder = async (id) => {
  try {
    await window.api.stopReminder(id);
    await loadTodos();
  } catch (error) {
    // 停止提醒失败
  }
};

// 最小化窗口
const minimizeWindow = () => window.api.minimizeWindow();
// 关闭窗口
const closeWindow = () => window.api.closeWindow();
// 打开设置窗口
const openSettings = () => window.api.openSettings();

/**
 * 去除 HTML 标签
 * @param {String} html - HTML 字符串
 * @returns {String} 纯文本内容
 */
const stripHtml = (html) => {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

/**
 * 格式化时间显示
 * @param {String} isoString - ISO 时间字符串
 * @returns {String} 格式化后的时间字符串
 */
const formatTime = (isoString) => {
  if (!isoString) return '';
  return moment(isoString).format('YYYY-MM-DD HH:mm');
};

/**
 * 处理待办数据变化事件
 * @param {Array} updatedTodos - 更新后的待办数组
 */
const handleTodoChanged = (updatedTodos) => {
  todos.value = updatedTodos;
};

// 组件挂载时初始化
onMounted(() => {
  loadSettings();
  loadTodos();
  window.api.onTodoChanged(handleTodoChanged);
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  window.api.removeAllListeners('todo:changed');
});
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-page);
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  flex-shrink: 0;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-main);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}
.logo-area { display: flex; align-items: center; gap: 10px; }
.logo-icon { font-size: 20px; }
h1 { font-size: 18px; font-weight: 600; margin: 0; color: var(--text-primary); letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.window-controls { display: flex; gap: 0; }
.window-controls button { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 16px; padding: 6px 10px; transition: all 0.2s ease; border-radius: 4px; font-family: inherit; font-weight: 500; width: 36px; height: 28px; display: flex; align-items: center; justify-content: center; margin: 2px; }
.window-controls button:hover { background: rgba(255, 105, 0, 0.1); color: var(--mi-orange); }
.window-controls .btn-icon { margin: 2px; font-size: 16px; width: 36px; height: 28px; display: flex; align-items: center; justify-content: center; }
.home-body { flex: 1; overflow-y: auto; padding: 16px 20px 88px 20px; background: var(--bg-page); }
.search-bar { margin-bottom: 16px; }
::v-deep(.search-input .el-input__wrapper) { background: var(--bg-card); border: 1px solid var(--border-main); border-radius: var(--radius-lg); padding: 12px 16px; transition: all 0.2s ease; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; box-shadow: var(--shadow-sm); }
::v-deep(.search-input .el-input__wrapper:hover) { border-color: var(--mi-orange); box-shadow: var(--shadow-md); }
::v-deep(.search-input .el-input__wrapper.is-focus) { border-color: var(--mi-orange); box-shadow: 0 0 0 3px rgba(255, 105, 0, 0.15); }
::v-deep(.search-input .el-input__inner) { color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; font-weight: 400; font-size: 15px; }
.action-buttons { display: flex; gap: 12px; margin-bottom: 20px; }
.btn-add { flex: 1; height: 48px; border-radius: var(--radius-lg) !important; font-weight: 500; font-size: 15px; border: none !important; display: flex; align-items: center; justify-content: center; background: var(--mi-orange) !important; color: #FFFFFF !important; transition: all 0.2s ease !important; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important; box-shadow: var(--shadow-sm) !important; }
.btn-add:hover { background: var(--mi-orange-hover) !important; transform: translateY(-2px); box-shadow: var(--shadow-md) !important; }
.btn-add[type="success"] { background: #00B894 !important; }
.btn-add[type="success"]:hover { background: #00A885 !important; }
.btn-icon { margin-right: 6px; font-size: 18px; font-weight: bold; }
.todo-list, .note-list { display: flex; flex-direction: column; gap: 12px; }
.todo-item, .note-item { background: var(--bg-card); border-radius: var(--radius-lg); padding: 16px; position: relative; transition: all 0.2s ease; border: 1px solid var(--border-main); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; box-shadow: var(--shadow-sm); }
.todo-item:hover, .note-item:hover { background: var(--bg-card-hover); border-color: var(--mi-orange); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.todo-main, .note-main { display: flex; align-items: flex-start; gap: 12px; }
.todo-content, .note-content { flex: 1; min-width: 0; padding-right: 70px; }
.todo-title, .note-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.todo-preview, .note-preview { font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.todo-meta, .note-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text-tertiary); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.meta-time { display: flex; align-items: center; gap: 4px; }
.todo-due { color: var(--mi-red); font-weight: 500; }
.todo-item.completed { opacity: 0.6; background: #FAFAFA; border-color: #E8E8E8; }
.todo-item.completed .todo-title { text-decoration: line-through; color: var(--text-tertiary); font-weight: 400; }
.todo-actions, .note-actions { position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; opacity: 0; transform: translateX(8px); transition: all 0.2s ease; }
.todo-item:hover .todo-actions, .note-item:hover .note-actions { opacity: 1; transform: translateX(0); }
.btn-delete { background: var(--bg-card) !important; border: 1px solid var(--border-main) !important; color: var(--mi-red) !important; border-radius: var(--radius-md) !important; font-weight: 500 !important; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important; width: 32px !important; height: 32px !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; }
.btn-delete:hover { background: var(--mi-red) !important; color: #FFFFFF !important; border-color: var(--mi-red) !important; transform: scale(1.05) !important; }
.btn-stop-reminder { background: var(--bg-card) !important; border: 1px solid var(--border-main) !important; color: var(--mi-orange) !important; border-radius: var(--radius-md) !important; font-weight: 500 !important; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important; width: 32px !important; height: 32px !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; }
.btn-stop-reminder:hover { background: var(--mi-orange) !important; color: #FFFFFF !important; border-color: var(--mi-orange) !important; transform: scale(1.05) !important; }
.bottom-tabs { position: absolute; bottom: 0; left: 0; width: 100%; height: 56px; background: var(--bg-card); border-top: 1px solid var(--border-main); display: flex; z-index: 10; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; }
.tab-item { flex: 1; display: flex; justify-content: center; align-items: center; font-size: 15px; color: var(--text-secondary); cursor: pointer; transition: all 0.2s ease; font-weight: 500; position: relative; }
.tab-item:last-child { border-right: none; }
.tab-item:hover { color: var(--mi-orange); background: rgba(255, 105, 0, 0.05); }
.tab-item.active { color: var(--mi-orange); background: rgba(255, 105, 0, 0.08); font-weight: 600; }
.tab-item.active::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; background: var(--mi-orange); }
.empty-state { padding: 60px 0; text-align: center; color: var(--text-tertiary); font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif; letter-spacing: 0.5px; opacity: 0.8; }
</style>
