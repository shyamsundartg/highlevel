<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { streamGeneration } from "@/lib/generate";
import type { GenerateEvent, Message } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const props = defineProps<{
  projectId: string;
  messages: Message[];
}>();

const emit = defineEmits<{
  sent: [];
  generated: [];
  streamEnd: [];
  fileStreaming: [path: string, language: string, content: string];
  fileComplete: [path: string];
}>();

const input = ref("");
const streaming = ref(false);
const streamText = ref("");
const error = ref<string | null>(null);
const listRef = ref<HTMLElement | null>(null);
const abortController = ref<AbortController | null>(null);
const streamingFiles = ref<Record<string, string>>({});

onMounted(scrollToBottom);

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight;
  }
}

function handleEvent(event: GenerateEvent): void {
  if (event.event === "token") {
    streamText.value += event.data.text;
    void scrollToBottom();
  } else if (event.event === "file_start") {
    streamingFiles.value[event.data.path] = "";
    emit("fileStreaming", event.data.path, event.data.language, "");
  } else if (event.event === "file_chunk") {
    const prev = streamingFiles.value[event.data.path] ?? "";
    const next = prev + event.data.chunk;
    streamingFiles.value[event.data.path] = next;
    emit("fileStreaming", event.data.path, "", next);
  } else if (event.event === "file_end") {
    delete streamingFiles.value[event.data.path];
    emit("fileComplete", event.data.path);
  } else if (event.event === "error") {
    error.value = event.data.message;
  }
}

async function send(): Promise<void> {
  const message = input.value.trim();
  if (!message || streaming.value) {
    return;
  }

  input.value = "";
  error.value = null;
  streamText.value = "";
  streaming.value = true;
  abortController.value = new AbortController();
  emit("sent");

  try {
    await streamGeneration(
      props.projectId,
      message,
      handleEvent,
      abortController.value.signal,
    );
    emit("generated");
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      error.value = err instanceof Error ? err.message : "Generation failed";
    }
  } finally {
    streaming.value = false;
    streamText.value = "";
    streamingFiles.value = {};
    abortController.value = null;
    emit("streamEnd");
    await scrollToBottom();
  }
}

function stop(): void {
  abortController.value?.abort();
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col border-r">
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-medium">Chat</h2>
      <p class="text-xs text-muted-foreground">Describe your HighLevel app</p>
    </div>

    <ScrollArea ref="listRef" class="min-h-0 flex-1 px-4 py-3">
      <div class="space-y-3">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="rounded-lg border p-3"
          :class="msg.role === 'user' ? 'border-primary/40' : ''"
        >
          <Badge variant="secondary" class="mb-2 text-[10px] uppercase">
            {{ msg.role }}
          </Badge>
          <pre class="whitespace-pre-wrap text-xs">{{ msg.content }}</pre>
        </div>

        <div v-if="streaming && streamText" class="rounded-lg border p-3">
          <Badge class="mb-2 text-[10px] uppercase">assistant</Badge>
          <pre class="whitespace-pre-wrap text-xs">{{ streamText }}</pre>
        </div>

        <div
          v-for="(content, path) in streamingFiles"
          :key="path"
          class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground"
        >
          Writing {{ path }}… ({{ content.length }} chars)
        </div>
      </div>
    </ScrollArea>

    <div class="space-y-2 border-t p-4">
      <Alert v-if="error" variant="destructive">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <form class="space-y-2" @submit.prevent="send">
        <Textarea
          v-model="input"
          rows="3"
          placeholder='e.g. "Build a contact dashboard with search"'
          :disabled="streaming"
        />
        <div class="flex justify-end gap-2">
          <Button v-if="streaming" type="button" variant="outline" @click="stop">
            Stop
          </Button>
          <Button type="submit" :disabled="streaming || !input.trim()">
            {{ streaming ? "Generating…" : "Send" }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>
