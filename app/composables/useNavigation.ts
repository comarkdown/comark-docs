import type { NavigationItem } from 'comark-content'
import type { NavigationMenuItem } from '@nuxt/ui/components/NavigationMenu.vue'

export interface NavGroup {
  label: string
  /** Top-level content sections grouped under this tab. */
  sections?: string[]
  /** Where the tab links: the first leaf page of the first section (default) or the section index page. */
  link?: 'first-leaf' | 'section'
  /** Explicit target for a tab backed by an app route rather than content sections. */
  to?: string
  /** Path prefix that marks a manual tab active; defaults to `to`. */
  activePath?: string
  /** Dropdown items for a manual tab. */
  children?: NavGroupChild[]
}

export interface NavGroupChild {
  label: string
  to: string
  /** Path prefix that marks the child active; defaults to `to` without its query string. */
  activePath?: string
}

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

/** The `header.nav` groups from app.config; defaults to one tab per top-level navigation node. */
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
  const cms = useDocsContent()
  const { github } = useAppConfig()
  const navigation = inject<Ref<NavigationItem[]>>('navigation', ref([]))

  return computed<NavigationMenuItem[]>(() => {
    const base = cms.value.base
    const seg = segmentOf(route.path, base)

    const bySegment = new Map<string, NavigationItem>()
    for (const item of navigation.value ?? []) bySegment.set(segmentOf(item.path, base), item)

    const items: NavigationMenuItem[] = []

    for (const group of navGroups(navigation.value ?? [], base)) {
      // Manual tab: an explicit app-route link, optionally with a dropdown.
      if (group.to) {
        items.push({
          label: group.label,
          to: group.to,
          active: seg === segmentOf(group.activePath ?? group.to, base),
          ...(group.children?.length && {
            children: group.children.map((child) => ({
              label: child.label,
              to: child.to,
              active: route.path.startsWith((child.activePath ?? child.to).split('?')[0]!),
            })),
          }),
        })
        continue
      }

      const node = group.sections?.map((s) => bySegment.get(s)).find(Boolean)
      if (!node) continue
      items.push({
        label: group.label,
        to: group.link === 'section' ? node.path : firstLeaf(node),
        active: (group.sections ?? []).includes(seg),
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
  const cms = useDocsContent()
  const navigation = inject<Ref<NavigationItem[]>>('navigation', ref([]))

  return computed<NavigationItem[]>(() => {
    const base = cms.value.base
    const seg = segmentOf(route.path, base)
    const nav = navigation.value ?? []

    const groups = navGroups(nav, base)
    const active = groups.find((group) => group.sections?.includes(seg)) ?? groups[0]
    const sections = active?.sections
    // Manual tabs (no sections) have no content sidebar; fall back to the full tree.
    if (!sections?.length) return nav

    // Single-section tab: that section's children as a flat tree.
    if (sections.length === 1) {
      const node = nav.find((item) => segmentOf(item.path, base) === sections[0])
      return (node?.children ?? []).filter((child) => child.path !== node?.path)
    }

    // Multi-section tab: the sections as collapsible groups.
    return nav.filter((item) => sections.includes(segmentOf(item.path, base)))
  })
}
