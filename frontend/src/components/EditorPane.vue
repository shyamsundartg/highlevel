<script setup lang="ts">
import { watch } from "vue";
import { X } from "lucide-vue-next";
import FileTree from "@/components/FileTree.vue";
import MonacoEditor from "@/components/MonacoEditor.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FileMeta, ProjectFile } from "@/types/api";
import { useEditorTabs } from "@/composables/useEditorTabs";

const props = defineProps<{
  files: FileMeta[];
  activeFile: ProjectFile | null;
  readOnly?: boolean;
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
  <div class="flex min-h-0 min-w-0 border-x">
    <FileTree
      class="w-52 shrink-0"
      :files="files"
      :active-file-id="activeFile?.fileId ?? null"
      @select="onSelect"
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <div v-if="openTabIds.length" class="flex items-center gap-1 border-b px-2 py-1">
        <Tabs :model-value="activeFile?.fileId ?? ''" class="w-full">
          <TabsList class="h-8 w-full justify-start overflow-x-auto bg-transparent p-0">
            <TabsTrigger
              v-for="tabId in openTabIds"
              :key="tabId"
              :value="tabId"
              class="group relative flex h-8 max-w-[180px] min-w-0 items-center gap-1 px-2 text-xs"
              :title="files.find((f) => f.fileId === tabId)?.path ?? tabId"
              @click="emit('select', tabId)"
            >
              <span class="min-w-0 flex-1 truncate">
                {{ files.find((f) => f.fileId === tabId)?.path ?? tabId }}
              </span>
              <Button
                variant="ghost"
                size="icon"
                class="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"
                @click.stop="onCloseTab(tabId)"
              >
                <X class="h-3 w-3" />
              </Button>
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
