<script setup lang="ts">
import type { NuxtError } from '#app'
import type { NavigationItem } from 'comark-content'

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

const content = useDocsContent()

const [{ data: navigation }, { data: sha }] = await Promise.all([
  useAsyncData('navigation', () => content.value.client.navigation(), {
    watch: [() => content.value.routeBase],
  }),
  useAsyncData(
    () => `content-head:${content.value.apiBase}`,
    () => $fetch<{ sha: string | null }>(`${content.value.apiBase}/head`).then(({ sha }) => sha),
    { default: () => null, watch: [() => content.value.apiBase] }
  ),
])

// Matches app.vue: nav must be prefixed the same way search results are, so the palette can look them up.
const navTree = computed<NavigationItem[]>(() => prefixNavigation(navigation.value ?? [], content.value.routeBase))

provide('navigation', navTree)
provide('sha', sha)
</script>

<template>
  <UApp>
    <AppHeader />

    <UError :error="error" />

    <AppFooter />

    <AppSearch :navigation="navTree" />
  </UApp>
</template>
