<script setup lang="ts">
/**
 * Wordmark by name. Both marks live in the layer because both sites need
 * both: their own in the header, their sibling's in the ecosystem popover.
 * Each mark carries its own height class — the two artworks have different
 * aspect ratios and are sized to match in width.
 */
defineProps<{
  name?: string
}>()
</script>

<template>
  <LogoComarkCms v-if="name === 'comark-cms'" />
  <LogoComark v-else />
</template>
