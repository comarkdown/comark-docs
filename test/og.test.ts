import { describe, expect, it } from 'vitest'
import { truncate, withAlpha } from '../app/utils/og'
import { breadcrumbListLd, jsonLd } from '../app/utils/json-ld'

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

describe('jsonLd', () => {
  it('produces parseable JSON with the same values', () => {
    expect(JSON.parse(jsonLd({ a: 1, b: 'x' }))).toEqual({ a: 1, b: 'x' })
  })

  it('escapes markup so a title cannot close the script element', () => {
    const output = jsonLd({ headline: 'Bad </script><img src=x>' })
    expect(output).not.toContain('</script>')
    expect(output).not.toContain('<')
    // Still decodes back to the original text.
    expect(JSON.parse(output).headline).toBe('Bad </script><img src=x>')
  })

  it('escapes ampersands (HTML entity contexts)', () => {
    const output = jsonLd({ name: 'A & B' })
    expect(output).not.toContain('&')
    expect(JSON.parse(output).name).toBe('A & B')
  })
})

describe('breadcrumbListLd', () => {
  it('emits position + item on every ListItem (Google requires item)', () => {
    expect(
      breadcrumbListLd([
        { name: 'Docs', item: 'https://comark.dev' },
        { name: 'Introduction', item: 'https://comark.dev/getting-started/introduction' },
      ])
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Docs', item: 'https://comark.dev' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Introduction',
          item: 'https://comark.dev/getting-started/introduction',
        },
      ],
    })
  })

  it('never omits item, even for a single root crumb', () => {
    const list = breadcrumbListLd([{ name: 'Docs', item: 'https://comark.dev/' }])
    for (const entry of list.itemListElement) {
      expect(entry).toHaveProperty('item')
      expect(typeof entry.item).toBe('string')
      expect(entry.item.length).toBeGreaterThan(0)
    }
  })
})
