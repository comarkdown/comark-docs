import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { components } from '../utils/markdown-components.mjs'

const kebab = (name: string) => name.replace(/[A-Z]/g, (c, i) => (i ? '-' : '') + c.toLowerCase())

// Sites lint with this list, so a component a page renders but the list misses lints as unknown.
it('lists every component the pages render from Markdown', () => {
  const rendered = ['app/pages/[...slug].vue', 'app/pages/index.vue'].flatMap((page) => {
    const map = readFileSync(page, 'utf8').match(/const \w*omponents = \{([^}]*)\}/)![1]!
    return map.split(/[\s,]+/).filter(Boolean).map(name => kebab(name.replace(/^Prose/, '')))
  })
  expect([...components].sort()).toEqual([...rendered].sort())
})
