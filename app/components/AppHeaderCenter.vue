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
  />
</template>
