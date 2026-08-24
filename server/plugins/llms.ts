import { appendHeader } from 'h3'
import type { NavigationItem } from 'comark-content'
import { useAppConfig } from 'nitropack/runtime'
import type { NitroApp } from 'nitropack/types'
import { joinURL } from 'ufo'
import type { LLMsSection } from 'nuxt-llms'

export default defineNitroPlugin((nitroApp: NitroApp) => {
  const prerenderPaths = new Set<string>()

  nitroApp.hooks.hook('llms:generate', async (event, options) => {
    const content = await getProdContent()
    const navigation = await content.navigation()
    const site = getSiteConfig(event)
    const appConfig = useAppConfig(event)
    const siteName = appConfig.seo?.siteName || site.name || options.title || ''
    const siteUrl = options.domain || site.url || '/'

    options.title ||= siteName
    options.description ||= appConfig.docs?.llms?.description || site.description || ''

    const introLinks = [
      {
        title: 'Landing page',
        description: `Overview of ${siteName}`,
        href: documentLink('/', siteUrl, prerenderPaths),
      },
      ...standaloneLinks(navigation, siteUrl, prerenderPaths),
    ]

    options.sections.unshift({
      title: 'Documentation',
      description: 'Every page below is available as raw markdown. Fetch any URL directly.',
      links: introLinks,
    })

    for (const item of navigation) {
      if (!item.children?.length) continue

      const links = sectionLinks(item, siteUrl, prerenderPaths)
      if (!links.length) continue

      options.sections.push({
        title: item.title,
        description: item.description,
        links,
      })
    }

    const extraLinks = (appConfig.docs?.llms?.links ?? []) as LLMsSection['links']
    if (extraLinks?.length) {
      options.sections.push({
        title: 'Optional',
        links: extraLinks,
      })
    }
  })

  nitroApp.hooks.hook('llms:generate:full', async (_event, _options, contents) => {
    const content = await getProdContent()
    const navigation = await content.navigation()

    const paths: string[] = []
    const collect = (items: NavigationItem[]) => {
      for (const item of items) {
        if (item.page !== false && item.path && item.path !== '/') paths.push(item.path)
        if (item.children?.length) collect(item.children)
      }
    }
    collect(navigation)

    const pages = await Promise.all(
      [...new Set(paths)].map((path) => renderPageMarkdown(content, path))
    )
    contents.push(...pages.filter((page): page is string => Boolean(page)))
  })

  if (['nitro-prerender', 'nitro-dev'].includes(import.meta.preset as string)) {
    nitroApp.hooks.hook('beforeResponse', (event) => {
      if (event.path === '/') {
        appendHeader(event, 'x-nitro-prerender', Array.from(prerenderPaths))
      }
    })
  }
})

function standaloneLinks(
  navigation: NavigationItem[],
  siteUrl: string,
  prerenderPaths: Set<string>
): NonNullable<LLMsSection['links']> {
  return navigation
    .filter((item) => !item.children?.length && item.page !== false && item.path && item.path !== '/')
    .map((item) => ({
      title: item.title,
      description: item.description,
      href: documentLink(item.path, siteUrl, prerenderPaths),
    }))
}

function sectionLinks(
  item: NavigationItem,
  siteUrl: string,
  prerenderPaths: Set<string>
): NonNullable<LLMsSection['links']> {
  const links: NonNullable<LLMsSection['links']> = []

  const collect = (items: NavigationItem[]) => {
    for (const entry of items) {
      if (entry.page !== false && entry.path && entry.path !== '/') {
        links.push({
          title: entry.title,
          description: entry.description,
          href: documentLink(entry.path, siteUrl, prerenderPaths),
        })
      }
      if (entry.children?.length) collect(entry.children)
    }
  }

  if (item.page !== false && item.path && item.path !== '/') {
    links.push({
      title: item.title,
      description: item.description,
      href: documentLink(item.path, siteUrl, prerenderPaths),
    })
  }

  if (item.children?.length) collect(item.children)

  return links
}

function documentLink(path: string, domain: string, prerenderPaths: Set<string>) {
  const href = joinURL(domain, rawUrlForPage(path))
  prerenderPaths.add(rawUrlForPage(path))
  return href
}
