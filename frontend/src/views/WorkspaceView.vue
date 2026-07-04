<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, History, Save } from "lucide-vue-next";
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
  <div class="flex h-screen flex-col bg-background">
    <header class="flex items-center justify-between border-b px-4 py-2">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="sm" @click="goBack">
          <ArrowLeft class="mr-1 h-4 w-4" />
          Projects
        </Button>
        <h1 class="text-sm font-medium">
          {{ projects.currentProject?.name ?? "Loading…" }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="snapshotsOpen = true">
          <History class="mr-1 h-4 w-4" />
          Snapshots
        </Button>
        <Button
          size="sm"
          :disabled="!projects.activeFile || saving || projects.isStreaming"
          @click="saveFile"
        >
          <Save class="mr-1 h-4 w-4" />
          {{ saving ? "Saving…" : "Save" }}
        </Button>
      </div>
    </header>

    <Alert v-if="projects.error" variant="destructive" class="rounded-none border-x-0">
      <AlertDescription>{{ projects.error }}</AlertDescription>
    </Alert>

    <div class="grid min-h-0 flex-1 grid-cols-[340px_1fr_380px]">
      <ChatPanel
        :project-id="projectId()"
        :messages="projects.messages"
        @sent="projects.fetchMessages(projectId())"
        @generated="onGenerated"
        @stream-end="onStreamEnd"
        @file-streaming="onFileStreaming"
        @file-complete="onFileComplete"
      />

      <EditorPane
        :files="projects.files"
        :active-file="projects.activeFile"
        :read-only="projects.isStreaming"
        @select="selectFile"
        @update="onEditorUpdate"
      />

      <LivePreview
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
  </div>
</template>
