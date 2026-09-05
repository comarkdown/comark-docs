import type { NavigationItem } from 'comark-content'

export function findPageHeadline(
  navigation: NavigationItem[] | undefined | null,
  path: string | undefined
): string | undefined {
  if (!navigation?.length || !path) return undefined
  for (const item of navigation) {
    if (item.children?.length) {
      const found = walk(item.children, path)
      if (found) return item.title
    }
  }
  return undefined
}

function walk(items: NavigationItem[], path: string): boolean {
  for (const item of items) {
    if (item.path === path) return true
    if (item.children?.length && walk(item.children, path)) return true
  }
  return false
}

export { findFirstLeaf } from '../../utils/first-leaf'

export interface BreadcrumbItem {
  title: string
  path?: string
}

export type NavigationLayout = 'docs' | 'page'

/** Layout declared by the nearest matching page or directory navigation node. */
export function findNavigationLayout(
  navigation: NavigationItem[] | undefined | null,
  path: string | undefined
): NavigationLayout | undefined {
  if (!navigation?.length || !path || path === '/') return undefined

  let layout: NavigationLayout | undefined
  const visit = (items: NavigationItem[]) => {
    for (const item of items) {
      const isPage = item.path === path
      const isDirectory = Boolean(
        item.children?.length
        && item.path !== '/'
        && path.startsWith(`${item.path}/`)
      )
      if (!isPage && !isDirectory) continue

      if (item.layout === 'docs' || item.layout === 'page') layout = item.layout
      if (item.children?.length) visit(item.children)
    }
  }

  visit(navigation)
  return layout || 'docs'
}

/** Trail of navigation items leading to `path`, including the page itself. */
export function findBreadcrumb(
  navigation: NavigationItem[] | undefined | null,
  path: string | undefined
): BreadcrumbItem[] {
  if (!navigation?.length || !path) return []
  const trail: BreadcrumbItem[] = []
  const visit = (items: NavigationItem[]): boolean => {
    for (const item of items) {
      trail.push({ title: item.title, path: item.page !== false ? item.path : undefined })
      if (item.path === path && item.page !== false) return true
      if (item.children?.length && visit(item.children)) return true
      trail.pop()
    }
    return false
  }
  return visit(navigation) ? trail : []
}

export interface SurroundLink {
  title: string
  description?: string
  path: string
}

export function findSurroundLinks(
  navigation: NavigationItem[] | undefined | null,
  path: string | undefined
): Array<SurroundLink | null> {
  if (!navigation?.length || !path) return []

  const flat: SurroundLink[] = []
  const collect = (items: NavigationItem[]) => {
    for (const item of items) {
      // A directory `index.md` is emitted twice: as the section node and as its own first child.
      // Keep only the child, or the page's next link points back at the page itself.
      const selfIndexed = item.children?.some((child) => child.path === item.path)
      if (item.page !== false && !selfIndexed) {
        flat.push({ title: item.title, description: item.description, path: item.path })
      }
      if (item.children?.length) collect(item.children)
    }
  }
  collect(navigation)

  const index = flat.findIndex((item) => item.path === path)
  if (index === -1) return []
  return [flat[index - 1] || null, flat[index + 1] || null]
}
