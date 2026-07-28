import { describe, expect, it } from 'vitest'
import { prefixLink, prefixNavigation, prefixTreeLinks } from '../app/utils/routing'

describe('prefixLink', () => {
  it('prefixes internal links', () => {
    expect(prefixLink('/guide', '/tree/dev')).toBe('/tree/dev/guide')
  })

  it('leaves external and relative links alone', () => {
    expect(prefixLink('https://example.com', '/tree/dev')).toBe('https://example.com')
    expect(prefixLink('#anchor', '/tree/dev')).toBe('#anchor')
    expect(prefixLink('relative', '/tree/dev')).toBe('relative')
  })

  it('is identity in production, where base is empty', () => {
    expect(prefixLink('/guide', '')).toBe('/guide')
  })
})

describe('prefixTreeLinks', () => {
  it('rewrites to/href on nested nodes', () => {
    const nodes = [['p', {}, ['a', { href: '/guide' }, 'Guide']]]
    expect(prefixTreeLinks(nodes, '/blob/abc123')).toEqual([
      ['p', {}, ['a', { href: '/blob/abc123/guide' }, 'Guide']],
    ])
  })

  it('rewrites both attribute names', () => {
    expect(prefixTreeLinks([['ULink', { to: '/a' }]], '/tree/dev')).toEqual([['ULink', { to: '/tree/dev/a' }]])
  })

  it('leaves external links and non-string values alone', () => {
    const nodes = [
      ['a', { href: 'https://example.com' }],
      ['a', { href: null }],
    ]
    expect(prefixTreeLinks(nodes, '/tree/dev')).toEqual(nodes)
  })

  it('returns the same array untouched when base is empty', () => {
    const nodes = [['a', { href: '/guide' }]]
    expect(prefixTreeLinks(nodes, '')).toBe(nodes)
  })

  it('does not mutate the input tree', () => {
    const attrs = { href: '/guide' }
    prefixTreeLinks([['a', attrs]], '/tree/dev')
    expect(attrs.href).toBe('/guide')
  })

  it('passes through non-array nodes (text)', () => {
    expect(prefixTreeLinks(['plain text'], '/tree/dev')).toEqual(['plain text'])
  })
})

describe('prefixNavigation', () => {
  it('prefixes every path, recursively', () => {
    expect(
      prefixNavigation([{ path: '/guide', children: [{ path: '/guide/intro' }] }], '/tree/dev')
    ).toEqual([{ path: '/tree/dev/guide', children: [{ path: '/tree/dev/guide/intro' }] }])
  })

  it('leaves an empty children array off rather than emitting it', () => {
    expect(prefixNavigation([{ path: '/a', children: [] }], '/tree/dev')).toEqual([
      { path: '/tree/dev/a', children: [] },
    ])
  })

  it('returns the same array untouched when base is empty', () => {
    const items = [{ path: '/a' }]
    expect(prefixNavigation(items, '')).toBe(items)
  })

  it('does not mutate the input', () => {
    const items = [{ path: '/a', children: [{ path: '/a/b' }] }]
    prefixNavigation(items, '/tree/dev')
    expect(items[0]!.path).toBe('/a')
    expect(items[0]!.children![0]!.path).toBe('/a/b')
  })
})
