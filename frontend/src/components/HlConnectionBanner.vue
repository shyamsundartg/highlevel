<script setup lang="ts">
import { useHlStore } from "@/stores/hl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, Unlink } from "lucide-vue-next";

const hl = useHlStore();

async function connect(): Promise<void> {
  try {
    await hl.startOAuth();
  } catch (err) {
    hl.error = err instanceof Error ? err.message : "Failed to start OAuth";
  }
}
</script>

<template>
  <div class="glass-card flex items-center justify-between gap-4 p-5">
    <div class="min-w-0 flex-1">
      <p class="text-xs font-medium uppercase tracking-wide text-[var(--genesis-muted)]">
        HighLevel
      </p>
      <div v-if="hl.loading" class="mt-1.5 text-sm">Checking connection…</div>
      <div v-else-if="hl.status.connected" class="mt-1.5 flex flex-wrap items-center gap-2">
        <Badge
          class="rounded-full border-0 bg-emerald-100 px-2.5 py-0.5 text-emerald-800 hover:bg-emerald-100"
        >
          Connected
        </Badge>
        <span class="truncate text-sm font-medium">
          {{ hl.status.locationName ?? hl.status.locationId }}
        </span>
      </div>
      <p v-else class="mt-1.5 text-sm text-[var(--genesis-muted)]">
        Connect your location to build apps with live CRM data
      </p>
      <Alert v-if="hl.error" variant="destructive" class="mt-3 rounded-xl">
        <AlertDescription>{{ hl.error }}</AlertDescription>
      </Alert>
    </div>
    <Button
      v-if="!hl.status.connected"
      class="genesis-btn-primary shrink-0"
      :disabled="hl.loading"
      @click="connect"
    >
      <Link2 class="mr-1.5 size-4" />
      Connect
    </Button>
    <Button
      v-else
      variant="outline"
      class="genesis-btn-outline shrink-0"
      :disabled="hl.loading"
      @click="hl.disconnect()"
    >
      <Unlink class="mr-1.5 size-3.5" />
      Disconnect
    </Button>
  </div>
</template>
