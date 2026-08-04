<script setup lang="ts">
import { joinURL } from 'ufo'
import type { NavigationItem } from 'comark-content'
import { Mermaid } from '@comark/nuxt/plugins/mermaid'
import CodeExplorer from '../components/CodeExplorer.vue'
import Browser from '../components/Browser.vue'

definePageMeta({
  layout: 'docs',
  path: '/:slug(.+)',
})

const { toc, seo } = useAppConfig()
const navigation = inject<Ref<NavigationItem[]>>('navigation')
const content = useDocsContent()

const { data: page } = await useAsyncData(`${content.value.base}:${content.value.path}`, () =>
  content.value.client.get(content.value.path)
)
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const selfPath = computed(() => prefixLink(content.value.path, content.value.base))

const tree = computed(() => {
  const p = page.value
  return p ? { ...p, nodes: prefixTreeLinks(p.nodes, content.value.base) } : p
})

const surroundLinks = computed(() => findSurroundLinks(navigation?.value, selfPath.value))

const fm = computed<Record<string, any>>(() => page.value?.data ?? {})
const tocLinks = computed<any[]>(() => (page.value?.meta as any)?.toc?.links ?? [])

const title = computed(() => fm.value.seo?.title || fm.value.title)
const description = computed(() => fm.value.seo?.description || fm.value.description)

const site = useSiteConfig()
// Previews (/tree, /blob) canonicalize to the production URL.
const canonicalUrl = computed(() => joinURL(site.url, content.value.path))

useRobotsRule(computed(() => (content.value.mode === 'prod' ? 'index, follow' : 'noindex, nofollow')))

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogUrl: canonicalUrl,
})

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const headline = computed(() => findPageHeadline(navigation?.value, selfPath.value))

if (content.value.mode === 'prod') {
  defineOgImage('DocsSatori', {
    title: fm.value.title,
    description: fm.value.description,
    headline: findPageHeadline(navigation?.value, content.value.path) ?? '',
  })

  const breadcrumb = computed(() => findBreadcrumb(navigation?.value, selfPath.value))

  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: computed(() =>
          jsonLd([
            {
              '@context': 'https://schema.org',
              '@type': 'TechArticle',
              headline: fm.value.title,
              description: fm.value.description,
              url: canonicalUrl.value,
              inLanguage: 'en',
              isPartOf: {
                '@type': 'WebSite',
                name: seo?.siteName,
                url: site.url,
              },
              author: { '@type': 'Organization', name: seo?.siteName, url: site.url },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Docs', item: site.url },
                ...breadcrumb.value.map((item, index) => ({
                  '@type': 'ListItem',
                  position: index + 2,
                  name: item.title,
                  ...(item.path ? { item: joinURL(site.url, item.path) } : {}),
                })),
              ],
            },
          ])
        ),
      },
    ],
  })
}
</script>

<template>
  <UPage
    v-if="page"
    :ui="{ root: 'lg:grid-cols-12 flex-col-reverse', center: 'lg:col-span-9', right: 'lg:col-span-3' }"
  >
    <UPageHeader
      :title="fm.title"
      :description="fm.description"
      :headline="headline"
    />

    <UPageBody>
      <MarkdownDocument
        v-if="tree"
        :value="tree"
        :components="{ Mermaid, CodeExplorer, Browser }"
      />

      <UContentSurround
        :surround="surroundLinks as any"
        :ui="{ root: !surroundLinks[0] ? 'sm:grid-cols-1' : 'sm:grid-cols-2' }"
      />
    </UPageBody>

    <template #right>
      <UContentToc
        highlight
        highlight-color="primary"
        highlight-variant="circuit"
        :title="toc?.title"
        :links="tocLinks"
        class="hidden lg:flex"
      >
        <template #bottom>
          <div class="hidden lg:block space-y-6">
            <USeparator
              v-if="tocLinks.length"
              type="solid"
            />

            <DocsPageAsideLinks :page="page" />
          </div>
        </template>
      </UContentToc>
      <DocsAsideMobileBar :toc-links="tocLinks">
        <template #bottom>
          <USeparator
            v-if="tocLinks.length"
            type="solid"
          />
          <DocsPageAsideLinks :page="page" />
        </template>
      </DocsAsideMobileBar>
    </template>
  </UPage>
</template>
