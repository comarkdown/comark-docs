import type { NavigationItem } from '@comark/cms'
import { useAppConfig } from 'nitropack/runtime'
import { joinURL } from 'ufo'

// llms.txt (https://llmstxt.org): index of every docs page for AI agents, linking the raw markdown mirrors
// under `/raw/**.md`. ISR-cached; purged by the push webhook on content changes.
export default defineEventHandler(async (event) => {
  const cms = await getProdCMS()
  const navigation = await cms.navigation()
  const site = getSiteConfig(event)
  const appConfig = useAppConfig(event)
  const siteUrl = site.url || '/'
  const siteName = appConfig.seo?.siteName || site.name || ''
  const description = appConfig.docs?.llms?.description || site.description || ''

  const lines: string[] = [
    `# ${siteName}`,
    '',
    ...(description ? [`> ${description}`, ''] : []),
    'Every page below is available as raw markdown. Fetch any URL directly.',
    '',
    `- [Landing page](${joinURL(siteUrl, '/raw/index.md')}): Overview of ${siteName}`,
  ]

  const renderItems = (items: NavigationItem[], depth = 0) => {
    for (const item of items) {
      if (item.page !== false && item.path && item.path !== '/') {
        const url = joinURL(siteUrl, rawUrlForPage(item.path))
        lines.push(`- [${item.title}](${url})${item.description ? `: ${item.description}` : ''}`)
      }
      if (item.children?.length) {
        if (depth === 0) {
          lines.push('', `## ${item.title}`, '')
        }
        renderItems(item.children, depth + 1)
      }
    }
  }
  renderItems(navigation)

  const extraLinks = (appConfig.docs?.llms?.links ?? []) as { title: string; description?: string; href: string }[]
  lines.push(
    '',
    '## Optional',
    '',
    `- [Full documentation](${joinURL(siteUrl, '/llms-full.txt')}): all pages concatenated in one file`,
    ...extraLinks.map((link) => `- [${link.title}](${link.href})${link.description ? `: ${link.description}` : ''}`)
  )

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return lines.join('\n') + '\n'
})
