<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { VueMonacoEditor } from "@guolao/vue-monaco-editor";
import type { editor } from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript" || label === "vue") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

const props = defineProps<{
  path: string | null;
  content: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  update: [content: string];
}>();

const editorRef = ref<editor.IStandaloneCodeEditor | null>(null);
let suppressEmit = false;

const language = computed(() => {
  if (!props.path) {
    return "plaintext";
  }
  if (props.path.endsWith(".vue")) {
    return "html";
  }
  if (props.path.endsWith(".ts")) {
    return "typescript";
  }
  if (props.path.endsWith(".js")) {
    return "javascript";
  }
  if (props.path.endsWith(".css")) {
    return "css";
  }
  if (props.path.endsWith(".html")) {
    return "html";
  }
  if (props.path.endsWith(".json")) {
    return "json";
  }
  return "plaintext";
});

const options = computed<editor.IStandaloneEditorConstructionOptions>(() => ({
  automaticLayout: true,
  fontSize: 13,
  minimap: { enabled: false },
  readOnly: props.readOnly ?? false,
  scrollBeyondLastLine: false,
  wordWrap: "on",
  theme: "vs-dark",
}));

function handleMount(editor: editor.IStandaloneCodeEditor): void {
  editorRef.value = editor;
}

function handleUpdate(value: string): void {
  if (suppressEmit) {
    return;
  }
  emit("update", value);
}



onUnmounted(() => {
  editorRef.value = null;
});
</script>

<template>
  <div class="monaco-wrapper">
    <div v-if="!path" class="flex h-full items-center justify-center text-sm text-muted-foreground">
      Select a file or generate code via chat
    </div>
    <VueMonacoEditor
      v-else
      :key="path"
      :value="content"
      :language="language"
      :options="options"
      @mount="handleMount"
      @update:value="handleUpdate"
    />
  </div>
</template>

<style scoped>
.monaco-wrapper {
  height: 100%;
  min-height: 0;
}
</style>
