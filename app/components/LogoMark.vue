<script setup lang="ts">
// Both marks ship in the layer because both sites need both: their own in the header, their
// sibling's in the ecosystem popover. Per-mark height classes size the two aspect ratios to match.
defineProps<{
  name?: string
}>()
</script>

<template>
  <LogoComarkContent v-if="name === 'comark-content'" />
  <LogoComark v-else />
</template>
