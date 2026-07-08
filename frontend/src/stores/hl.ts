import { defineStore } from "pinia";
import { ref } from "vue";
import { apiRequest } from "../lib/api";
import type { HlStatus } from "../types/api";

export const useHlStore = defineStore("hl", () => {
  const status = ref<HlStatus>({ connected: false });
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchStatus(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      status.value = await apiRequest<HlStatus>("/hl/status");
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load HL status";
    } finally {
      loading.value = false;
    }
  }

  async function startOAuth(): Promise<void> {
    const { authUrl } = await apiRequest<{ authUrl: string }>("/hl/oauth/start", {
      credentials: "include",
    });
    window.location.href = authUrl;
  }

  async function disconnect(): Promise<void> {
    await apiRequest("/hl/disconnect", { method: "DELETE" });
    status.value = { connected: false };
  }

  function handleOAuthRedirect(): string | null {
    const params = new URLSearchParams(window.location.search);
    const hl = params.get("hl");
    if (!hl) {
      return null;
    }

    const reason = params.get("reason");
    params.delete("hl");
    params.delete("reason");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);

    if (hl === "connected") {
      return "HighLevel connected successfully.";
    }
    if (hl === "error") {
      return `HighLevel connection failed${reason ? `: ${reason}` : ""}.`;
    }
    return null;
  }

  return {
    status,
    loading,
    error,
    fetchStatus,
    startOAuth,
    disconnect,
    handleOAuthRedirect,
  };
});
