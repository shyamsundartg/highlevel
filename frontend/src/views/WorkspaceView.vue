<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, History, Save } from "lucide-vue-next";
import AppShell from "@/components/AppShell.vue";
import GenesisLogo from "@/components/GenesisLogo.vue";
import ChatPanel from "@/components/ChatPanel.vue";
import EditorPane from "@/components/EditorPane.vue";
import LivePreview from "@/components/LivePreview.vue";
import SnapshotSheet from "@/components/SnapshotSheet.vue";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProjectsStore } from "@/stores/projects";

const route = useRoute();
const router = useRouter();
const projects = useProjectsStore();

const saving = ref(false);
const snapshotsOpen = ref(false);
const projectId = () => route.params.projectId as string;

onMounted(load);

async function load(): Promise<void> {
  await projects.loadProject(projectId());
}

async function selectFile(fileId: string): Promise<void> {
  await projects.openFile(projectId(), fileId);
}

async function saveFile(): Promise<void> {
  saving.value = true;
  try {
    await projects.saveActiveFile();
  } finally {
    saving.value = false;
  }
}

function onEditorUpdate(content: string): void {
  projects.updateActiveFileContent(content);
}

async function onGenerated(): Promise<void> {
  await Promise.all([
    projects.fetchMessages(projectId()),
    projects.fetchFiles(projectId()),
    projects.fetchSnapshots(projectId()),
  ]);
  await projects.refreshFileContents(projectId());
  projects.bumpPreview();
}

function onFileStreaming(path: string, language: string, content: string): void {
  projects.isStreaming = true;
  projects.setActiveStreamingFile(path, language || "plaintext", content);
}

function onFileComplete(path: string): void {
  const content = projects.fileContentsCache[path];
  if (content !== undefined) {
    projects.upsertStreamingFile(path, "plaintext", content);
  }
}

function onStreamEnd(): void {
  projects.isStreaming = false;
  projects.bumpPreview();
}

async function goBack(): Promise<void> {
  await router.push("/projects");
}
</script>

<template>
  <AppShell variant="workspace">
    <header class="genesis-toolbar">
      <div class="flex min-w-0 items-center gap-3">
        <GenesisLogo size="sm" />
        <Button
          variant="ghost"
          size="sm"
          class="genesis-btn-outline h-8 bg-transparent px-3"
          @click="goBack"
        >
          <ArrowLeft class="mr-1 size-3.5" />
          Projects
        </Button>
        <span class="hidden h-4 w-px bg-[var(--genesis-border)] sm:block" />
        <h1 class="truncate text-sm font-semibold tracking-tight">
          {{ projects.currentProject?.name ?? "Loading…" }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="genesis-btn-outline h-8"
          @click="snapshotsOpen = true"
        >
          <History class="mr-1 size-3.5" />
          Snapshots
        </Button>
        <Button
          size="sm"
          class="genesis-btn-primary h-8 px-4"
          :disabled="!projects.activeFile || saving || projects.isStreaming"
          @click="saveFile"
        >
          <Save class="mr-1 size-3.5" />
          {{ saving ? "Saving…" : "Save" }}
        </Button>
      </div>
    </header>

    <Alert
      v-if="projects.error"
      variant="destructive"
      class="rounded-none border-x-0 border-t-0"
    >
      <AlertDescription>{{ projects.error }}</AlertDescription>
    </Alert>

    <div class="genesis-workspace-grid">
      <ChatPanel
        class="genesis-panel"
        :project-id="projectId()"
        :messages="projects.messages"
        @sent="projects.fetchMessages(projectId())"
        @generated="onGenerated"
        @stream-end="onStreamEnd"
        @file-streaming="onFileStreaming"
        @file-complete="onFileComplete"
      />

      <EditorPane
        class="min-w-0 bg-white/40 backdrop-blur-sm"
        :files="projects.files"
        :active-file="projects.activeFile"
        :read-only="projects.isStreaming"
        @select="selectFile"
        @update="onEditorUpdate"
      />

      <LivePreview
        class="genesis-panel border-r-0 border-l"
        :files="projects.files"
        :file-contents="projects.fileContentsCache"
        :refresh-key="projects.previewRefreshKey"
      />
    </div>

    <SnapshotSheet
      v-model:open="snapshotsOpen"
      :project-id="projectId()"
      :snapshots="projects.snapshots"
    />
  </AppShell>
</template>
