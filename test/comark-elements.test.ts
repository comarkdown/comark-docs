import { beforeAll, describe, expect, it } from 'vitest'
import { parseMarkdown } from 'comark'
import toc from 'comark/plugins/toc'
import type { ElementNode, Node } from 'comark'
import { elements } from '../server/utils/comark-elements'

// The plugin reads `useAppConfig()` / `useRuntimeConfig().public` lazily on first parse (nitro
// globals). Vitest isolates files, so overriding the setup.ts stubs here leaks nowhere.
const globals = globalThis as Record<string, unknown>

beforeAll(() => {
  globals.useAppConfig = () => ({
    ui: {
      prose: {
        p: { base: 'text-accented' },
        code: { base: '[font-variant-ligatures:none]' },
        h2: { slots: { base: 'font-medium' } },
        td: { base: 'bg-white dark:bg-muted/80' },
      },
    },
  })
  globals.useRuntimeConfig = () => ({
    public: { mdc: { headings: { anchorLinks: { h2: true, h3: true, h4: true } } } },
  })
})

async function parse(markdown: string): Promise<Node[]> {
  const doc = await parseMarkdown(markdown, { plugins: [toc({ depth: 3 }), elements()] })
  return doc.nodes
}

function el(node: Node | undefined): ElementNode {
  expect(Array.isArray(node)).toBe(true)
  return node as ElementNode
}

describe('elements comark plugin', () => {
  it('bakes theme classes into simple tags, merged with app.config.ui.prose overrides', async () => {
    const [p] = await parse('Hello world')
    expect(el(p)[0]).toBe('p')
    // theme base + app.config override, tailwind-merged
    expect(el(p)[1].class).toBe('my-5 leading-7 text-pretty text-accented')
  })

  it('leaves empty-theme tags (em, strong) without a class attribute', async () => {
    const [p] = await parse('*em* and **strong**')
    const em = el(el(p)[2] as Node)
    const strong = el(el(p)[4] as Node)
    expect(em[0]).toBe('em')
    expect(em[1].class).toBeUndefined()
    expect(strong[0]).toBe('strong')
    expect(strong[1].class).toBeUndefined()
  })

  it('preserves author classes from the attributes syntax', async () => {
    const [p] = await parse('**strong**{.text-red}')
    const strong = el(el(p)[2] as Node)
    expect(strong[1].class).toBe('text-red')
  })

  it('classes inline code with the neutral variant, dropping lang/color props', async () => {
    const [p] = await parse('Some `code`{lang="ts"} here')
    const code = el(el(p)[3] as Node)
    expect(code[0]).toBe('code')
    expect(code[1].class).toContain('font-mono')
    expect(code[1].class).toContain('border-muted text-highlighted bg-muted')
    expect(code[1].class).toContain('[font-variant-ligatures:none]')
    expect(code[1].lang).toBeUndefined()
    expect(code[1].color).toBeUndefined()
  })

  it('never touches <pre> subtrees (rangi owns them)', async () => {
    const nodes = await parse('```ts\nconst a = 1\n```')
    const pre = el(nodes[0])
    expect(pre[0]).toBe('pre')
    const code = el(pre[2] as Node)
    expect(code[0]).toBe('code')
    expect(code[1].class ?? '').not.toContain('px-1.5')
  })

  it('wraps tables in the ProseTable scroll container and classes cells', async () => {
    const [wrapper] = await parse('| A | B |\n|:--|--:|\n| x | y |')
    const div = el(wrapper)
    expect(div[0]).toBe('div')
    expect(div[1].class).toContain('overflow-x-auto')
    const table = el(div[2] as Node)
    expect(table[0]).toBe('table')
    expect(table[1].class).toContain('border-separate')
    const thead = el(table[2] as Node)
    expect(thead[1].class).toBe('bg-muted')
    const th = el(el(thead[2] as Node)[2] as Node)
    expect(th[0]).toBe('th')
    expect(th[1].class).toContain('text-start')
    const tbody = el(table[3] as Node)
    const td = el(el(tbody[2] as Node)[2] as Node)
    expect(td[0]).toBe('td')
    // default align variant + app.config override
    expect(td[1].class).toContain('text-start')
    expect(td[1].class).toContain('bg-white dark:bg-muted/80')
  })

  it('wraps h2 content in an anchor with the leading hash icon', async () => {
    const [h2] = await parse('## Hello World')
    const heading = el(h2)
    expect(heading[0]).toBe('h2')
    expect(heading[1].id).toBe('hello-world')
    // app.config `font-medium` override wins over the theme's `font-bold`
    expect(heading[1].class).toContain('font-medium')
    // standalone `font-bold` is merged away; only the `[&>a>code]:` variant keeps it
    expect(heading[1].class).not.toMatch(/(^| )font-bold( |$)/)
    const link = el(heading[2] as Node)
    // `prose-anchor` renders as a plain <a> via the proseElements map (a bare `a` tag would
    // resolve to ProseA)
    expect(link[0]).toBe('prose-anchor')
    expect(link[1].href).toBe('#hello-world')
    expect(link[1].class).toContain('group')
    const leading = el(link[2] as Node)
    expect(leading[0]).toBe('span')
    expect(leading[1].class).toContain('group-hover:opacity-100')
    const icon = el(leading[2] as Node)
    expect(icon[1].class).toContain('prose-anchor-icon')
    expect(icon[1].class).toContain('size-4')
    expect(link[3]).toBe('Hello World')
  })

  it('classes h1 without an anchor (anchorLinks.h1 unset)', async () => {
    const [h1] = await parse('# Title')
    const heading = el(h1)
    expect(heading[0]).toBe('h1')
    expect(heading[1].class).toContain('text-4xl')
    expect(heading[2]).toBe('Title')
  })

  it('respects an explicit anchor=false attribute', async () => {
    const [h2] = await parse('## Quiet {anchor=false}')
    const heading = el(h2)
    expect(heading[1].anchor).toBeUndefined()
    expect(heading[2]).toBe('Quiet')
  })

  it('classes lists and separators', async () => {
    const nodes = await parse('- one\n- two\n\n---')
    const ul = el(nodes[0])
    expect(ul[1].class).toContain('list-disc')
    const li = el(ul[2] as Node)
    expect(li[1].class).toContain('ps-1.5')
    const hr = el(nodes[1])
    expect(hr[0]).toBe('hr')
    expect(hr[1].class).toBe('border-t border-default my-12')
  })
})
