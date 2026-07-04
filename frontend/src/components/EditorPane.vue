<script setup lang="ts">
import { watch } from "vue";
import { X } from "lucide-vue-next";
import FileTree from "@/components/FileTree.vue";
import MonacoEditor from "@/components/MonacoEditor.vue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FileMeta, ProjectFile } from "@/types/api";
import { useEditorTabs } from "@/composables/useEditorTabs";
import { cn } from "@/lib/utils";

const props = defineProps<{
  files: FileMeta[];
  activeFile: ProjectFile | null;
  readOnly?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  select: [fileId: string];
  update: [content: string];
}>();

const { openTabIds, openTab, closeTab } = useEditorTabs();

watch(
  () => props.activeFile?.fileId,
  (fileId) => {
    if (fileId) {
      openTab(fileId);
    }
  },
  { immediate: true },
);

function onSelect(fileId: string): void {
  if (props.activeFile?.fileId === fileId) {
    return;
  }
  openTab(fileId);
  emit("select", fileId);
}

function onCloseTab(fileId: string): void {
  const nextId = closeTab(fileId);
  if (props.activeFile?.fileId === fileId && nextId) {
    emit("select", nextId);
  }
}
</script>

<template>
  <div :class="cn('flex min-h-0 min-w-0 border-x border-[var(--genesis-border)]', $props.class)">
    <FileTree
      class="w-52 shrink-0"
      :files="files"
      :active-file-id="activeFile?.fileId ?? null"
      @select="onSelect"
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <div
        v-if="openTabIds.length"
        class="flex items-center gap-1 border-b border-[var(--genesis-border)] bg-white/50 px-2 py-1"
      >
        <Tabs :model-value="activeFile?.fileId ?? ''" class="editor-tabs w-full">
          <TabsList class="h-8 w-full justify-start overflow-x-auto bg-transparent p-0">
            <TabsTrigger
              v-for="tabId in openTabIds"
              :key="tabId"
              :value="tabId"
              class="editor-tab-trigger group relative flex h-8 max-w-[180px] min-w-0 shrink-0 items-center gap-1 rounded-lg px-2 text-xs"
              :title="files.find((f) => f.fileId === tabId)?.path ?? tabId"
              @click="emit('select', tabId)"
            >
              <span class="editor-tab-label min-w-0 flex-1 truncate">
                {{ files.find((f) => f.fileId === tabId)?.path ?? tabId }}
              </span>
              <span
                role="button"
                tabindex="0"
                class="editor-tab-close shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Close tab"
                @click.stop="onCloseTab(tabId)"
                @keydown.enter.prevent="onCloseTab(tabId)"
                @keydown.space.prevent="onCloseTab(tabId)"
              >
                <X class="h-3 w-3" />
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <MonacoEditor
        :key="`${activeFile?.fileId ?? ''}-${activeFile?.updatedAt ?? 0}`"
        class="min-h-0 flex-1"
        :path="activeFile?.path ?? null"
        :content="activeFile?.content ?? ''"
        :read-only="readOnly"
        @update="emit('update', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.editor-tabs :deep(.editor-tab-trigger) {
  color: var(--genesis-muted) !important;
  background: transparent !important;
  box-shadow: none !important;
}

.editor-tabs :deep(.editor-tab-trigger:hover) {
  color: var(--genesis-text) !important;
}

.editor-tabs :deep(.editor-tab-trigger[data-state="active"]) {
  color: var(--genesis-text) !important;
  background: rgba(255, 255, 255, 0.95) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
}

.editor-tabs :deep(.editor-tab-trigger::after) {
  display: none !important;
}

.editor-tabs :deep(.editor-tab-label) {
  color: inherit !important;
}

.editor-tabs :deep(.editor-tab-close) {
  color: var(--genesis-muted);
  line-height: 0;
}

.editor-tabs :deep(.editor-tab-close:hover) {
  color: var(--genesis-text);
  background: rgba(0, 0, 0, 0.06);
}
</style>
