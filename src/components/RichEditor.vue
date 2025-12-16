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
.rich-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.editor-container {
  flex: 1;
  overflow-y: hidden; /* Let Quill handle scrolling internally if needed, or container */
  border: none !important;
  display: flex;
  flex-direction: column;
}

:deep(.ql-toolbar) {
  display: none !important; /* 完全隐藏工具栏 */
}

:deep(.ql-container) {
  border: none !important;
  flex: 1;
  overflow-y: auto; /* Scroll within container */
  font-size: 16px;
  position: relative;
}

:deep(.ql-editor) {
  padding: 20px;
  min-height: 100%;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  caret-color: #fff; /* Ensure cursor is visible */
  overflow-y: visible; /* Let container handle scroll */
}

:deep(.ql-editor.ql-blank::before) {
  color: rgba(255, 255, 255, 0.4);
  font-style: normal;
}
</style>
