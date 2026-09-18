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

const { data: navigation } = await useAsyncData('navigation', () => content.value.client.navigation(), {
  watch: [() => content.value.routeBase],
})

// Client-only: an SSR value gets baked into the page's ISR entry and would pin search to a stale commit.
const { data: sha } = useAsyncData(
  () => `content-head:${content.value.apiBase}`,
  () =>
    $fetch<{ sha: string | null }>(`${content.value.apiBase}/head`)
      .then(({ sha }) => sha)
      .catch((error) => {
        console.error('[search] could not resolve the content head', error)
        return null
      }),
  { server: false, watch: [() => content.value.apiBase] }
)

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
