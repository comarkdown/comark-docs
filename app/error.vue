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
const { data: files } = useLazyAsyncData('search-sections', () => prodContent.searchSections(), {
  server: false,
})

provide('navigation', navigation)

// First real docs page, so a dead link still offers a way into the content.
const docsLink = computed(() => findFirstPagePath(navigation.value ?? []) ?? '/')

interface NavigationNode {
  path?: string
  page?: boolean
  children?: NavigationNode[]
}

function findFirstPagePath(items: NavigationNode[]): string | undefined {
  for (const item of items) {
    if (item.page !== false && item.path && item.path !== '/') return item.path
    if (item.children?.length) {
      const child = findFirstPagePath(item.children)
      if (child) return child
    }
  }
}
</script>

<template>
  <UApp>
    <AppHeader />

    <UError :error="error">
      <template #links>
        <UButton
          size="lg"
          color="primary"
          label="Back to home"
          to="/"
        />
        <UButton
          size="lg"
          color="neutral"
          variant="outline"
          label="Documentation"
          :to="docsLink"
        />
      </template>
    </UError>

    <AppFooter />

    <ClientOnly>
      <LazyUContentSearch
        :files="files ?? []"
        :navigation="navigation ?? []"
      />
    </ClientOnly>
  </UApp>
</template>
