<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { FileMeta } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const props = defineProps<{
  files: FileMeta[];
  fileContents: Record<string, string>;
  refreshKey?: number;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);

let unsubscribeEvents: (() => void) | null = null;
let unsubscribeAuth: (() => void) | null = null;
const deliveredEventIds = new Set<string>();

interface HlWebhookEvent {
  id: string;
  type: string;
  locationId: string;
  data: Record<string, unknown>;
  receivedAt: number;
  webhookId?: string;
}

function forwardHlEvent(event: HlWebhookEvent): void {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    { type: "genesis-hl-event", event },
    window.location.origin,
  );
}

function firestoreEventData(
  docData: Record<string, unknown>,
): Record<string, unknown> {
  const nested = docData.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return {};
}

function subscribeToHlEvents(uid: string): void {
  unsubscribeEvents?.();
  deliveredEventIds.clear();

  const eventsRef = collection(db, "users", uid, "webhookEvents");
  const subscribeStartedAt = Timestamp.now();
  const eventsQuery = query(
    eventsRef,
    where("receivedAt", ">", subscribeStartedAt),
    orderBy("receivedAt", "asc"),
  );

  unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added") {
        continue;
      }

      const docId = change.doc.id;
      if (deliveredEventIds.has(docId)) {
        continue;
      }
      deliveredEventIds.add(docId);

      const docData = change.doc.data();
      const receivedAt =
        docData.receivedAt instanceof Timestamp
          ? docData.receivedAt.toMillis()
          : Date.now();

      forwardHlEvent({
        id: docId,
        type: typeof docData.type === "string" ? docData.type : "Unknown",
        locationId:
          typeof docData.locationId === "string" ? docData.locationId : "",
        data: firestoreEventData(docData),
        receivedAt,
        webhookId:
          typeof docData.webhookId === "string" ? docData.webhookId : undefined,
      });
    }
  });
}

async function pushPreview(): Promise<void> {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow) {
    return;
  }

  const contents: Record<string, string> = {};
  for (const file of props.files) {
    if (props.fileContents[file.path]) {
      contents[file.path] = props.fileContents[file.path];
    }
  }

  if (props.files.length > 0 && Object.keys(contents).length === 0) {
    loading.value = true;
    return;
  }

  if (Object.keys(contents).length === 0) {
    error.value = null;
    iframe.contentWindow.postMessage(
      { type: "genesis-preview-init", files: {} },
      window.location.origin,
    );
    loading.value = false;
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    error.value = "Sign in to preview HighLevel data";
    loading.value = false;
    return;
  }

  try {
    error.value = null;
    const token = await user.getIdToken();
    const apiBase = import.meta.env.VITE_API_BASE as string;

    iframe.contentWindow.postMessage(
      {
        type: "genesis-preview-init",
        apiBase,
        token,
        files: contents,
      },
      window.location.origin,
    );
    loading.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Preview failed";
    loading.value = false;
  }
}

function onMessage(event: MessageEvent): void {
  if (event.origin !== window.location.origin) {
    return;
  }
  if (event.data?.type === "genesis-preview-ready") {
    void pushPreview();
    return;
  }
  if (event.data?.type === "genesis-preview-need-token") {
    void sendFreshToken();
  }
}

async function sendFreshToken(): Promise<void> {
  const iframe = iframeRef.value;
  if (!iframe?.contentWindow) {
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    return;
  }

  try {
    const token = await user.getIdToken(true);
    iframe.contentWindow.postMessage(
      { type: "genesis-preview-token", token },
      window.location.origin,
    );
  } catch {
    // Preview runner will surface auth errors on fetch
  }
}

onMounted(() => {
  window.addEventListener("message", onMessage);

  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    unsubscribeEvents?.();
    unsubscribeEvents = null;
    if (user) {
      subscribeToHlEvents(user.uid);
    }
  });
});

onUnmounted(() => {
  window.removeEventListener("message", onMessage);
  unsubscribeEvents?.();
  unsubscribeAuth?.();
});

watch(
  () =>
    [
      props.refreshKey,
      props.files.map((file) => `${file.fileId}:${file.updatedAt}`).join("|"),
      Object.entries(props.fileContents)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, content]) => `${path}:${content.length}`)
        .join("|"),
    ] as const,
  () => {
    loading.value = true;
    void pushPreview();
  },
);

defineExpose({ refresh: pushPreview });
</script>

<template>
  <Card class="flex h-full min-h-0 flex-col gap-0 rounded-none border-0 border-l py-0">
    <CardHeader class="border-b px-4 py-3">
      <CardTitle class="text-sm">Live Preview</CardTitle>
    </CardHeader>
    <CardContent class="relative min-h-0 flex-1 p-0">
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-sm text-muted-foreground"
      >
        Loading preview…
      </div>
      <p v-if="error" class="p-4 text-sm text-destructive">{{ error }}</p>
      <iframe
        ref="iframeRef"
        class="h-full w-full border-0 bg-background"
        src="/preview-runner.html"
        title="App preview"
        sandbox="allow-scripts allow-same-origin"
      />
    </CardContent>
  </Card>
</template>
