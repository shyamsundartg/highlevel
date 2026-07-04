import { ref } from "vue";

export function useEditorTabs() {
  const openTabIds = ref<string[]>([]);

  function openTab(fileId: string): void {
    if (!openTabIds.value.includes(fileId)) {
      openTabIds.value.push(fileId);
    }
  }

  function closeTab(fileId: string): string | null {
    const index = openTabIds.value.indexOf(fileId);
    if (index === -1) {
      return null;
    }
    openTabIds.value.splice(index, 1);
    if (openTabIds.value.length === 0) {
      return null;
    }
    const nextIndex = index >= openTabIds.value.length ? index - 1 : index;
    return openTabIds.value[nextIndex] ?? null;
  }

  return { openTabIds, openTab, closeTab };
}
