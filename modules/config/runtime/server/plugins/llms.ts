import type { NavigationItem } from 'comark-content'
import type { NitroApp } from 'nitropack/types'
import type { LLMsSection } from 'nuxt-llms'
import { useAppConfig } from 'nitropack/runtime'
import type { DocsPage } from '../../../../../utils/pages'

/**
 * Builds `llms.txt` from the content navigation: one section per top-level directory, in sidebar
 * order, plus the `docs.llms.links` extras. Pages come from `listDocsPages()`, so a directory index is
 * listed once and pages hidden from the sidebar (`navigation: false`) still appear.
 *
 * Registered from modules/config.ts rather than scanned from
 * `server/plugins/` so it runs ahead of the nuxt-agent-discovery bridge, which leaves sections
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
      const [navigation, pages] = await Promise.all([content.navigation(), listDocsPages(content)])
      options.sections.unshift(documentationSection(pages, siteName))
      options.sections.push(...navigationSections(navigation, pages))
    }

    const extraLinks = (appConfig.docs?.llms?.links ?? []) as LLMsSection['links']
    if (extraLinks?.length) {
      options.sections.push({ title: 'Optional', links: extraLinks })
    }
  })
})

/** The landing page and the top-level pages that belong to no section. */
function documentationSection(pages: DocsPage[], siteName: string): LLMsSection {
  return {
    title: 'Documentation',
    description: 'Every page below is available as raw markdown. Fetch any URL directly.',
    links: [
      { title: 'Landing page', description: `Overview of ${siteName}`, href: '/' },
      ...pages.filter((page) => !page.section).map(toLink),
    ],
  }
}

/** One section per top-level directory, in sidebar order, carrying its navigation description. */
function navigationSections(navigation: NavigationItem[], pages: DocsPage[]): LLMsSection[] {
  const sections: LLMsSection[] = []
  for (const item of navigation) {
    if (!item.children?.length) continue
    const links = pages.filter((page) => page.section === item.title).map(toLink)
    if (links.length) sections.push({ title: item.title, description: item.description, links })
  }
  return sections
}

function toLink(page: DocsPage): NonNullable<LLMsSection['links']>[number] {
  return { title: page.title, description: page.description, href: page.path }
}
