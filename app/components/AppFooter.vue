<script setup lang="ts">
const { footer, seo } = useAppConfig()
// Read at render rather than baked into app.config, because content pushes go live
// without a rebuild — so a build-time year would outlive its deploy by months.
// Render time still means the ISR TTL, not the wall clock: for the few minutes
// after midnight on Jan 1 a cached page shows last year. Overriding
// `footer.credits` is the escape hatch if that ever matters.
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
