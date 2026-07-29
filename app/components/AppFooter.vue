<script setup lang="ts">
const { footer, seo } = useAppConfig()

const year = new Date().getFullYear()
const credits = computed(
  () => footer?.credits || `© ${year} ${footer?.owner || seo?.siteName}.`
)

const links = computed(() => [
  { 
    icon: 'i-lucide-palette',
    to: '/logos',
    'aria-label': 'Brand assets',
  },
  ...(footer?.links ?? []),
])
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
      <UButton
        v-for="(link, index) of links"
        :key="index"
        v-bind="{
          color: 'neutral',
          variant: 'ghost',
          size: 'sm',
          ...link
        }"
        class="text-highlighted"
      />
      <UColorModeButton
        size="sm"
        class="text-highlighted"
      />
    </template>
  </UFooter>
</template>
