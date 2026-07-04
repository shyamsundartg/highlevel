<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { streamGeneration } from "@/lib/generate";
import type { GenerateEvent, Message } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const props = defineProps<{
  projectId: string;
  messages: Message[];
  class?: string;
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
  const el = listRef.value;
  if (el) {
    el.scrollTop = el.scrollHeight;
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
  <div :class="cn('flex h-full min-h-0 flex-col overflow-hidden', $props.class)">
    <div class="genesis-panel-header shrink-0">
      <h2 class="genesis-panel-title">Chat</h2>
      <p class="genesis-panel-subtitle">Describe your HighLevel app</p>
    </div>

    <div
      ref="listRef"
      class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
    >
      <div class="space-y-3">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="cn(
            'rounded-2xl border px-3.5 py-3',
            msg.role === 'user'
              ? 'border-[rgba(0,113,227,0.2)] bg-white/80'
              : 'border-[var(--genesis-border)] bg-white/50',
          )"
        >
          <p
            class="mb-2 text-[10px] font-semibold uppercase tracking-wide"
            :class="msg.role === 'user' ? 'text-[var(--genesis-blue)]' : 'text-[var(--genesis-muted)]'"
          >
            {{ msg.role }}
          </p>
          <pre class="whitespace-pre-wrap text-xs leading-relaxed">{{ msg.content }}</pre>
        </div>

        <div
          v-if="streaming && streamText"
          class="rounded-2xl border border-[var(--genesis-border)] bg-white/50 px-3.5 py-3"
        >
          <p class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--genesis-muted)]">
            assistant
          </p>
          <pre class="whitespace-pre-wrap text-xs leading-relaxed">{{ streamText }}</pre>
        </div>

        <div
          v-for="(content, path) in streamingFiles"
          :key="path"
          class="rounded-2xl border border-dashed border-[var(--genesis-border)] bg-white/30 px-3.5 py-3 text-xs text-[var(--genesis-muted)]"
        >
          Writing {{ path }}… ({{ content.length }} chars)
        </div>
      </div>
    </div>

    <div class="shrink-0 space-y-2 border-t border-[var(--genesis-border)] bg-white/60 p-4 backdrop-blur-md">
      <Alert v-if="error" variant="destructive" class="rounded-xl">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <form class="space-y-2" @submit.prevent="send">
        <Textarea
          v-model="input"
          rows="3"
          placeholder='e.g. "Build a contact dashboard with search"'
          class="genesis-input min-h-[88px] resize-none rounded-2xl bg-white/90"
          :disabled="streaming"
        />
        <div class="flex justify-end gap-2">
          <Button
            v-if="streaming"
            type="button"
            variant="outline"
            class="genesis-btn-outline"
            @click="stop"
          >
            Stop
          </Button>
          <Button
            type="submit"
            class="genesis-btn-primary"
            :disabled="streaming || !input.trim()"
          >
            {{ streaming ? "Generating…" : "Send" }}
          </Button>
        </div>
      </form>
    </div>
  </div>
</template>
