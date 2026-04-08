<template>
  <div class="tooltip-container" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
    <div class="tooltip-header">
      <span class="header-title">待办提醒</span>
      <span class="header-count">{{ todos.length }} 条</span>
    </div>
    <div class="tooltip-body">
      <div v-if="todos.length === 0" class="empty-state">暂无待提醒事项</div>
      <div v-else class="todo-list">
        <div v-for="todo in displayTodos" :key="todo.id" class="todo-item" @click="onTodoClick(todo)">
          <div class="todo-content">
            <div class="todo-title">{{ todo.title || '无标题' }}</div>
            <div class="todo-time">{{ formatTime(todo.remindAt) }}</div>
          </div>
        </div>
      </div>
      <div v-if="todos.length > 3" class="more-hint">还有 {{ todos.length - 3 }} 条待办...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import moment from 'moment';

defineOptions({ name: 'Tooltip' });

// 待办列表数据
const todos = ref([]);
// 最多显示3条
const displayTodos = computed(() => todos.value.slice(0, 3));

/**
 * 格式化时间显示
 * @param {String} isoString - ISO 时间字符串
 * @returns {String} 格式化后的时间字符串
 */
const formatTime = (isoString) => {
  if (!isoString) return '';
  return moment(isoString).format('MM-DD HH:mm');
};

/**
 * 处理提示窗口数据更新事件
 * @param {Array} updatedTodos - 更新后的待办数组
 */
const handleTooltipUpdate = (updatedTodos) => {
  todos.value = updatedTodos || [];
};

/**
 * 鼠标进入提示窗口
 */
const onMouseEnter = () => {
  if (window.api && window.api.tooltipMouseEnter) {
    window.api.tooltipMouseEnter();
  }
};

/**
 * 鼠标离开提示窗口
 */
const onMouseLeave = () => {
  if (window.api && window.api.tooltipMouseLeave) {
    window.api.tooltipMouseLeave();
  }
};

/**
 * 点击待办项
 * @param {Object} todo - 待办对象
 */
const onTodoClick = (todo) => {
  if (window.api && window.api.tooltipTodoClick) {
    window.api.tooltipTodoClick(todo.id);
  }
};

// 组件挂载时初始化
onMounted(() => {
  // 监听数据更新事件
  if (window.api && window.api.onTooltipUpdate) {
    window.api.onTooltipUpdate(handleTooltipUpdate);
  }
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  if (window.api && window.api.removeAllListeners) {
    window.api.removeAllListeners('tooltip:update');
  }
});
</script>

<style scoped>
.tooltip-container {
  width: 100%;
  height: 100%;
  background: #FFFFFF;
  border-radius: 8px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}
.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #EEEEEE;
  background: #FAFAFA;
}
.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #FF6F00;
}
.header-count {
  font-size: 12px;
  color: #999999;
  margin-left: auto;
}
.tooltip-body {
  padding: 12px;
}
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #FAFAFA;
  border-radius: 8px;
  border: 1px solid #EEEEEE;
  transition: all 0.2s ease;
  cursor: pointer;
}
.todo-item:hover {
  background: #FFF5F0;
  border-color: #FF6F00;
}
.todo-content {
  flex: 1;
  min-width: 0;
}
.todo-title {
  font-size: 13px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 4px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.todo-time {
  font-size: 12px;
  color: #999999;
}
.empty-state {
  text-align: center;
  padding: 20px 0;
  color: #999999;
  font-size: 13px;
}
.more-hint {
  text-align: center;
  padding: 8px 0 4px;
  color: #999999;
  font-size: 12px;
  border-top: 1px solid #EEEEEE;
  margin-top: 8px;
}
</style>
