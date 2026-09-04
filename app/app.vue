<script setup lang="ts">
import type { NavigationItem } from 'comark-content'
import { useRoute } from 'vue-router'

const { seo, docs } = useAppConfig()

const content = useDocsContent()
const route = useRoute()

const { data: navigation } = await useAsyncData('navigation', () => content.value.client.navigation(), {
  watch: [() => content.value.base],
})

const nuxtApp = useNuxtApp()
const navTree = computed<NavigationItem[]>(() => prefixNavigation(navigation.value ?? [], content.value.base))
const navigationLayout = ref(findNavigationLayout(navTree.value, route.path))
onNuxtReady(() => {
  nuxtApp.hook('page:finish', () => {
    navigationLayout.value = findNavigationLayout(navTree.value, route.path)
  })
})

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
provide('layout', navigationLayout)

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
      <Suspense>
        <LayoutsPage v-if="navigationLayout === 'page'">
          <NuxtPage />
        </LayoutsPage>
        <LayoutsDocs v-else-if="navigationLayout === 'docs'">
          <NuxtPage />
        </LayoutsDocs>
        <UContainer v-else>
          <NuxtPage />
        </UContainer>
      </Suspense>
    </UMain>

    <AppFooter />

    <AppSearch :navigation="navTree" />

    <ClientOnly>
      <LazyVersionHistory />
      <LazyAssistantChat v-if="assistant?.enabled && assistantMounted" />
    </ClientOnly>
  </UApp>
</template>
