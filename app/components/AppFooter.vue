<script setup lang="ts">
const { footer, seo } = useAppConfig()
// Computed here rather than in app.config so the year can't go stale between
// deploys — this site publishes content without rebuilding.
const year = new Date().getFullYear()
const credits = computed(
  () => footer?.credits || `© ${year} ${footer?.owner || seo?.siteName}.`
)
</script>

<template>
  <UFooter>
    <template #left>
      <UIcon
        v-if="footer?.icon"
        :name="footer.icon"
        class="text-black dark:text-white"
      />
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
