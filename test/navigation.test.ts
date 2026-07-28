import { describe, expect, it } from 'vitest'
import { findBreadcrumb, findPageHeadline, findSurroundLinks } from '../app/utils/navigation'
import type { NavigationItem } from '@comark/cms'

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

  it('returns empty when the page is not in the tree', () => {
    expect(findBreadcrumb(nav, '/nope')).toEqual([])
    expect(findBreadcrumb(nav, undefined)).toEqual([])
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

  it('returns empty for unknown or missing input', () => {
    expect(findSurroundLinks(nav, '/nope')).toEqual([])
    expect(findSurroundLinks(nav, undefined)).toEqual([])
    expect(findSurroundLinks(null, '/a')).toEqual([])
  })
})
