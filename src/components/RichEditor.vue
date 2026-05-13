<template>
  <div class="markdown-editor-wrapper">
    <MdEditor
      v-if="mode === 'edit'"
      v-model="innerContent"
      language="zh-CN"
      :preview="false"
      :toolbars="toolbars"
      placeholder="键入任何要记住的内容..."
      :on-upload-img="handleUploadImg"
      @onSave="handleEditorSave"
    />
    <MdPreview
      v-else
      :modelValue="innerContent"
      language="zh-CN"
      class="md-preview-area"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { MdEditor, MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';

defineOptions({ name: 'RichEditor' });

const props = defineProps({
  modelValue: { type: String, default: '' },
  mode: { type: String, default: 'edit' }
});

const emit = defineEmits(['update:modelValue', 'image-uploaded', 'save']);

const innerContent = ref(props.modelValue);

const toolbars = [
  'bold', 'italic', 'strikeThrough', '-',
  'title', 'list', 'orderedList', 'taskList', '-',
  'code', 'quote', 'link', 'image', '-',
  'table', 'mermaid', '-',
  'revoke', 'next', '=', 'preview'
];

watch(() => props.modelValue, (val) => {
  if (val !== innerContent.value) {
    innerContent.value = val;
  }
});

watch(innerContent, (val) => {
  emit('update:modelValue', val);
});

const handleUploadImg = async (files, callback) => {
  const results = await Promise.all(
    files.map(async (file) => {
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      const result = await window.api.saveImage(base64);
      emit('image-uploaded', result.path);
      return { url: result.url, alt: '', title: '' };
    })
  );
  callback(results);
};

const handleEditorSave = (markdown) => {
  emit('save', markdown);
};
</script>

<style scoped>
.markdown-editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
}

.markdown-editor-wrapper ::v-deep(.md-editor) {
  border: 1px solid var(--border-main) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-sm) !important;
  height: 100%;
}

.markdown-editor-wrapper ::v-deep(.md-editor:hover) {
  border-color: var(--mi-orange) !important;
  box-shadow: var(--shadow-md) !important;
}

.markdown-editor-wrapper ::v-deep(.md-editor:focus-within) {
  border-color: var(--mi-orange) !important;
  box-shadow: 0 0 0 3px rgba(255, 105, 0, 0.15) !important;
}

.markdown-editor-wrapper ::v-deep(.md-editor-toolbar-wrapper) {
  border-bottom: 1px solid var(--border-main) !important;
}

.markdown-editor-wrapper ::v-deep(.md-editor-content) {
  flex: 1;
}

.markdown-editor-wrapper ::v-deep(.md-editor-input) {
  font-size: 15px !important;
  line-height: 1.6 !important;
  padding: 20px !important;
  color: var(--text-primary) !important;
  caret-color: var(--mi-orange) !important;
}

.markdown-editor-wrapper ::v-deep(.md-editor-input::placeholder) {
  color: var(--text-tertiary);
  opacity: 0.8;
}

.md-preview-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-main);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.md-preview-area ::v-deep(.md-preview) {
  font-size: 15px !important;
  line-height: 1.7 !important;
  color: var(--text-primary) !important;
}

.md-preview-area ::v-deep(.md-preview h1),
.md-preview-area ::v-deep(.md-preview h2),
.md-preview-area ::v-deep(.md-preview h3),
.md-preview-area ::v-deep(.md-preview h4) {
  color: var(--text-primary) !important;
  border-bottom-color: var(--border-main) !important;
}

.md-preview-area ::v-deep(.md-preview code) {
  background: var(--bg-page) !important;
  color: var(--mi-orange) !important;
}

.md-preview-area ::v-deep(.md-preview pre code) {
  background: var(--bg-page) !important;
  color: var(--text-primary) !important;
}

.md-preview-area ::v-deep(.md-preview blockquote) {
  border-left-color: var(--mi-orange) !important;
  color: var(--text-secondary) !important;
}

.md-preview-area ::v-deep(.md-preview img) {
  max-width: 100%;
  border-radius: var(--radius-md);
}

.md-preview-area ::v-deep(.md-preview a) {
  color: var(--mi-orange) !important;
}

.md-preview-area ::v-deep(.md-preview table) {
  border-color: var(--border-main) !important;
}

.md-preview-area ::v-deep(.md-preview table th) {
  background: var(--bg-page) !important;
  border-color: var(--border-main) !important;
  color: var(--text-primary) !important;
}

.md-preview-area ::v-deep(.md-preview table td) {
  border-color: var(--border-main) !important;
  color: var(--text-primary) !important;
}
</style>
