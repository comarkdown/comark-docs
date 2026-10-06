import { describe, expect, it } from 'vitest'
import type { NavigationItem } from 'comark-content'
import { collectDocsPages } from '../utils/pages'

const navigation = [
  { title: 'Overview', path: '/overview', description: 'Top-level page' },
  {
    title: 'Getting started',
    path: '/getting-started',
    page: false,
    children: [
      { title: 'Introduction', path: '/getting-started/introduction', description: 'Start here' },
      { title: 'Installation', path: '/getting-started/installation' },
    ],
  },
  // A directory `index.md`: comark-content emits it as the section node *and* as its own first child.
  {
    title: 'Examples',
    path: '/examples',
    children: [
      { title: 'Examples', path: '/examples', description: 'All examples' },
      { title: 'Vue', path: '/examples/vue' },
    ],
  },
  // A section whose `index.md` sets `navigation: false`: the node is not a page of its own.
  {
    title: 'Plugins',
    path: '/plugins',
    page: false,
    children: [{ title: 'Emoji', path: '/plugins/emoji' }],
  },
] as unknown as NavigationItem[]

describe('collectDocsPages', () => {
  it('lists every page in sidebar order with its section', () => {
    expect(collectDocsPages(navigation)).toEqual([
      { path: '/overview', title: 'Overview', description: 'Top-level page', section: undefined },
      { path: '/getting-started/introduction', title: 'Introduction', description: 'Start here', section: 'Getting started' },
      { path: '/getting-started/installation', title: 'Installation', description: undefined, section: 'Getting started' },
      { path: '/examples', title: 'Examples', description: 'All examples', section: 'Examples' },
      { path: '/examples/vue', title: 'Vue', description: undefined, section: 'Examples' },
      { path: '/plugins/emoji', title: 'Emoji', description: undefined, section: 'Plugins' },
    ])
  })

  it('lists a directory index once, keeping the description', () => {
    const examples = collectDocsPages(navigation).filter((page) => page.path === '/examples')
    expect(examples).toEqual([{ path: '/examples', title: 'Examples', description: 'All examples', section: 'Examples' }])
  })

  it('puts a page hidden from the sidebar first in its section', () => {
    const pages = collectDocsPages(navigation, [{ path: '/plugins', title: 'Plugins', description: 'Extend it' }])
    expect(pages.map((page) => page.path)).toEqual([
      '/overview',
      '/getting-started/introduction',
      '/getting-started/installation',
      '/examples',
      '/examples/vue',
      '/plugins',
      '/plugins/emoji',
    ])
    expect(pages.find((page) => page.path === '/plugins')).toEqual({
      path: '/plugins',
      title: 'Plugins',
      description: 'Extend it',
      section: 'Plugins',
    })
  })

  it('appends a hidden page outside every section as a top-level page', () => {
    const pages = collectDocsPages(navigation, [{ path: '/legal', description: 'Terms' }])
    expect(pages.at(-1)).toEqual({ path: '/legal', title: 'legal', description: 'Terms', section: undefined })
  })

  it('skips the homepage and hidden pages already in the navigation', () => {
    const pages = collectDocsPages(navigation, [
      { path: '/', title: 'Home' },
      { path: '/examples/vue', title: 'Duplicate' },
    ])
    expect(pages).toHaveLength(6)
    expect(pages.find((page) => page.path === '/examples/vue')?.title).toBe('Vue')
  })

  it('matches a section on whole path segments only', () => {
    const pages = collectDocsPages(navigation, [{ path: '/plugins-legacy', title: 'Legacy' }])
    expect(pages.at(-1)?.section).toBeUndefined()
  })
})
