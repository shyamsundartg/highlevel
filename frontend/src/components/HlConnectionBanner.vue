<script setup lang="ts">
import { useHlStore } from "@/stores/hl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  <Card>
    <CardContent class="flex items-center justify-between gap-4 p-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          HighLevel
        </p>
        <div v-if="hl.loading" class="mt-1 text-sm">Checking connection…</div>
        <div v-else-if="hl.status.connected" class="mt-1 flex items-center gap-2">
          <Badge variant="default">Connected</Badge>
          <span class="text-sm">
            {{ hl.status.locationName ?? hl.status.locationId }}
          </span>
        </div>
        <p v-else class="mt-1 text-sm text-muted-foreground">Not connected</p>
        <Alert v-if="hl.error" variant="destructive" class="mt-2">
          <AlertDescription>{{ hl.error }}</AlertDescription>
        </Alert>
      </div>
      <Button
        v-if="!hl.status.connected"
        :disabled="hl.loading"
        @click="connect"
      >
        Connect HighLevel
      </Button>
      <Button v-else variant="outline" :disabled="hl.loading" @click="hl.disconnect()">
        Disconnect
      </Button>
    </CardContent>
  </Card>
</template>
