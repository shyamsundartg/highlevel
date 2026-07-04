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
  <aside :class="cn('flex flex-col border-r bg-muted/20', $props.class)">
    <div class="border-b px-3 py-2">
      <h2 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Files
      </h2>
    </div>
    <ScrollArea class="flex-1">
      <p v-if="files.length === 0" class="p-3 text-xs text-muted-foreground">
        No files yet
      </p>
      <ul v-else class="p-2">
        <li v-for="file in files" :key="file.fileId">
          <button
            type="button"
            class="w-full truncate rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors hover:bg-accent"
            :class="file.fileId === activeFileId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
            @click="emit('select', file.fileId)"
          >
            {{ file.path }}
          </button>
        </li>
      </ul>
    </ScrollArea>
  </aside>
</template>
