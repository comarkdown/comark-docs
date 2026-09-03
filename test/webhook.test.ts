import { describe, expect, it } from 'vitest'
import type { ContentListFile } from 'comark-content'
import type { GitHubCommit } from '../server/utils/github'
import { changesForPush, diffContent, indexByFileKey, payloadUrlForPage } from '../server/utils/webhook'
import { rawUrlForPage } from '../server/utils/markdown'

const commit = (partial: GitHubCommit): GitHubCommit => partial

describe('changesForPush', () => {
  it('classifies added/modified/removed content files, keyed by their manifest key', () => {
    const commits = [
      commit({
        added: ['content/1.guide/2.intro.md'],
        modified: ['content/index.md'],
        removed: ['content/old.md'],
      }),
    ]
    expect(changesForPush('content', commits)).toEqual({
      upserted: ['default/1.guide/2.intro.md', 'default/index.md'],
      removed: ['default/old.md'],
      navTouched: false,
    })
  })

  it('ignores files outside the content dir', () => {
    expect(changesForPush('content', [commit({ modified: ['README.md', 'other/content/x.md'] })])).toEqual({
      upserted: [],
      removed: [],
      navTouched: false,
    })
  })

  it('follows a nested content dir', () => {
    expect(changesForPush('docs/content', [commit({ modified: ['docs/content/x.md'] })])).toEqual({
      upserted: ['default/x.md'],
      removed: [],
      navTouched: false,
    })
  })

  it('covers every parser extension, not just markdown', () => {
    const commits = [commit({ added: ['content/data.yml', 'content/data.yaml', 'content/data.json'] })]
    expect(changesForPush('content', commits).upserted).toEqual([
      'default/data.yml',
      'default/data.yaml',
      'default/data.json',
    ])
  })

  it('flags a navigation config file instead of collecting it', () => {
    const commits = [commit({ modified: ['content/1.guide/.navigation.yml'] })]
    expect(changesForPush('content', commits)).toEqual({ upserted: [], removed: [], navTouched: true })
  })

  it('treats a path removed and re-added in the same push as an upsert', () => {
    const commits = [commit({ added: ['content/index.md'], removed: ['content/index.md'] })]
    expect(changesForPush('content', commits)).toEqual({
      upserted: ['default/index.md'],
      removed: [],
      navTouched: false,
    })
  })
})

describe('payloadUrlForPage', () => {
  it('matches the `_b` query param Nuxt requests (`nuxt/dist/app/composables/payload.js`)', () => {
    expect(payloadUrlForPage('/')).toBe('/_payload.json')
    expect(payloadUrlForPage('/guide/intro')).toBe('/guide/intro/_payload.json')
    expect(payloadUrlForPage('/guide', 'abc123')).toBe('/guide/_payload.json?_b=abc123')
    expect(payloadUrlForPage('/', 'abc123')).toBe('/_payload.json?_b=abc123')
  })
})

describe('rawUrlForPage', () => {
  it('is the exact inverse of pagePathFromRawSlug', () => {
    expect(rawUrlForPage('/')).toBe('/raw/index.md')
    expect(rawUrlForPage('/guide/intro')).toBe('/raw/guide/intro.md')
  })
})

describe('indexByFileKey', () => {
  it('maps a manifest key back to its page path', () => {
    const items: Record<string, ContentListFile> = {
      '/guide/intro': { path: '/guide/intro', data: {}, meta: { key: 'content/1.guide/2.intro.md' } } as never,
    }
    expect(indexByFileKey(items).get('content/1.guide/2.intro.md')).toBe('/guide/intro')
  })
})

describe('diffContent', () => {
  const file = (path: string, key: string, data: Record<string, unknown> = {}): ContentListFile =>
    ({ path, data, meta: { key } }) as never

  it('resolves upserted/removed manifest keys to page paths', () => {
    const before = { '/old': file('/old', 'content/old.md') }
    const after = { '/guide/intro': file('/guide/intro', 'content/1.guide/2.intro.md') }
    const changes = { upserted: ['content/1.guide/2.intro.md'], removed: ['content/old.md'], navTouched: false }
    expect(diffContent(changes, before, after).pagePaths.sort()).toEqual(['/guide/intro', '/old'])
  })

  it('flags navChanged when a page is added or removed', () => {
    const before = { '/a': file('/a', 'content/a.md') }
    const after = { '/a': file('/a', 'content/a.md'), '/b': file('/b', 'content/b.md') }
    expect(diffContent({ upserted: [], removed: [], navTouched: false }, before, after).navChanged).toBe(true)
  })

  it('flags navChanged when listing data changes, even with the same page set', () => {
    const before = { '/a': file('/a', 'content/a.md', { title: 'A' }) }
    const after = { '/a': file('/a', 'content/a.md', { title: 'B' }) }
    expect(diffContent({ upserted: [], removed: [], navTouched: false }, before, after).navChanged).toBe(true)
  })

  it('does not flag navChanged when nothing listing-relevant moved', () => {
    const before = { '/a': file('/a', 'content/a.md', { title: 'A' }) }
    const after = { '/a': file('/a', 'content/a.md', { title: 'A' }) }
    expect(diffContent({ upserted: ['content/a.md'], removed: [], navTouched: false }, before, after).navChanged).toBe(
      false
    )
  })
})
