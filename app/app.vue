<script setup lang="ts">
import type { NavigationItem } from 'comark-content'

const { seo, docs } = useAppConfig()

const content = useDocsContent()

const { data: navigation } = await useAsyncData('navigation', () => content.value.client.navigation(), {
  watch: [() => content.value.base],
})

const { search, status, warmup } = useLocalSearch()

const searchOpen = useContentSearch().open
watch(searchOpen, (isOpen) => {
  if (isOpen) warmup()
})

const navTree = computed<NavigationItem[]>(() => prefixNavigation(navigation.value ?? [], content.value.base))

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: docs?.rss?.title || `${seo?.siteName} Documentation`,
      href: '/rss.xml',
    },
  ],
  htmlAttrs: {
    lang: 'en',
  },
})

useSeoMeta({
  titleTemplate: `%s | ${seo?.siteName}`,
  ogSiteName: seo?.siteName,
  twitterCard: 'summary_large_image',
})

provide('navigation', navTree)

// const colorMode = useColorMode()
const historyOpen = useVersionHistory()

const { assistant } = useAppConfig()
const assistantOpen = useAssistant()

// Mounting pulls the AI SDK + shiki chunks, so the panel only mounts after the first open.
const assistantMounted = ref(false)
watch(assistantOpen, (isOpen) => {
  if (isOpen) assistantMounted.value = true
})

defineShortcuts({
  // Disabled `d` for now as it prevents the playground editor to work with the `d` letter
  // 'd': () => (colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'),
  'g-h': () => (historyOpen.value = !historyOpen.value),
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator
      :height="2"
      color="var(--ui-text-highlighted)"
    />

    <AppHeader />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch
        :search="search"
        :search-status="status"
        :navigation="navTree"
        :transition="false"
        :loading="status === 'loading'"
      />
      <LazyVersionHistory />
      <LazyAssistantChat v-if="assistant?.enabled && assistantMounted" />
    </ClientOnly>
  </UApp>
</template>
