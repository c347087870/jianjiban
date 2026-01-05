<template>
  <div class="rich-editor-wrapper">
    <div ref="editorContainer" class="editor-container"></div>
    <!-- Toolbar container will be moved here by Quill or we position it absolutely -->
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

defineOptions({
  name: 'RichEditor'
});

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'image-uploaded']);

const editorContainer = ref(null);
let quill = null;

const initQuill = () => {
  quill = new Quill(editorContainer.value, {
    theme: 'snow',
    placeholder: '键入任何要记住的内容...',
    modules: {
      toolbar: false // 禁用工具栏
    }
  });

  // Set initial content
  if (props.modelValue) {
    quill.root.innerHTML = props.modelValue;
  }

  // Listen for changes
  quill.on('text-change', () => {
    const html = quill.root.innerHTML;
    emit('update:modelValue', html);
  });
};

watch(() => props.modelValue, (newValue) => {
  if (quill && quill.root.innerHTML !== newValue) {
    quill.root.innerHTML = newValue;
  }
});

onMounted(() => {
  initQuill();
});
</script>

<style scoped>
/* RichEditor - 小米风格 */
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

:deep(.ql-toolbar) {
  display: none !important;
}

:deep(.ql-container) {
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

:deep(.ql-container:hover) {
  border-color: var(--mi-orange) !important;
  box-shadow: var(--shadow-md) !important;
}

:deep(.ql-container:focus-within) {
  border-color: var(--mi-orange) !important;
  box-shadow: 0 0 0 3px rgba(255, 105, 0, 0.15) !important;
}

:deep(.ql-editor) {
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

:deep(.ql-editor:focus) {
  background: var(--bg-card) !important;
}

:deep(.ql-editor.ql-blank::before) {
  color: var(--text-tertiary);
  font-style: normal;
  opacity: 0.8;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif !important;
  letter-spacing: 0.3px;
}

/* 自定义光标样式 - 小米橙 */
:deep(.ql-editor) {
  caret-color: var(--mi-orange);
}

/* 选中文本样式 - 小米橙高亮 */
:deep(.ql-editor ::selection) {
  background: rgba(255, 105, 0, 0.2) !important;
  color: var(--text-primary) !important;
}

/* 滚动条 - 小米风格 */
:deep(.ql-container::-webkit-scrollbar) {
  width: 6px;
}

:deep(.ql-container::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.ql-container::-webkit-scrollbar-thumb) {
  background: #D8D8D8;
  border-radius: 3px;
}

:deep(.ql-container::-webkit-scrollbar-thumb:hover) {
  background: var(--mi-orange);
}
</style>
