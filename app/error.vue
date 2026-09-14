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

const [{ data: navigation }, { data: sha }] = await Promise.all([
  useAsyncData('navigation', () => prodContent.navigation()),
  useAsyncData(
    'content-head-sha',
    () => $fetch<{ sha: string | null }>('/api/content/head').then(({ sha }) => sha),
    { default: () => null }
  ),
])

provide('navigation', navigation)
provide('sha', sha)
</script>

<template>
  <UApp>
    <AppHeader />

    <UError :error="error" />

    <AppFooter />

    <AppSearch :navigation="navigation ?? []" />
  </UApp>
</template>
