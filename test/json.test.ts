import { describe, expect, it } from 'vitest'
import { hashManifestItem, stableStringify } from '../server/utils/json'
import type { ContentListFile } from 'comark-content'

describe('stableStringify', () => {
  it('sorts object keys so equal content compares equal', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }))
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
  })

  it('sorts nested keys too', () => {
    expect(stableStringify({ x: { d: 1, c: 2 } })).toBe('{"x":{"c":2,"d":1}}')
  })

  it('preserves array order — position is meaningful', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]')
  })

  it('handles primitives and null', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify(1)).toBe('1')
    expect(stableStringify('x')).toBe('"x"')
    expect(stableStringify(true)).toBe('true')
  })

  it('emits null for values JSON.stringify drops', () => {
    expect(stableStringify(undefined)).toBe('null')
  })
})

describe('hashManifestItem', () => {
  const item = (data: Record<string, unknown>) => ({ data }) as unknown as ContentListFile

  it('is stable across key order — this decides whether nav changed', () => {
    expect(hashManifestItem(item({ title: 'A', description: 'B' }))).toBe(
      hashManifestItem(item({ description: 'B', title: 'A' }))
    )
  })

  it('changes when visible metadata changes', () => {
    expect(hashManifestItem(item({ title: 'A' }))).not.toBe(hashManifestItem(item({ title: 'B' })))
  })

  it('treats a missing item and an empty one distinctly', () => {
    expect(hashManifestItem(undefined)).toBe('')
    expect(hashManifestItem(item({}))).toBe('{}')
  })
})
