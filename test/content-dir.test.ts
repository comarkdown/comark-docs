import { describe, expect, it } from 'vitest'
import { resolveContentDir } from '../utils/content-dir'

describe('resolveContentDir', () => {
  it('relativises against the git root for an app in a subdirectory', () => {
    expect(resolveContentDir({ rootDir: '/repo/docs', gitRoot: '/repo' })).toEqual({
      contentPath: '/repo/docs/content',
      contentDir: 'docs/content',
      source: 'git',
    })
  })

  it('handles an app at the repository root', () => {
    expect(resolveContentDir({ rootDir: '/repo', gitRoot: '/repo' })).toMatchObject({
      contentDir: 'content',
      source: 'git',
    })
  })

  it('handles a nested monorepo path', () => {
    expect(resolveContentDir({ rootDir: '/repo/apps/docs', gitRoot: '/repo' })).toMatchObject({
      contentDir: 'apps/docs/content',
    })
  })

  it('always reports the absolute path from rootDir, whatever the repo layout', () => {
    // Dev reads this one, which is why a wrong `contentDir` never shows up locally.
    for (const gitRoot of ['/repo', undefined]) {
      expect(resolveContentDir({ rootDir: '/repo/docs', gitRoot }).contentPath).toBe('/repo/docs/content')
    }
  })

  describe('without a git root', () => {
    it('marks the value as assumed rather than passing it off as derived', () => {
      // The regression this guards: silently yielding `content` for an app in a
      // subdirectory, which breaks every production GitHub read at once while dev
      // keeps working off the absolute path.
      const result = resolveContentDir({ rootDir: '/repo/docs' })
      expect(result.contentDir).toBe('content')
      expect(result.source).toBe('assumed')
    })

    it('is not marked assumed when the consumer said so explicitly', () => {
      expect(resolveContentDir({ rootDir: '/repo/docs', explicit: 'docs/content' })).toMatchObject({
        contentDir: 'docs/content',
        source: 'explicit',
      })
    })
  })

  describe('explicit values', () => {
    it('override a git root that would say otherwise', () => {
      expect(
        resolveContentDir({ rootDir: '/repo/docs', gitRoot: '/repo', explicit: 'elsewhere/md' })
      ).toMatchObject({ contentDir: 'elsewhere/md', source: 'explicit' })
    })

    it('are normalised so the value can be used as a path prefix', () => {
      // `contentPrefix()` appends a single slash, and slugFromPath slices by prefix
      // length — a stray leading or trailing slash silently breaks both.
      for (const input of ['/docs/content', 'docs/content/', '/docs/content/', 'docs//content']) {
        expect(resolveContentDir({ rootDir: '/repo/docs', explicit: input }).contentDir).toBe('docs/content')
      }
    })
  })
})
