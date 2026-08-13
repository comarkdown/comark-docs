<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()

useHead({
  htmlAttrs: {
    lang: 'en',
  },
})

useSeoMeta({
  title: 'Page not found',
  description: 'We are sorry but this page could not be found.',
})

const { data: navigation } = await useAsyncData('navigation', () => prodContent.navigation())

const { search: localSearch, status: localSearchStatus, warmup } = useLocalSearch()
const searchOpen = useContentSearch().open
watch(searchOpen, (isOpen) => {
  if (isOpen) warmup()
})

provide('navigation', navigation)
</script>

<template>
  <UApp>
    <AppHeader />

    <UError :error="error" />

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch
        :search="localSearch"
        :search-status="localSearchStatus"
        :navigation="navigation ?? []"
        :loading="localSearchStatus === 'loading'"
      />
    </ClientOnly>
  </UApp>
</template>
