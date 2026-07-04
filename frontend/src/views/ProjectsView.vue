<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ChevronRight, LogOut, Plus } from "lucide-vue-next";
import AppShell from "@/components/AppShell.vue";
import GenesisLogo from "@/components/GenesisLogo.vue";
import HlConnectionBanner from "@/components/HlConnectionBanner.vue";
import { useAuthStore } from "@/stores/auth";
import { useHlStore } from "@/stores/hl";
import { useProjectsStore } from "@/stores/projects";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
  <AppShell>
    <div class="mx-auto max-w-2xl">
      <header class="genesis-topbar">
        <GenesisLogo size="sm" show-label />
        <Button
          variant="outline"
          class="genesis-btn-outline h-9 px-4 text-sm"
          @click="auth.logout().then(() => router.push('/login'))"
        >
          <LogOut class="mr-1.5 size-3.5" />
          Sign out
        </Button>
      </header>

      <div class="mb-8 space-y-1">
        <h1 class="genesis-page-title">Projects</h1>
        <p class="genesis-page-subtitle">Build HighLevel apps with AI</p>
      </div>

      <div class="space-y-4">
        <Alert
          v-if="toast"
          :variant="toast.includes('failed') ? 'destructive' : 'default'"
          class="rounded-2xl border-[var(--genesis-border)]"
        >
          <AlertDescription>{{ toast }}</AlertDescription>
        </Alert>

        <HlConnectionBanner />

        <section class="glass-card p-6">
          <div class="mb-4 space-y-1">
            <h2 class="text-base font-semibold tracking-tight">New project</h2>
            <p class="text-sm text-[var(--genesis-muted)]">
              Requires a connected HighLevel location
            </p>
          </div>
          <form class="flex gap-2" @submit.prevent="createProject">
            <Input
              v-model="newName"
              placeholder="Project name"
              class="genesis-input h-11 flex-1"
              :disabled="!hl.status.connected"
            />
            <Button
              type="submit"
              class="genesis-btn-primary h-11 px-5"
              :disabled="creating || !hl.status.connected"
            >
              <Plus class="mr-1 size-4" />
              {{ creating ? "Creating…" : "Create" }}
            </Button>
          </form>
          <Alert v-if="createError" variant="destructive" class="mt-3 rounded-xl">
            <AlertDescription>{{ createError }}</AlertDescription>
          </Alert>
        </section>

        <section class="glass-card overflow-hidden p-6">
          <h2 class="mb-4 text-base font-semibold tracking-tight">Your projects</h2>

          <p v-if="projects.loading" class="text-sm text-[var(--genesis-muted)]">
            Loading…
          </p>
          <Alert v-else-if="projects.error" variant="destructive" class="rounded-xl">
            <AlertDescription>{{ projects.error }}</AlertDescription>
          </Alert>
          <p
            v-else-if="!projects.projects.length"
            class="rounded-2xl bg-black/[0.03] px-4 py-8 text-center text-sm text-[var(--genesis-muted)]"
          >
            No projects yet. Create one above to get started.
          </p>
          <ul v-else class="space-y-1">
            <li
              v-for="project in projects.projects"
              :key="project.id"
              class="genesis-project-row group"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 text-left"
                @click="router.push(`/projects/${project.id}`)"
              >
                <div class="min-w-0 flex-1">
                  <p
                    :class="cn(
                      'truncate font-medium tracking-tight',
                      'group-hover:text-[var(--genesis-blue)]',
                    )"
                  >
                    {{ project.name }}
                  </p>
                  <p class="text-xs text-[var(--genesis-muted)]">
                    Updated {{ new Date(project.updatedAt).toLocaleString() }}
                  </p>
                </div>
                <ChevronRight
                  class="size-4 shrink-0 text-[var(--genesis-muted)] opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
              <Button
                variant="ghost"
                size="sm"
                class="shrink-0 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                @click="removeProject(project.id)"
              >
                Delete
              </Button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </AppShell>
</template>
