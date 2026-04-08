<template>
  <div class="rich-editor-wrapper">
    <div ref="editorContainer" class="editor-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

defineOptions({
  name: 'RichEditor'
});

// 编辑器内容，支持 v-model 双向绑定
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

// 定义事件
const emit = defineEmits(['update:modelValue', 'image-uploaded']);

// 编辑器容器 DOM 引用
const editorContainer = ref(null);

// Quill 编辑器实例
let quill = null;

/**
 * 初始化 Quill 编辑器
 * 创建编辑器实例，设置初始内容，绑定内容变化事件
 */
const initQuill = () => {
  quill = new Quill(editorContainer.value, {
    theme: 'snow',
    placeholder: '键入任何要记住的内容...',
    modules: {
      toolbar: false
    }
  });
  // 设置初始内容
  if (props.modelValue) {
    quill.root.innerHTML = props.modelValue;
  }
  // 监听内容变化，触发更新事件
  quill.on('text-change', () => {
    const html = quill.root.innerHTML;
    emit('update:modelValue', html);
  });
};

/**
 * 监听外部内容变化
 * 当父组件传入的内容变化时，更新编辑器内容
 */
watch(() => props.modelValue, (newValue) => {
  if (quill && quill.root.innerHTML !== newValue) {
    quill.root.innerHTML = newValue;
  }
});

// 组件挂载时初始化编辑器
onMounted(() => {
  initQuill();
});
</script>

<style scoped>
.rich-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}
.editor-container {
  flex: 1;
  overflow-y: hidden;
  border: none !important;
  display: flex;
  flex-direction: column;
}
::v-deep(.ql-toolbar) {
  display: none !important;
}
::v-deep(.ql-container) {
  border: none !important;
  flex: 1;
  overflow-y: auto;
  font-size: 16px;
  position: relative;
  background: var(--bg-card) !important;
  border-radius: var(--radius-lg) !important;
  border: 1px solid var(--border-main) !important;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important;
  font-weight: 400 !important;
  box-shadow: var(--shadow-sm) !important;
}
::v-deep(.ql-container:hover) {
  border-color: var(--mi-orange) !important;
  box-shadow: var(--shadow-md) !important;
}
::v-deep(.ql-container:focus-within) {
  border-color: var(--mi-orange) !important;
  box-shadow: 0 0 0 3px rgba(255, 105, 0, 0.15) !important;
}
::v-deep(.ql-editor) {
  padding: 24px;
  min-height: 100%;
  line-height: 1.6;
  color: var(--text-primary);
  caret-color: var(--mi-orange);
  overflow-y: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important;
  letter-spacing: 0.2px;
  font-weight: 400;
}
::v-deep(.ql-editor:focus) {
  background: var(--bg-card) !important;
  box-shadow: none !important;
}
::v-deep(.ql-editor.ql-blank::before) {
  color: var(--text-tertiary);
  font-style: normal;
  opacity: 0.8;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important;
  letter-spacing: 0.3px;
}
::v-deep(.ql-editor) {
  caret-color: var(--mi-orange);
}
::v-deep(.ql-editor ::selection) {
  background: rgba(255, 105, 0, 0.2) !important;
  color: var(--text-primary) !important;
}
::v-deep(.ql-container::-webkit-scrollbar) {
  width: 6px;
}
::v-deep(.ql-container::-webkit-scrollbar-track) {
  background: transparent;
}
::v-deep(.ql-container::-webkit-scrollbar-thumb) {
  background: #D8D8D8;
  border-radius: 3px;
}
::v-deep(.ql-container::-webkit-scrollbar-thumb:hover) {
  background: var(--mi-orange);
}
</style>
