import { defineStore } from "pinia";
import { ref } from "vue";
import { apiRequest } from "../lib/api";
import { encodeFileId } from "../lib/fileId";
import type { FileMeta, Message, Project, ProjectFile, Snapshot } from "../types/api";

export const useProjectsStore = defineStore("projects", () => {
  const projects = ref<Project[]>([]);
  const currentProject = ref<Project | null>(null);
  const files = ref<FileMeta[]>([]);
  const activeFile = ref<ProjectFile | null>(null);
  const messages = ref<Message[]>([]);
  const snapshots = ref<Snapshot[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const fileContentsCache = ref<Record<string, string>>({});
  const previewRefreshKey = ref(0);
  const isStreaming = ref(false);

  async function fetchProjects(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data = await apiRequest<{ projects: Project[] }>("/projects");
      projects.value = data.projects;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load projects";
    } finally {
      loading.value = false;
    }
  }

  async function createProject(name: string, description = ""): Promise<Project> {
    const project = await apiRequest<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
    projects.value = [project, ...projects.value];
    return project;
  }

  async function deleteProject(projectId: string): Promise<void> {
    await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
    projects.value = projects.value.filter((p) => p.id !== projectId);
    if (currentProject.value?.id === projectId) {
      currentProject.value = null;
    }
  }

  async function refreshFileContents(projectId: string): Promise<void> {
    await Promise.all(
      files.value.map(async (meta) => {
        const file = await apiRequest<ProjectFile>(
          `/projects/${projectId}/files/${meta.fileId}`,
        );
        fileContentsCache.value[file.path] = file.content;
      }),
    );
  }

  async function loadProject(projectId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    fileContentsCache.value = {};
    activeFile.value = null;

    try {
      currentProject.value = await apiRequest<Project>(`/projects/${projectId}`);
      await Promise.all([
        fetchFiles(projectId),
        fetchMessages(projectId),
        fetchSnapshots(projectId),
      ]);

      if (files.value.length > 0) {
        await refreshFileContents(projectId);

        const initialFile =
          files.value.find((f) => f.path === "preview.html") ?? files.value[0];
        activeFile.value = {
          fileId: initialFile.fileId,
          path: initialFile.path,
          language: initialFile.language,
          sizeBytes: initialFile.sizeBytes,
          updatedAt: initialFile.updatedAt,
          content: fileContentsCache.value[initialFile.path] ?? "",
        };
      }

      previewRefreshKey.value += 1;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load project";
    } finally {
      loading.value = false;
    }
  }

  async function fetchFiles(projectId: string): Promise<void> {
    const data = await apiRequest<{ files: FileMeta[] }>(
      `/projects/${projectId}/files`,
    );
    files.value = data.files;
  }

  async function openFile(
    projectId: string,
    fileId: string,
    force = false,
  ): Promise<void> {
    if (!force && activeFile.value?.fileId === fileId) {
      return;
    }

    const meta = files.value.find((f) => f.fileId === fileId);
    const cachedContent =
      meta && fileContentsCache.value[meta.path] !== undefined
        ? fileContentsCache.value[meta.path]
        : undefined;

    if (!force && meta && cachedContent !== undefined) {
      activeFile.value = {
        fileId: meta.fileId,
        path: meta.path,
        language: meta.language,
        sizeBytes: meta.sizeBytes,
        updatedAt: meta.updatedAt,
        content: cachedContent,
      };
      return;
    }

    activeFile.value = await apiRequest<ProjectFile>(
      `/projects/${projectId}/files/${fileId}`,
    );
    if (activeFile.value) {
      fileContentsCache.value[activeFile.value.path] = activeFile.value.content;
    }
  }

  async function saveActiveFile(): Promise<void> {
    if (!currentProject.value || !activeFile.value) {
      return;
    }
    const saved = await apiRequest<ProjectFile>(
      `/projects/${currentProject.value.id}/files/${activeFile.value.fileId}`,
      {
        method: "PUT",
        body: JSON.stringify({ content: activeFile.value.content }),
      },
    );
    activeFile.value = saved;
    fileContentsCache.value[saved.path] = saved.content;
    await fetchFiles(currentProject.value.id);
    previewRefreshKey.value += 1;
  }

  async function fetchMessages(projectId: string): Promise<void> {
    const data = await apiRequest<{ messages: Message[] }>(
      `/projects/${projectId}/messages`,
    );
    messages.value = data.messages;
  }

  async function fetchSnapshots(projectId: string): Promise<void> {
    const data = await apiRequest<{ snapshots: Snapshot[] }>(
      `/projects/${projectId}/snapshots`,
    );
    snapshots.value = data.snapshots;
  }

  async function restoreSnapshot(projectId: string, snapshotId: string): Promise<void> {
    await apiRequest(`/projects/${projectId}/snapshots/${snapshotId}/restore`, {
      method: "POST",
    });

    const previousActiveId = activeFile.value?.fileId;
    fileContentsCache.value = {};

    await fetchFiles(projectId);

    await refreshFileContents(projectId);

    const targetId =
      previousActiveId && files.value.some((f) => f.fileId === previousActiveId)
        ? previousActiveId
        : files.value[0]?.fileId;

    if (targetId) {
      const meta = files.value.find((f) => f.fileId === targetId);
      if (meta) {
        activeFile.value = {
          fileId: meta.fileId,
          path: meta.path,
          language: meta.language,
          sizeBytes: meta.sizeBytes,
          updatedAt: meta.updatedAt,
          content: fileContentsCache.value[meta.path] ?? "",
        };
      }
    } else {
      activeFile.value = null;
    }

    await fetchSnapshots(projectId);
    previewRefreshKey.value += 1;
  }

  function bumpPreview(): void {
    previewRefreshKey.value += 1;
  }

  function updateActiveFileContent(content: string): void {
    if (!activeFile.value || activeFile.value.content === content) {
      return;
    }
    activeFile.value = { ...activeFile.value, content };
    fileContentsCache.value[activeFile.value.path] = content;
  }

  function upsertStreamingFile(path: string, language: string, content: string): void {
    const fileId = encodeFileId(path);
    const existing = files.value.find((f) => f.fileId === fileId);
    if (!existing) {
      files.value = [
        ...files.value,
        {
          fileId,
          path,
          language,
          sizeBytes: content.length,
          updatedAt: Date.now(),
        },
      ];
    }
    if (activeFile.value?.fileId === fileId) {
      activeFile.value = {
        ...(activeFile.value ?? {
          fileId,
          path,
          language,
          sizeBytes: content.length,
          updatedAt: Date.now(),
        }),
        content,
      };
    }
  }

  function setActiveStreamingFile(
    path: string,
    language: string,
    content: string,
  ): void {
    const fileId = encodeFileId(path);
    upsertStreamingFile(path, language, content);
    activeFile.value = {
      fileId,
      path,
      language,
      sizeBytes: new TextEncoder().encode(content).length,
      updatedAt: Date.now(),
      content,
    };
    fileContentsCache.value[path] = content;
  }

  return {
    projects,
    currentProject,
    files,
    activeFile,
    messages,
    snapshots,
    loading,
    error,
    fileContentsCache,
    previewRefreshKey,
    isStreaming,
    fetchProjects,
    createProject,
    deleteProject,
    loadProject,
    fetchFiles,
    refreshFileContents,
    openFile,
    saveActiveFile,
    fetchMessages,
    fetchSnapshots,
    restoreSnapshot,
    updateActiveFileContent,
    upsertStreamingFile,
    setActiveStreamingFile,
    bumpPreview,
  };
});
