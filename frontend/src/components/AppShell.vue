<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Full-height workspace layout without outer padding */
    variant?: "default" | "workspace";
  }>(),
  { variant: "default" },
);
</script>

<template>
  <div
    class="genesis-app"
    :class="variant === 'workspace' ? 'genesis-app--workspace' : 'genesis-app--default'"
  >
    <div class="genesis-bg" aria-hidden="true">
      <div class="genesis-orb genesis-orb-a" />
      <div class="genesis-orb genesis-orb-b" />
      <div class="genesis-orb genesis-orb-c" />
    </div>
    <div class="genesis-shell">
      <slot />
    </div>
  </div>
</template>
