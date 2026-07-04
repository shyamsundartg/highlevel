<script setup lang="ts">
import { ref } from "vue";
import { History } from "lucide-vue-next";
import { useProjectsStore } from "@/stores/projects";
import type { Snapshot } from "@/types/api";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  projectId: string;
  snapshots: Snapshot[];
}>();

const projects = useProjectsStore();
const restoringId = ref<string | null>(null);

async function restore(snapshotId: string): Promise<void> {
  restoringId.value = snapshotId;
  try {
    await projects.restoreSnapshot(props.projectId, snapshotId);
    projects.bumpPreview();
    open.value = false;
  } finally {
    restoringId.value = null;
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      class="genesis-sheet w-[400px] border-l border-[var(--genesis-border)] bg-[var(--genesis-glass-strong)] p-0 backdrop-blur-2xl sm:max-w-[400px]"
    >
      <div class="flex h-full flex-col">
        <SheetHeader class="shrink-0 border-b border-[var(--genesis-border)] px-6 py-5 text-left">
          <div class="mb-2 flex size-10 items-center justify-center rounded-xl bg-black/[0.06]">
            <History class="size-5 text-[var(--genesis-text)]" />
          </div>
          <SheetTitle class="text-lg font-semibold tracking-tight text-[var(--genesis-text)]">
            Snapshot history
          </SheetTitle>
          <SheetDescription class="text-sm text-[var(--genesis-muted)]">
            Restore a previous generation snapshot.
          </SheetDescription>
        </SheetHeader>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <p
            v-if="snapshots.length === 0"
            class="rounded-2xl bg-black/[0.03] px-4 py-8 text-center text-sm text-[var(--genesis-muted)]"
          >
            Snapshots are created automatically after each generation.
          </p>
          <ul v-else class="space-y-3">
            <li
              v-for="snap in snapshots"
              :key="snap.id"
              class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--genesis-border)] bg-white/60 p-4 shadow-sm"
            >
              <div class="min-w-0">
                <p class="text-[var(--genesis-text)] truncate text-sm font-medium tracking-tight">
                  {{ snap.label || "Untitled" }}
                </p>
                <p class="mt-0.5 text-xs text-[var(--genesis-muted)]">
                  {{ snap.fileCount }} files ·
                  {{ new Date(snap.createdAt).toLocaleString() }}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="genesis-btn-outline shrink-0"
                :disabled="restoringId === snap.id"
                @click="restore(snap.id)"
              >
                {{ restoringId === snap.id ? "Restoring…" : "Restore" }}
              </Button>
            </li>
          </ul>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
:deep(.genesis-sheet button[data-slot="sheet-close"]) {
  border-radius: 9999px;
  color: var(--genesis-muted);
}

:deep(.genesis-sheet button[data-slot="sheet-close"]:hover) {
  background: rgba(0, 0, 0, 0.06);
  color: var(--genesis-text);
}
</style>
