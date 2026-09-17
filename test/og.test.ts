import { describe, expect, it } from 'vitest'
import { truncate, withAlpha } from '../app/utils/og'

describe('withAlpha', () => {
  it('expands 6-digit hex', () => {
    expect(withAlpha('#fafafa', 0.03)).toBe('rgba(250, 250, 250, 0.03)')
    expect(withAlpha('fafafa', 1)).toBe('rgba(250, 250, 250, 1)')
  })

  it('expands 3-digit shorthand', () => {
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
  })

  it('is case-insensitive', () => {
    expect(withAlpha('#FAFAFA', 1)).toBe('rgba(250, 250, 250, 1)')
  })

  it('falls back to transparent rather than emitting NaN', () => {
    // Satori paints `rgba(NaN, NaN, NaN, …)` as an opaque black block, which would
    // cover the whole OG image rather than degrade quietly.
    expect(withAlpha('oklch(0.7 0.1 200)', 0.03)).toBe('transparent')
    expect(withAlpha('rebeccapurple', 0.03)).toBe('transparent')
    expect(withAlpha('#ff', 0.03)).toBe('transparent')
    expect(withAlpha('', 0.03)).toBe('transparent')
  })
})

describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('short', 10)).toBe('short')
    expect(truncate('', 10)).toBe('')
  })

  it('cuts on a word boundary', () => {
    expect(truncate('the quick brown fox', 12)).toBe('the quick…')
  })

  it('hard-cuts when there is no boundary to use', () => {
    expect(truncate('a'.repeat(20), 10)).toBe(`${'a'.repeat(10)}…`)
  })
})
