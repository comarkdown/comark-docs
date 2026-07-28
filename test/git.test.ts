import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseGitRemote } from '../utils/git'
import { inferSiteURL } from '../utils/meta'

describe('parseGitRemote', () => {
  it('parses SSH remotes', () => {
    expect(parseGitRemote('git@github.com:comarkdown/comark-docs.git')).toEqual({
      owner: 'comarkdown',
      name: 'comark-docs',
      url: 'https://github.com/comarkdown/comark-docs',
    })
  })

  it('parses HTTPS remotes, with and without .git', () => {
    expect(parseGitRemote('https://github.com/comarkdown/comark-docs.git')?.name).toBe('comark-docs')
    expect(parseGitRemote('https://github.com/comarkdown/comark-docs')?.name).toBe('comark-docs')
  })

  it('keeps a non-GitHub host', () => {
    expect(parseGitRemote('git@gitlab.com:group/project.git')?.url).toBe('https://gitlab.com/group/project')
  })

  it('trims surrounding whitespace from git output', () => {
    expect(parseGitRemote('  git@github.com:o/n.git\n')?.owner).toBe('o')
  })

  it('returns undefined for anything unrecognised', () => {
    expect(parseGitRemote('')).toBeUndefined()
    expect(parseGitRemote('not-a-remote')).toBeUndefined()
    expect(parseGitRemote('/local/path/repo')).toBeUndefined()
  })
})

describe('inferSiteURL', () => {
  const keys = [
    'NUXT_PUBLIC_SITE_URL',
    'NUXT_SITE_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_BRANCH_URL',
    'VERCEL_URL',
    'URL',
    'CI_PAGES_URL',
    'CF_PAGES_URL',
  ]
  let saved: Record<string, string | undefined>

  // `Reflect.deleteProperty` rather than `delete process.env[key]`: same effect,
  // without tripping `no-dynamic-delete`.
  const unset = (key: string) => Reflect.deleteProperty(process.env, key)

  beforeEach(() => {
    saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    for (const key of keys) unset(key)
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) unset(key)
      else process.env[key] = value
    }
  })

  it('returns undefined when nothing is set', () => {
    expect(inferSiteURL()).toBeUndefined()
  })

  it('adds https to a bare Vercel host', () => {
    process.env.VERCEL_URL = 'my-app-abc123.vercel.app'
    expect(inferSiteURL()).toBe('https://my-app-abc123.vercel.app')
  })

  it('prefers the explicit override over the platform value', () => {
    process.env.VERCEL_URL = 'my-app-abc123.vercel.app'
    process.env.NUXT_PUBLIC_SITE_URL = 'https://docs.example.com'
    expect(inferSiteURL()).toBe('https://docs.example.com')
  })

  it('prefers the production URL over the per-branch one', () => {
    process.env.VERCEL_BRANCH_URL = 'branch.vercel.app'
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'docs.comark.dev'
    expect(inferSiteURL()).toBe('https://docs.comark.dev')
  })
})
