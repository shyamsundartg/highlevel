<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "sm" | "md";
    showLabel?: boolean;
  }>(),
  { size: "md", showLabel: false },
);
</script>

<template>
  <div class="genesis-logo-wrap" :class="size === 'sm' ? 'genesis-logo-wrap--sm' : ''">
    <div class="genesis-logo-mark" :class="size === 'sm' ? 'genesis-logo-mark--sm' : ''">
      G
    </div>
    <span v-if="showLabel" class="genesis-logo-label">Genesis</span>
  </div>
</template>
