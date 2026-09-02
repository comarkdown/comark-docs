import { describe, expect, it } from 'vitest'
import { findBreadcrumb, findNavigationLayout, findPageHeadline, findSurroundLinks } from '../app/utils/navigation'
import type { NavigationItem } from 'comark-content'

const nav = [
  {
    title: 'Getting started',
    path: '/getting-started',
    page: false,
    children: [
      { title: 'Introduction', path: '/getting-started/introduction', description: 'Start here' },
      { title: 'Installation', path: '/getting-started/installation' },
    ],
  },
  {
    title: 'Concepts',
    path: '/concepts',
    page: false,
    children: [{ title: 'Architecture', path: '/concepts/architecture' }],
  },
] as unknown as NavigationItem[]

// A directory `index.md`: comark-content emits it as the section node *and* as its own first child.
const navWithIndex = [
  {
    title: 'Getting started',
    path: '/getting-started',
    children: [
      { title: 'Getting started', path: '/getting-started', description: 'Overview' },
      { title: 'Installation', path: '/getting-started/installation' },
    ],
  },
  { title: 'Concepts', path: '/concepts', page: false, children: [{ title: 'Architecture', path: '/concepts/architecture' }] },
] as unknown as NavigationItem[]

describe('findPageHeadline', () => {
  it('returns the section title a page sits under', () => {
    expect(findPageHeadline(nav, '/getting-started/installation')).toBe('Getting started')
    expect(findPageHeadline(nav, '/concepts/architecture')).toBe('Concepts')
  })

  it('returns undefined for unknown or missing input', () => {
    expect(findPageHeadline(nav, '/nope')).toBeUndefined()
    expect(findPageHeadline(nav, undefined)).toBeUndefined()
    expect(findPageHeadline([], '/a')).toBeUndefined()
    expect(findPageHeadline(null, '/a')).toBeUndefined()
  })
})

describe('findBreadcrumb', () => {
  it('returns the trail including the page itself', () => {
    expect(findBreadcrumb(nav, '/getting-started/introduction')).toEqual([
      { title: 'Getting started', path: undefined },
      { title: 'Introduction', path: '/getting-started/introduction' },
    ])
  })

  it('omits the path of non-page section nodes so they render unlinked', () => {
    const trail = findBreadcrumb(nav, '/concepts/architecture')
    expect(trail[0]).toEqual({ title: 'Concepts', path: undefined })
  })

  it('lists a directory index page once, not twice', () => {
    expect(findBreadcrumb(navWithIndex, '/getting-started')).toEqual([
      { title: 'Getting started', path: '/getting-started' },
    ])
    expect(findBreadcrumb(navWithIndex, '/getting-started/installation')).toEqual([
      { title: 'Getting started', path: '/getting-started' },
      { title: 'Installation', path: '/getting-started/installation' },
    ])
  })

  it('returns empty when the page is not in the tree', () => {
    expect(findBreadcrumb(nav, '/nope')).toEqual([])
    expect(findBreadcrumb(nav, undefined)).toEqual([])
  })
})

describe('findNavigationLayout', () => {
  const navigation = [
    {
      title: 'Examples',
      path: '/examples',
      page: false,
      layout: 'page',
      children: [
        { title: 'Overview', path: '/examples/overview' },
        {
          title: 'API',
          path: '/examples/api',
          page: false,
          layout: 'docs',
          children: [{ title: 'Reference', path: '/examples/api/reference' }],
        },
      ],
    },
    { title: 'Examples extended', path: '/examples-extended', layout: 'docs' },
  ] as unknown as NavigationItem[]

  it('inherits a directory layout for its pages, including hidden pages', () => {
    expect(findNavigationLayout(navigation, '/examples/overview')).toBe('page')
    expect(findNavigationLayout(navigation, '/examples/hidden')).toBe('page')
  })

  it('lets a nested directory override an inherited layout', () => {
    expect(findNavigationLayout(navigation, '/examples/api/reference')).toBe('docs')
  })

  it('does not inherit a layout from a partial path segment match', () => {
    expect(findNavigationLayout(navigation, '/examples-extended/page')).toBe('docs')
  })

  it('supports navigation paths prefixed for version previews', () => {
    const previewNavigation = [{
      title: 'Examples',
      path: '/tree/feature/examples',
      page: false,
      layout: 'page',
      children: [{ title: 'Overview', path: '/tree/feature/examples/overview' }],
    }] as unknown as NavigationItem[]

    expect(findNavigationLayout(previewNavigation, '/tree/feature/examples/overview')).toBe('page')
  })

  it('falls back to docs without a matching supported layout', () => {
    expect(findNavigationLayout(navigation, '/unknown')).toBe('docs')
    expect(findNavigationLayout(
      [{ title: 'Custom', path: '/custom', layout: 'custom' }] as unknown as NavigationItem[],
      '/custom'
    )).toBe('docs')
  })

  it('returns undefined for the landing page or without enough navigation context', () => {
    expect(findNavigationLayout(navigation, '/')).toBeUndefined()
    expect(findNavigationLayout([], '/examples')).toBeUndefined()
    expect(findNavigationLayout(null, undefined)).toBeUndefined()
  })
})

describe('findSurroundLinks', () => {
  it('returns the flattened previous and next pages', () => {
    expect(findSurroundLinks(nav, '/getting-started/installation')).toEqual([
      { title: 'Introduction', description: 'Start here', path: '/getting-started/introduction' },
      { title: 'Architecture', description: undefined, path: '/concepts/architecture' },
    ])
  })

  it('crosses section boundaries', () => {
    const [previous] = findSurroundLinks(nav, '/concepts/architecture')
    expect(previous?.path).toBe('/getting-started/installation')
  })

  it('returns null at each end', () => {
    expect(findSurroundLinks(nav, '/getting-started/introduction')[0]).toBeNull()
    expect(findSurroundLinks(nav, '/concepts/architecture')[1]).toBeNull()
  })

  it('counts a directory index page once, not as both section and child', () => {
    expect(findSurroundLinks(navWithIndex, '/getting-started')).toEqual([
      null,
      { title: 'Installation', description: undefined, path: '/getting-started/installation' },
    ])
  })

  it('links back to the index page from its first child', () => {
    const [previous] = findSurroundLinks(navWithIndex, '/getting-started/installation')
    expect(previous).toEqual({ title: 'Getting started', description: 'Overview', path: '/getting-started' })
  })

  it('returns empty for unknown or missing input', () => {
    expect(findSurroundLinks(nav, '/nope')).toEqual([])
    expect(findSurroundLinks(nav, undefined)).toEqual([])
    expect(findSurroundLinks(null, '/a')).toEqual([])
  })
})
