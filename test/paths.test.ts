import { afterEach, describe, expect, it } from 'vitest'
import { resetRuntimeConfig, setRuntimeConfig } from './setup'
import {
  contentPrefix,
  isContentMd,
  isNavConfig,
  pageUrlForPath,
  payloadUrlForRoute,
  rawUrlForPath,
  slugFromPath,
} from '../server/utils/paths'

afterEach(resetRuntimeConfig)

describe('contentPrefix', () => {
  it('normalises the trailing slash', () => {
    expect(contentPrefix()).toBe('content/')
    setRuntimeConfig({ contentDir: 'docs/content/' })
    expect(contentPrefix()).toBe('docs/content/')
  })
})

describe('isContentMd', () => {
  it('matches markdown under the content dir only', () => {
    expect(isContentMd('content/index.md')).toBe(true)
    expect(isContentMd('content/1.guide/2.intro.MD')).toBe(true)
    expect(isContentMd('content/.navigation.yml')).toBe(false)
    expect(isContentMd('README.md')).toBe(false)
    expect(isContentMd('other/content/x.md')).toBe(false)
  })

  it('follows a nested content dir', () => {
    setRuntimeConfig({ contentDir: 'docs/content' })
    expect(isContentMd('docs/content/x.md')).toBe(true)
    expect(isContentMd('content/x.md')).toBe(false)
  })
})

describe('isNavConfig', () => {
  it('matches the yml/yaml/json navigation files', () => {
    expect(isNavConfig('content/1.guide/.navigation.yml')).toBe(true)
    expect(isNavConfig('content/.navigation.yaml')).toBe(true)
    expect(isNavConfig('content/.navigation.json')).toBe(true)
    expect(isNavConfig('content/navigation.yml')).toBe(false)
    expect(isNavConfig('content/x.md')).toBe(false)
  })
})

describe('slugFromPath', () => {
  it('strips numeric ordering prefixes at every level', () => {
    expect(slugFromPath('content/1.getting-started/2.intro.md')).toEqual({
      isIndex: false,
      segments: ['getting-started', 'intro'],
    })
  })

  it('treats index files as their parent', () => {
    expect(slugFromPath('content/index.md')).toEqual({ isIndex: true, segments: [] })
    expect(slugFromPath('content/1.guide/index.md')).toEqual({ isIndex: true, segments: ['guide'] })
  })

  it('returns null for anything outside the content dir', () => {
    expect(slugFromPath('README.md')).toBeNull()
    expect(slugFromPath('content/.navigation.yml')).toBeNull()
  })
})

describe('pageUrlForPath', () => {
  it('maps content files to page routes', () => {
    expect(pageUrlForPath('content/index.md')).toBe('/')
    expect(pageUrlForPath('content/1.guide/index.md')).toBe('/guide')
    expect(pageUrlForPath('content/1.guide/2.intro.md')).toBe('/guide/intro')
    expect(pageUrlForPath('content/x.yml')).toBeNull()
  })
})

describe('rawUrlForPath', () => {
  it('maps content files to their raw markdown mirror', () => {
    expect(rawUrlForPath('content/index.md')).toBe('/raw/index.md')
    expect(rawUrlForPath('content/1.guide/2.intro.md')).toBe('/raw/guide/intro.md')
    expect(rawUrlForPath('content/1.guide/index.md')).toBe('/raw/guide.md')
    expect(rawUrlForPath('README.md')).toBeNull()
  })
})

describe('payloadUrlForRoute', () => {
  it('builds the payload URL the browser actually requests', () => {
    expect(payloadUrlForRoute('/')).toBe('/_payload.json')
    expect(payloadUrlForRoute('/guide/intro')).toBe('/guide/intro/_payload.json')
  })

  it('appends the build id when there is one', () => {
    // The webhook has to purge the exact keyed URL, not the bare path.
    expect(payloadUrlForRoute('/guide', 'abc123')).toBe('/guide/_payload.json?abc123')
    expect(payloadUrlForRoute('/', 'abc123')).toBe('/_payload.json?abc123')
  })
})
