<script setup lang="ts">
const navigation = useMainNavigation()
</script>

<template>
  <UNavigationMenu
    :items="navigation"
    color="neutral"
    variant="link"
    :highlight="false"
    content-orientation="vertical"
    :ui="{
      content: 'w-max',
      childList: 'p-1',
      childLink: 'px-2.5 py-1 before:inset-x-px before:inset-y-0',
    }"
  />
</template>
