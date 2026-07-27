<script setup lang="ts">
/**
 * Default header logo: the configured logo images when set, the header title
 * as a wordmark otherwise. Consumers override this component by shipping their
 * own `components/AppHeaderLogo.vue`.
 */
const { header } = useAppConfig()
</script>

<template>
  <template v-if="header?.logo?.light || header?.logo?.dark">
    <img
      v-if="header.logo.light"
      :src="header.logo.light"
      :alt="header.logo.alt || header.title"
      class="h-6 w-auto"
      :class="{ 'dark:hidden': header.logo.dark }"
    />
    <img
      v-if="header.logo.dark"
      :src="header.logo.dark"
      :alt="header.logo.alt || header.title"
      class="h-6 w-auto hidden dark:block"
    />
  </template>
  <span
    v-else
    class="text-lg font-semibold text-highlighted"
  >
    {{ header?.title }}
  </span>
</template>
