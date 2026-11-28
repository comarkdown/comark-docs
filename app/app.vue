<script setup lang="ts">
import type { NavigationItem } from 'comark-content'
import { joinURL } from 'ufo'
import { useRoute } from 'vue-router'

const { seo, docs } = useAppConfig()

const content = useDocsContent()
const route = useRoute()

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

const nuxtApp = useNuxtApp()
const navTree = computed<NavigationItem[]>(() => prefixNavigation(navigation.value ?? [], content.value.routeBase))
const resolveNavigationLayout = () => {
  return resolveRouteLayout(navigation.value, route, content.value.routeBase ? content.value.path : route.path)
}
const navigationLayout = ref(resolveNavigationLayout())
onNuxtReady(() => {
  nuxtApp.hook('page:finish', () => {
    navigationLayout.value = resolveNavigationLayout()
  })
})

const site = useSiteConfig()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    // Search for agents (https://blog.cloudflare.com/search-for-agents/), served by server/routes/.well-known/search.ts.
    {
      name: 'agent:instructions',
      content:
        'Use this search API to find relevant content across this site with keywords or natural-language queries, instead of crawling individual pages. Results are returned in Markdown.',
    },
    { name: 'agent:endpoint', content: `${joinURL(site.url, '/.well-known/search')}?q={query}` },
    { name: 'agent:method', content: 'GET' },
  ],
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
provide('sha', sha)

const historyOpen = useVersionHistory()

const { assistant } = useAppConfig()

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

    <div class="flex">
      <div class="flex-1 min-w-0">
        <AppHeader />

        <UMain>
          <Suspense>
            <LayoutsPage v-if="navigationLayout === 'page'">
              <NuxtPage />
            </LayoutsPage>
            <LayoutsDocs v-else-if="navigationLayout === 'docs'">
              <NuxtPage />
            </LayoutsDocs>
            <NuxtPage v-else />
          </Suspense>
        </UMain>

        <AppFooter />
      </div>

      <ClientOnly>
        <LazyAssistantChat v-if="assistant?.enabled" />
      </ClientOnly>
    </div>

    <ClientOnly>
      <AppSearch :navigation="navTree" />
      <LazyVersionHistory />
    </ClientOnly>
  </UApp>
</template>
