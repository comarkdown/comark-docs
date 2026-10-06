import type { NavigationItem } from 'comark-content'

/** One public page, as the site indexes (sitemaps, `llms.txt`, RSS) list it. */
export interface DocsPage {
  path: string
  title: string
  description?: string
  /** Title of the top-level navigation node the page sits under; none for a top-level page. */
  section?: string
}

/** A document outside the navigation tree (`navigation: false`), as `content.list()` returns it. */
export interface HiddenDocument {
  path: string
  title?: string
  description?: string
}

/**
 * Every page of the site, in sidebar order and once each.
 *
 * - A directory `index.md` is emitted both as its section node and as that node's first child, so the
 *   same path comes up twice. The entry carrying a description wins.
 * - A document hidden from the sidebar with `navigation: false` (a section landing such as `/plugins`)
 *   is still a public page: it goes first in the section its path falls under, or last when it falls
 *   under none. The homepage (`/`) is left to callers, which each list it their own way.
 */
export function collectDocsPages(navigation: NavigationItem[], hidden: HiddenDocument[] = []): DocsPage[] {
  const pages: DocsPage[] = []
  const byPath = new Map<string, DocsPage>()

  const add = (page: DocsPage, index = pages.length) => {
    const existing = byPath.get(page.path)
    if (existing) {
      if (!existing.description && page.description) existing.description = page.description
      return
    }
    byPath.set(page.path, page)
    pages.splice(index, 0, page)
  }

  const collect = (items: NavigationItem[], section?: string) => {
    for (const item of items) {
      const group = item.children?.length ? (section ?? item.title) : section
      if (item.page !== false && item.path && item.path !== '/') {
        add({ path: item.path, title: item.title, description: item.description, section: group })
      }
      if (item.children?.length) collect(item.children, group)
    }
  }
  collect(navigation)

  for (const doc of hidden) {
    if (!doc.path || doc.path === '/' || byPath.has(doc.path)) continue
    const parent = navigation.find(
      (item) => item.children?.length && item.path && (doc.path === item.path || doc.path.startsWith(`${item.path}/`))
    )
    const title = doc.title || doc.path.split('/').filter(Boolean).pop() || doc.path
    const page: DocsPage = { path: doc.path, title, description: doc.description, section: parent?.title }
    const first = parent ? pages.findIndex((entry) => entry.section === parent.title) : -1
    add(page, first === -1 ? pages.length : first)
  }

  return pages
}
