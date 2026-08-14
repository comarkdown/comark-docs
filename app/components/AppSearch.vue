<script setup lang="ts">
import type { NavigationItem } from 'comark-content'

defineProps<{
  navigation: NavigationItem[]
}>()

// Setup runs on the server too (the `ClientOnly` is inside, around the palette), so `useSearch`'s
// head-sha `useAsyncData` still resolves during SSR and ships in the payload.
const { search, status, warmup } = useSearch()

const open = useContentSearch().open
watch(open, (isOpen) => {
  if (isOpen) warmup()
})
</script>

<template>
  <ClientOnly>
    <LazyUContentSearch
      :search="search"
      :search-status="status"
      :navigation="navigation"
      :transition="false"
      :loading="status === 'loading'"
    />
  </ClientOnly>
</template>
