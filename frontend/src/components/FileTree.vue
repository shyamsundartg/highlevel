<script setup lang="ts">
import type { FileMeta } from "@/types/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

defineProps<{
  files: FileMeta[];
  activeFileId: string | null;
  class?: string;
}>();

const emit = defineEmits<{
  select: [fileId: string];
}>();
</script>

<template>
  <aside :class="cn('flex flex-col border-r border-[var(--genesis-border)] bg-white/30', $props.class)">
    <div class="genesis-panel-header">
      <h2 class="genesis-panel-subtitle font-semibold uppercase tracking-wide">Files</h2>
    </div>
    <ScrollArea class="flex-1">
      <p v-if="files.length === 0" class="p-3 text-xs text-[var(--genesis-muted)]">
        No files yet
      </p>
      <ul v-else class="p-2">
        <li v-for="file in files" :key="file.fileId">
          <button
            type="button"
            class="w-full truncate rounded-xl px-2.5 py-2 text-left font-mono text-xs transition-colors"
            :class="
              file.fileId === activeFileId
                ? 'bg-white/90 font-medium text-[var(--genesis-text)] shadow-sm'
                : 'text-[var(--genesis-muted)] hover:bg-white/50'
            "
            @click="emit('select', file.fileId)"
          >
            {{ file.path }}
          </button>
        </li>
      </ul>
    </ScrollArea>
  </aside>
</template>
