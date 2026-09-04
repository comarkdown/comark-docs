import type { NavigationItem } from 'comark-content'
import type { NitroApp } from 'nitropack/types'
import type { LLMsSection } from 'nuxt-llms'
import { useAppConfig } from 'nitropack/runtime'

/**
 * Builds `llms.txt` from the content navigation: one section per top-level directory, in sidebar
 * order, plus the `docs.llms.links` extras. Listed in the layer's `nitro.plugins` rather than scanned
 * from `server/plugins/` so it runs ahead of the nuxt-agent-discovery bridge, which leaves sections
 * that carry links alone apart from rewriting every page link to its raw markdown twin, and renders
 * `llms-full.txt` from the same content adapter.
 */
export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook('llms:generate', async (event, options) => {
    const site = getSiteConfig(event)
    const appConfig = useAppConfig(event)
    const siteName = appConfig.seo?.siteName || site.name || options.title || ''

    options.title ||= siteName
    options.description ||= appConfig.docs?.llms?.description || site.description || ''

    // A consumer declaring `llms.sections` with `navigation` selectors owns the sections; the bridge
    // resolves those. Otherwise the intro goes ahead of the "Documentation Sets" entry nuxt-llms seeds.
    if (!options.sections.some((section) => 'navigation' in section)) {
      const content = await getProdContent()
      const navigation = await content.navigation()
      options.sections.unshift(documentationSection(navigation, siteName))
      options.sections.push(...navigationSections(navigation))
    }

    const extraLinks = (appConfig.docs?.llms?.links ?? []) as LLMsSection['links']
    if (extraLinks?.length) {
      options.sections.push({ title: 'Optional', links: extraLinks })
    }
  })
})

/** The landing page and the top-level pages that belong to no section. */
function documentationSection(navigation: NavigationItem[], siteName: string): LLMsSection {
  return {
    title: 'Documentation',
    description: 'Every page below is available as raw markdown. Fetch any URL directly.',
    links: [
      { title: 'Landing page', description: `Overview of ${siteName}`, href: '/' },
      ...pageLinks(navigation.filter((item) => !item.children?.length)),
    ],
  }
}

/** One section per top-level directory, carrying its navigation description. */
function navigationSections(navigation: NavigationItem[]): LLMsSection[] {
  const sections: LLMsSection[] = []
  for (const item of navigation) {
    if (!item.children?.length) continue
    const links = pageLinks([item])
    if (links.length) sections.push({ title: item.title, description: item.description, links })
  }
  return sections
}

/** Every page in the subtree, depth first, linked on its page URL. */
function pageLinks(items: NavigationItem[]): NonNullable<LLMsSection['links']> {
  const links: NonNullable<LLMsSection['links']> = []
  const collect = (entries: NavigationItem[]) => {
    for (const entry of entries) {
      if (entry.page !== false && entry.path && entry.path !== '/') {
        links.push({ title: entry.title, description: entry.description, href: entry.path })
      }
      if (entry.children?.length) collect(entry.children)
    }
  }
  collect(items)
  return links
}
