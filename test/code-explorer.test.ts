import { describe, expect, it } from 'vitest'
import { buildTree, getExtension, languageFor, shouldExclude } from '../server/utils/code-explorer'

describe('getExtension', () => {
  it('takes the last segment, lowercased', () => {
    expect(getExtension('index.ts')).toBe('ts')
    expect(getExtension('Component.VUE')).toBe('vue')
    expect(getExtension('archive.tar.gz')).toBe('gz')
  })

  it('falls back to the whole name when there is no dot', () => {
    // Deliberate: it's what lets `Dockerfile` map to the `dockerfile` language.
    expect(getExtension('Dockerfile')).toBe('dockerfile')
    expect(getExtension('')).toBe('')
  })
})

describe('languageFor', () => {
  it('maps known extensions to a Shiki language', () => {
    expect(languageFor('src/index.ts')).toBe('typescript')
    expect(languageFor('src/App.vue')).toBe('vue')
    expect(languageFor('notes.md')).toBe('comark')
  })

  it('resolves extensionless files by name', () => {
    expect(languageFor('Dockerfile')).toBe('dockerfile')
  })

  it('falls back to plain text', () => {
    expect(languageFor('LICENSE')).toBe('text')
    expect(languageFor('weird.qqq')).toBe('text')
  })
})

describe('shouldExclude', () => {
  it('excludes binaries and fonts', () => {
    expect(shouldExclude('public/logo.png')).toBe(true)
    expect(shouldExclude('assets/font.woff2')).toBe(true)
  })

  it('excludes lockfiles and OS cruft', () => {
    expect(shouldExclude('pnpm-lock.yaml')).toBe(true)
    expect(shouldExclude('nested/pnpm-lock.yaml')).toBe(true)
    expect(shouldExclude('.DS_Store')).toBe(true)
  })

  it('excludes build output and dependency dirs at any depth', () => {
    expect(shouldExclude('node_modules/foo/index.js')).toBe(true)
    expect(shouldExclude('packages/a/node_modules/foo/index.js')).toBe(true)
    expect(shouldExclude('dist/index.js')).toBe(true)
    expect(shouldExclude('.nuxt/types/x.d.ts')).toBe(true)
  })

  it('keeps source files', () => {
    expect(shouldExclude('src/index.ts')).toBe(false)
    expect(shouldExclude('README.md')).toBe(false)
    // A file whose *name* contains an excluded dir name is not in that dir.
    expect(shouldExclude('src/node_modules_shim.ts')).toBe(false)
  })
})

describe('buildTree', () => {
  it('nests by path segment', () => {
    expect(buildTree(['a.ts', 'src/b.ts', 'src/deep/c.ts'])).toEqual([
      {
        filename: 'src',
        path: 'src',
        children: [
          { filename: 'deep', path: 'src/deep', children: [{ filename: 'c.ts', path: 'src/deep/c.ts' }] },
          { filename: 'b.ts', path: 'src/b.ts' },
        ],
      },
      { filename: 'a.ts', path: 'a.ts' },
    ])
  })

  it('puts directories before files, then sorts alphabetically', () => {
    const tree = buildTree(['z.ts', 'a.ts', 'b/one.ts', 'a/two.ts'])
    expect(tree.map((item) => item.filename)).toEqual(['a', 'b', 'a.ts', 'z.ts'])
  })

  it('reuses one node per directory', () => {
    const tree = buildTree(['src/a.ts', 'src/b.ts'])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.children).toHaveLength(2)
  })

  it('does not mutate the input array order', () => {
    const input = ['z.ts', 'a.ts']
    buildTree(input)
    expect(input).toEqual(['z.ts', 'a.ts'])
  })

  it('handles an empty list', () => {
    expect(buildTree([])).toEqual([])
  })
})
