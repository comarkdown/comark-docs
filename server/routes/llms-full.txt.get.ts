import type { NavigationItem } from '@comark/cms'

/**
 * llms-full.txt: every docs page rendered as markdown, concatenated.
 * ISR-cached; purged by the push webhook on content changes.
 */
export default defineEventHandler(async (event) => {
  const cms = await getProdCMS()
  const navigation = await cms.navigation()

  // Skip the landing page: it's component markup, not prose.
  const paths: string[] = []
  const collect = (items: NavigationItem[]) => {
    for (const item of items) {
      if (item.page !== false && item.path && item.path !== '/') paths.push(item.path)
      if (item.children?.length) collect(item.children)
    }
  }
  collect(navigation)

  const pages = await Promise.all([...new Set(paths)].map((path) => renderPageMarkdown(cms, path)))

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  // No '---' separator: each rendered page already carries a frontmatter fence.
  return pages.filter(Boolean).join('\n\n') + '\n'
})
