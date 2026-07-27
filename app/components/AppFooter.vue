<script setup lang="ts">
const { footer, seo } = useAppConfig()
const year = new Date().getFullYear()
const credits = computed(() => footer?.credits || `Copyright © ${seo?.siteName} ${year}. All rights reserved.`)
</script>

<template>
  <UFooter>
    <template #left>
      {{ credits }}
    </template>

    <template #right>
      <template v-if="footer?.links">
        <UButton
          v-for="(link, index) of footer?.links"
          :key="index"
          v-bind="{ color: 'neutral', variant: 'ghost', size: 'sm', ...link }"
          class="text-highlighted"
        />
      </template>
      <UColorModeButton
        size="sm"
        class="text-highlighted"
      />
    </template>
  </UFooter>
</template>
