import type { NavigationItem } from '@comark/cms'
import type { NavigationMenuItem } from '@nuxt/ui/components/NavigationMenu.vue'

export interface NavGroup {
  label: string
  /** Top-level content sections grouped under this tab. */
  sections: string[]
  /**
   * Where the tab links to: the first leaf page of the first section
   * (default) or the section index page.
   */
  link?: 'first-leaf' | 'section'
}

/** Walk down to the first leaf page of a navigation node. */
function firstLeaf(item: NavigationItem): string {
  let current = item
  while (current.children?.length) current = current.children[0]!
  return current.path
}

/** Logical top-level segment of a path, ignoring the active version `base`. */
function segmentOf(path: string, base: string): string {
  const rel = base && path.startsWith(base) ? path.slice(base.length) : path
  return rel.split('/').filter(Boolean)[0] ?? ''
}

/**
 * The `header.nav` groups from app.config; defaults to one tab per top-level
 * navigation node when unset.
 */
function navGroups(navigation: NavigationItem[], base: string): NavGroup[] {
  const { header } = useAppConfig()
  const groups = (header?.nav ?? []) as NavGroup[]
  if (groups.length) return groups

  return navigation.map((item) => ({
    label: item.title,
    sections: [segmentOf(item.path, base)],
  }))
}

/** High-level navbar items, one per configured nav group (plus GitHub). */
export function useMainNavigation(): ComputedRef<NavigationMenuItem[]> {
  const route = useRoute()
  const cms = useCMS()
  const { github } = useAppConfig()
  const navigation = inject<Ref<NavigationItem[]>>('navigation', ref([]))

  return computed<NavigationMenuItem[]>(() => {
    const base = cms.value.base
    const seg = segmentOf(route.path, base)

    const bySegment = new Map<string, NavigationItem>()
    for (const item of navigation.value ?? []) bySegment.set(segmentOf(item.path, base), item)

    const items: NavigationMenuItem[] = []

    for (const group of navGroups(navigation.value ?? [], base)) {
      const node = group.sections.map((s) => bySegment.get(s)).find(Boolean)
      if (!node) continue
      items.push({
        label: group.label,
        to: group.link === 'section' ? node.path : firstLeaf(node),
        active: group.sections.includes(seg),
      })
    }

    const githubUrl =
      github?.url || (github?.owner && github?.name ? `https://github.com/${github.owner}/${github.name}` : '')
    if (githubUrl) {
      items.push({
        label: 'GitHub',
        to: githubUrl,
        target: '_blank',
      })
    }

    return items
  })
}

/** The sidebar tree for the active tab. */
export function useFilteredNavigation(): ComputedRef<NavigationItem[]> {
  const route = useRoute()
  const cms = useCMS()
  const navigation = inject<Ref<NavigationItem[]>>('navigation', ref([]))

  return computed<NavigationItem[]>(() => {
    const base = cms.value.base
    const seg = segmentOf(route.path, base)
    const nav = navigation.value ?? []

    const groups = navGroups(nav, base)
    const active = groups.find((group) => group.sections.includes(seg)) ?? groups[0]
    if (!active) return nav

    // Single-section tab: that section's children as a flat tree.
    if (active.sections.length === 1) {
      const node = nav.find((item) => segmentOf(item.path, base) === active.sections[0])
      return (node?.children ?? []).filter((child) => child.path !== node?.path)
    }

    // Multi-section tab: the sections as collapsible groups.
    return nav.filter((item) => active.sections.includes(segmentOf(item.path, base)))
  })
}
