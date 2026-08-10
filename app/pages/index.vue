<script setup lang="ts">
import LandingStack from '../components/landing/LandingStack.vue'
import LandingTabs from '../components/landing/LandingTabs.vue'
import LandingFeatures from '../components/landing/LandingFeatures.vue'
import LandingFeatureCard from '../components/landing/LandingFeatureCard.vue'
import LandingFaq from '../components/landing/LandingFaq.vue'
import LandingCta from '../components/landing/LandingCta.vue'

const landingComponents = {
  LandingStack,
  LandingTabs,
  LandingFeatures,
  LandingFeatureCard,
  LandingFaq,
  LandingCta,
}

const content = useDocsContent()
const site = useSiteConfig()

const { data: page } = await useAsyncData(`${content.value.base}:landing`, () => content.value.client.get('/'))
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Landing page not found', fatal: true })
}

// Prefix every internal link in the content tree so it stays within the preview.
const tree = computed(() => {
  const p = page.value
  return p ? { ...p, nodes: prefixTreeLinks(p.nodes, content.value.base) } : p
})

const fm = computed<Record<string, any>>(() => page.value?.data ?? {})

// Keep branch/commit previews out of search, same as DocsPage.
useRobotsRule(computed(() => (content.value.mode === 'prod' ? 'index, follow' : 'noindex, nofollow')))

useSeoMeta({
  titleTemplate: '',
  title: () => fm.value.seo?.title || fm.value.title,
  ogTitle: () => fm.value.seo?.title || fm.value.title,
  description: () => fm.value.seo?.description || fm.value.description,
  ogDescription: () => fm.value.seo?.description || fm.value.description,
  ogUrl: site.url,
})

useHead({
  link: [{ rel: 'canonical', href: site.url }],
})

if (content.value.mode === 'prod') {
  defineOgImage('DocsSatori', {
    title: fm.value.seo?.title || fm.value.title,
    description: fm.value.seo?.description || fm.value.description,
  })

  // Optional schema.org SoftwareApplication identity, configured through
  // `docs.schemaOrg` in app.config; nothing is emitted when unset.
  const { seo, docs } = useAppConfig()
  const schemaOrg = docs?.schemaOrg as Record<string, unknown> | undefined
  if (schemaOrg && Object.keys(schemaOrg).length) {
    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: seo?.siteName,
            url: site.url,
            ...schemaOrg,
          }),
        },
      ],
    })
  }
}
</script>

<template>
  <MarkdownDocument
    v-if="tree"
    :value="tree"
    :components="landingComponents"
  />
  <div v-else>Landing page not found</div>
</template>
