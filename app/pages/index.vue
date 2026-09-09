<script setup lang="ts">
import LandingStack from '../components/landing/LandingStack.vue'
import LandingTabs from '../components/landing/LandingTabs.vue'
import LandingFeatures from '../components/landing/LandingFeatures.vue'
import LandingFeatureCard from '../components/landing/LandingFeatureCard.vue'
import LandingFaq from '../components/landing/LandingFaq.vue'
import LandingCta from '../components/landing/LandingCta.vue'
import LandingHeroDemo from '../components/landing/LandingHeroDemo.vue'

const landingComponents = {
  LandingStack,
  LandingTabs,
  LandingFeatures,
  LandingFeatureCard,
  LandingFaq,
  LandingCta,
  LandingHeroDemo,
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

// `/raw/index.md`, not `/index.md`: the homepage document has no `.md` twin of its own, so this is
// the URL the module routes at the edge. Same as nuxt.com and ui.nuxt.com.
useCanonical('/raw/index.md')

if (content.value.mode === 'prod') {
  defineOgImage('DocsSatori', {
    title: fm.value.seo?.title || fm.value.title,
    description: fm.value.seo?.description || fm.value.description,
  })

  // Optional schema.org identity, configured through `docs.schemaOrg` in app.config; nothing is
  // emitted when unset. `organization` becomes its own top-level node (with contactPoint/address it
  // is what agents check to verify the business); everything else describes the SoftwareApplication.
  const { seo, docs } = useAppConfig()
  const { organization, ...softwareApp } = (docs?.schemaOrg ?? {}) as Record<string, unknown> & {
    organization?: Record<string, unknown>
  }
  // `WebSite` and `WebPage` come from nuxt-schema-org, which also owns the `@id` links to these.
  // Both inputs are cast: the app config carries them untyped, as whatever schema.org accepts.
  const nodes = [
    ...(Object.keys(softwareApp).length
      ? [defineSoftwareApp({ name: seo?.siteName, ...softwareApp } as Parameters<typeof defineSoftwareApp>[0])]
      : []),
    ...(organization && Object.keys(organization).length
      ? [defineOrganization({ name: seo?.siteName, ...organization } as Parameters<typeof defineOrganization>[0])]
      : []),
  ]
  if (nodes.length) {
    useSchemaOrg(nodes)
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
