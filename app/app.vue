<script setup lang="ts">
import type { NavigationItem } from '@comark/cms'
import type { SearchSection } from './utils/search-sections'

const { seo, docs } = useAppConfig()

const cms = useCMS()

const { data: navigation } = await useAsyncData('navigation', () => cms.value.client.navigation(), {
  watch: [() => cms.value.base],
})
const {
  data: files,
  status,
  execute: loadSearchSections,
} = useLazyAsyncData('search-sections', () => cms.value.client.searchSections(), {
  server: false,
  watch: [() => cms.value.base],
  immediate: false,
})

onNuxtReady(() => loadSearchSections())

const navTree = computed<NavigationItem[]>(() => prefixNavigation(navigation.value ?? [], cms.value.base))
const searchFiles = computed<SearchSection[]>(() =>
  (files.value ?? []).map((section) => {
    const [path, hash] = section.id.split('#')
    return { ...section, id: prefixLink(path!, cms.value.base) + (hash ? `#${hash}` : '') }
  })
)

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

const colorMode = useColorMode()
const historyOpen = useVersionHistory()

const { assistant } = useAppConfig()
const assistantOpen = useAssistant()

// Mounting pulls the AI SDK + shiki chunks, so the panel only mounts after the first open.
const assistantMounted = ref(false)
watch(assistantOpen, (isOpen) => {
  if (isOpen) assistantMounted.value = true
})

defineShortcuts({
  'd': () => (colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'),
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
        :files="searchFiles"
        :navigation="navTree"
        :transition="false"
        :loading="status !== 'success'"
        :placeholder="status !== 'success' ? 'Loading...' : undefined"
      />
      <LazyVersionHistory />
      <LazyAssistantChat v-if="assistant?.enabled && assistantMounted" />
    </ClientOnly>
  </UApp>
</template>
