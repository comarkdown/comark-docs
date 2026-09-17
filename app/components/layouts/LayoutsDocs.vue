<script setup lang="ts">
const sidebar = useFilteredNavigation()
</script>

<template>
  <UContainer>
    <UPage>
      <template #left>
        <UPageAside>
          <UContentNavigation
            variant="link"
            :collapsible="false"
            :navigation="sidebar"
          />
        </UPageAside>
      </template>

      <slot />
    </UPage>
  </UContainer>
</template>
