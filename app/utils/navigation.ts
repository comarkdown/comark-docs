import type { NavigationItem } from 'comark-content'

const prefetchedPaths = new Set<string>()
let nuxtApp: ReturnType<typeof useNuxtApp>

function prefetchPath(path?: string) {
  if (!path || prefetchedPaths.has(path)) {
    return
  }
  nuxtApp = nuxtApp ?? useNuxtApp()
  prefetchedPaths.add(path)
  console.log('prefetch', path)
  nuxtApp.hooks.callHook('link:prefetch', path)
}

export function observeNavigation(navigationRef: Ref<HTMLElement | null>, observer?: IntersectionObserver) {
  if (!navigationRef.value || !window.IntersectionObserver) {
    return
  }
  if (observer) {
    observer.disconnect()
  }

  const prefetchObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue
      }

      prefetchPath((entry.target as HTMLAnchorElement).href.replace(window.location.origin, ''))
      prefetchObserver?.unobserve(entry.target)
    }
  })
  navigationRef.value.querySelectorAll<HTMLElement>('a').forEach((element) => prefetchObserver?.observe(element))
  return prefetchObserver
}

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

/**
 * First leaf page under the navigation node at `path`, if `path` is a section (directory) node.
 * Returns `undefined` when the path isn't in the tree or already is a leaf — used to redirect
 * directory URLs like `/getting-started` to their first page.
 */
export function findFirstLeaf(
  navigation: NavigationItem[] | undefined | null,
  path: string | undefined
): string | undefined {
  if (!navigation?.length || !path) return undefined
  const visit = (items: NavigationItem[]): string | undefined => {
    for (const item of items) {
      if (item.path === path) {
        let current = item
        while (current.children?.length) current = current.children[0]!
        // Guard: a directory `index.md` is emitted as its own first child — no redirect to self.
        return current.path !== path ? current.path : undefined
      }
      if (item.children?.length) {
        const found = visit(item.children)
        if (found) return found
      }
    }
    return undefined
  }
  return visit(navigation)
}

export interface BreadcrumbItem {
  title: string
  path?: string
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
