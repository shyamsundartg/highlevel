<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import HlConnectionBanner from "@/components/HlConnectionBanner.vue";
import { useAuthStore } from "@/stores/auth";
import { useHlStore } from "@/stores/hl";
import { useProjectsStore } from "@/stores/projects";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const auth = useAuthStore();
const hl = useHlStore();
const projects = useProjectsStore();
const router = useRouter();

const newName = ref("");
const creating = ref(false);
const createError = ref<string | null>(null);
const toast = ref<string | null>(null);

onMounted(async () => {
  const oauthMessage = hl.handleOAuthRedirect();
  if (oauthMessage) toast.value = oauthMessage;
  await Promise.all([hl.fetchStatus(), projects.fetchProjects()]);
});

async function createProject(): Promise<void> {
  const name = newName.value.trim();
  if (!name) return;
  if (!hl.status.connected) {
    createError.value = "Connect HighLevel before creating a project.";
    return;
  }
  creating.value = true;
  createError.value = null;
  try {
    const project = await projects.createProject(name);
    newName.value = "";
    await router.push(`/projects/${project.id}`);
  } catch (err) {
    createError.value =
      err instanceof ApiError && err.code === "HL_NOT_CONNECTED"
        ? "Connect your HighLevel account first."
        : err instanceof Error
          ? err.message
          : "Failed to create project";
  } finally {
    creating.value = false;
  }
}

async function removeProject(projectId: string): Promise<void> {
  if (!confirm("Delete this project?")) return;
  await projects.deleteProject(projectId);
}
</script>

<template>
  <div class="mx-auto min-h-screen max-w-3xl space-y-4 p-6">
    <header class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Projects</h1>
        <p class="text-sm text-muted-foreground">Build HighLevel apps with AI</p>
      </div>
      <Button variant="outline" @click="auth.logout().then(() => router.push('/login'))">
        Sign out
      </Button>
    </header>

    <Alert v-if="toast" :variant="toast.includes('failed') ? 'destructive' : 'default'">
      <AlertDescription>{{ toast }}</AlertDescription>
    </Alert>

    <HlConnectionBanner />

    <Card>
      <CardHeader>
        <CardTitle class="text-base">New project</CardTitle>
        <CardDescription>Requires a connected HighLevel location</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex gap-2" @submit.prevent="createProject">
          <Input v-model="newName" placeholder="Project name" :disabled="!hl.status.connected" />
          <Button type="submit" :disabled="creating || !hl.status.connected">
            {{ creating ? "Creating…" : "Create" }}
          </Button>
        </form>
        <Alert v-if="createError" variant="destructive" class="mt-3">
          <AlertDescription>{{ createError }}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">Your projects</CardTitle>
      </CardHeader>
      <CardContent>
        <p v-if="projects.loading" class="text-sm text-muted-foreground">Loading…</p>
        <Alert v-else-if="projects.error" variant="destructive">
          <AlertDescription>{{ projects.error }}</AlertDescription>
        </Alert>
        <p v-else-if="!projects.projects.length" class="text-sm text-muted-foreground">
          No projects yet.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="project in projects.projects"
            :key="project.id"
            class="flex items-center justify-between gap-3 py-3"
          >
            <button type="button" class="min-w-0 flex-1 text-left" @click="router.push(`/projects/${project.id}`)">
              <p class="font-medium hover:text-primary">{{ project.name }}</p>
              <p class="text-xs text-muted-foreground">
                Updated {{ new Date(project.updatedAt).toLocaleString() }}
              </p>
            </button>
            <Button variant="destructive" size="sm" @click="removeProject(project.id)">
              Delete
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
