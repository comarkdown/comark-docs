<script setup lang="ts">
// Falls back in order: a layer mark, configured images, then the site name as text.
const { header } = useAppConfig()
</script>

<template>
  <LogoMark
    v-if="header?.logo?.mark"
    :name="header.logo.mark"
    class="text-black dark:text-white"
  />
  <template v-else-if="header?.logo?.light || header?.logo?.dark">
    <img
      v-if="header.logo.light"
      :src="header.logo.light"
      :alt="header.logo.alt || header.title"
      class="h-6 w-auto"
      :class="{ 'dark:hidden': header.logo.dark }"
    >
    <img
      v-if="header.logo.dark"
      :src="header.logo.dark"
      :alt="header.logo.alt || header.title"
      class="h-6 w-auto hidden dark:block"
    >
  </template>
  <span
    v-else
    class="text-lg font-semibold text-highlighted"
  >
    {{ header?.title }}
  </span>
</template>
