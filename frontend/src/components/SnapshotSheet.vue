<script setup lang="ts">
import { ref } from "vue";
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
  } finally {
    restoringId.value = null;
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-[400px] sm:max-w-[400px]">
      <SheetHeader>
        <SheetTitle>Snapshot history</SheetTitle>
        <SheetDescription>
          Restore a previous generation snapshot.
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="mt-4 h-[calc(100vh-8rem)] pr-4">
        <p v-if="snapshots.length === 0" class="text-sm text-muted-foreground">
          Snapshots are created automatically after each generation.
        </p>
        <ul v-else class="space-y-3">
          <li
            v-for="snap in snapshots"
            :key="snap.id"
            class="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">
                {{ snap.label || "Untitled" }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ snap.fileCount }} files ·
                {{ new Date(snap.createdAt).toLocaleString() }}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              :disabled="restoringId === snap.id"
              @click="restore(snap.id)"
            >
              {{ restoringId === snap.id ? "Restoring…" : "Restore" }}
            </Button>
          </li>
        </ul>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>
