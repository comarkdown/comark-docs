import { defineComarkPlugin } from 'comark'
import type { ElementNode, Node } from 'comark'
import { createTV } from 'tailwind-variants'

/**
 * `elements` comark plugin.
 *
 * Rewrites static prose tags into final HTML elements at parse time, baking their Tailwind
 * classes into the tree. Paired with the `proseElements` map (`app/utils/prose-elements.ts`)
 * passed to `<MarkdownDocument :components>`, the Vue renderer then emits plain elements
 * instead of mounting a Nuxt UI `Prose*` component per node — removing thousands of component
 * instances from SSR, hydration, and client-side navigation on long docs pages. Children are
 * rendered normally, so links and inline components inside these elements stay interactive.
 *
 * Class strings mirror the compiled Nuxt UI v4 prose theme (`#build/ui/prose/*` — not
 * importable from nitro, where `#build` is forbidden) and are merged with the
 * `appConfig.ui.prose.*` overrides through `tailwind-variants`, exactly like the `Prose*`
 * components do (`tv({ extend: theme, ...appConfig.ui?.prose?.[tag] })`). Keep the literals in
 * sync when upgrading `@nuxt/ui`. Tailwind generates these classes because the Nuxt UI prose
 * theme stays registered (`ui: { prose: true }`) and `modules/css.ts` adds `server/` as a
 * Tailwind source.
 *
 * Interactive prose tags (`a`, `pre`, `img`, callouts, tabs, ...) are left untouched and keep
 * resolving to their components.
 */

/** Mirrors `#build/ui/prose/*` (Nuxt UI 4.11, `theme.transitions: true`). */
const theme = {
  p: { base: 'my-5 leading-7 text-pretty' },
  em: { base: '' },
  strong: { base: '' },
  hr: { base: 'border-t border-default my-12' },
  ul: { base: 'list-disc ps-6 my-5 marker:text-(--ui-border-accented)' },
  ol: { base: 'list-decimal ps-6 my-5 marker:text-muted' },
  li: { base: 'my-1.5 ps-1.5 leading-7 [&>ul]:my-0' },
  blockquote: { base: 'border-s-4 border-accented ps-4 italic' },
  code: {
    base: 'px-1.5 py-0.5 text-sm font-mono font-medium rounded-md inline-block',
    variants: {
      color: {
        primary: 'border border-primary/25 bg-primary/10 text-primary',
        secondary: 'border border-secondary/25 bg-secondary/10 text-secondary',
        success: 'border border-success/25 bg-success/10 text-success',
        info: 'border border-info/25 bg-info/10 text-info',
        warning: 'border border-warning/25 bg-warning/10 text-warning',
        error: 'border border-error/25 bg-error/10 text-error',
        neutral: 'border border-muted text-highlighted bg-muted',
      },
    },
    defaultVariants: { color: 'neutral' },
  },
  table: {
    slots: {
      root: 'relative my-5 overflow-x-auto rounded-md outline-primary/25 focus-visible:outline-3',
      base: 'w-full border-separate border-spacing-0 rounded-md',
    },
  },
  thead: { base: 'bg-muted' },
  tbody: { base: '' },
  tr: { base: '[&:first-child>th:first-child]:rounded-ss-md [&:first-child>th:last-child]:rounded-se-md [&:last-child>td:first-child]:rounded-es-md [&:last-child>td:last-child]:rounded-ee-md' },
  th: {
    base: 'py-3 px-4 font-semibold text-sm border-e border-b first:border-s border-t border-muted',
    variants: {
      align: { left: 'text-start', center: 'text-center', right: 'text-end' },
    },
    defaultVariants: { align: 'left' },
  },
  td: {
    base: 'py-3 px-4 text-sm align-top border-e border-b first:border-s border-muted [&_code]:text-xs/5 [&_p]:my-0 [&_p]:leading-6 [&_ul]:my-0 [&_ol]:my-0 [&_ul]:ps-4.5 [&_ol]:ps-4.5 [&_li]:leading-6 [&_li]:my-0.5',
    variants: {
      align: { left: 'text-start', center: 'text-center', right: 'text-end' },
    },
    defaultVariants: { align: 'left' },
  },
  h1: {
    slots: {
      base: 'text-4xl text-highlighted font-bold mb-8 scroll-mt-[calc(45px+var(--ui-header-height))] lg:scroll-mt-(--ui-header-height)',
      link: 'inline-flex items-center gap-2',
    },
  },
  h2: {
    slots: {
      base: [
        'relative text-2xl text-highlighted font-bold mt-12 mb-6 scroll-mt-[calc(48px+45px+var(--ui-header-height))] lg:scroll-mt-[calc(48px+var(--ui-header-height))] [&>a]:rounded-sm [&>a]:outline-primary/25 [&>a]:focus-visible:outline-3 [&>a>code]:border-dashed hover:[&>a>code]:border-primary hover:[&>a>code]:text-primary [&>a>code]:text-xl/7 [&>a>code]:font-bold',
        '[&>a>code]:transition-colors',
      ],
      leading: [
        'absolute -ms-8 top-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 p-1 bg-elevated group-hover:text-primary group-focus:text-primary rounded-md hidden lg:flex text-muted',
        'transition',
      ],
      leadingIcon: 'size-4 shrink-0',
      link: 'group lg:after:absolute lg:after:inset-y-0 lg:after:-inset-s-2 lg:after:w-2',
    },
  },
  h3: {
    slots: {
      base: [
        'relative text-xl text-highlighted font-bold mt-8 mb-3 scroll-mt-[calc(32px+45px+var(--ui-header-height))] lg:scroll-mt-[calc(32px+var(--ui-header-height))] [&>a]:rounded-sm [&>a]:outline-primary/25 [&>a]:focus-visible:outline-3 [&>a>code]:border-dashed hover:[&>a>code]:border-primary hover:[&>a>code]:text-primary [&>a>code]:text-lg/6 [&>a>code]:font-bold',
        '[&>a>code]:transition-colors',
      ],
      leading: [
        'absolute -ms-8 top-0.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 p-1 bg-elevated group-hover:text-primary group-focus:text-primary rounded-md hidden lg:flex text-muted',
        'transition',
      ],
      leadingIcon: 'size-4 shrink-0',
      link: 'group lg:after:absolute lg:after:inset-y-0 lg:after:-inset-s-2 lg:after:w-2',
    },
  },
  h4: {
    slots: {
      base: 'text-lg text-highlighted font-bold mt-6 mb-2 scroll-mt-[calc(24px+45px+var(--ui-header-height))] lg:scroll-mt-[calc(24px+var(--ui-header-height))] [&>a]:rounded-sm [&>a]:outline-primary/25 [&>a]:focus-visible:outline-3',
      link: '',
    },
  },
} as const

const SIMPLE_TAGS = ['p', 'em', 'strong', 'hr', 'ul', 'ol', 'li', 'blockquote', 'thead', 'tbody', 'tr'] as const
const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4'] as const

type SimpleTag = (typeof SIMPLE_TAGS)[number]
type HeadingTag = (typeof HEADING_TAGS)[number]
type SlotFn = (props?: Record<string, unknown>) => string

export interface ElementsOptions {
  /**
   * Which heading levels get an anchor link wrapping their content, like `ProseH1`-`ProseH4`.
   * Defaults to `runtimeConfig.public.mdc.headings.anchorLinks`.
   */
  anchorLinks?: boolean | Partial<Record<HeadingTag, boolean>>
}

interface Ui {
  simple: Record<SimpleTag, SlotFn>
  code: SlotFn
  cell: Record<'th' | 'td', SlotFn>
  table: { root: SlotFn, base: string }
  headings: Record<HeadingTag, { base: SlotFn, link: string, leading?: string, icon?: string, anchor: boolean }>
}

export const elements = defineComarkPlugin<ElementsOptions>((options = {}) => {
  // Built lazily on first parse: `useAppConfig()`/`useRuntimeConfig()` need the nitro runtime.
  let ui: Ui | undefined

  return {
    name: 'elements',
    post(state) {
      ui ??= buildUi(options)
      const nodes = state.tree.nodes
      for (let i = 0; i < nodes.length; i++) {
        nodes[i] = walk(nodes[i]!, ui)
      }
    },
  }
})

function buildUi(options: ElementsOptions): Ui {
  const appConfig = useAppConfig() as {
    ui?: { tv?: Parameters<typeof createTV>[0], prose?: Record<string, object> }
  }
  // Same construction as Nuxt UI's own `tv` util: `createTV(appConfig.ui?.tv)` +
  // `tv({ extend: theme, ...appConfig.ui?.prose?.[tag] })` per component.
  const tv = createTV(appConfig.ui?.tv as never)
  const prose = appConfig.ui?.prose ?? {}
  const component = (tag: keyof typeof theme) =>
    tv({ extend: theme[tag], ...(prose[tag] ?? {}) } as never) as unknown

  const { mdc } = (useRuntimeConfig().public ?? {}) as {
    mdc?: { headings?: { anchorLinks?: boolean | Partial<Record<HeadingTag, boolean>> } }
  }
  const anchorLinks = options.anchorLinks ?? mdc?.headings?.anchorLinks
  const anchorFor = (tag: HeadingTag) =>
    typeof anchorLinks === 'boolean' ? anchorLinks : anchorLinks?.[tag] ?? false

  const simple = Object.fromEntries(
    SIMPLE_TAGS.map((tag) => [tag, component(tag) as SlotFn])
  ) as Record<SimpleTag, SlotFn>

  const tableSlots = (component('table') as () => Record<'root' | 'base', SlotFn>)()

  const headings = {} as Ui['headings']
  for (const tag of HEADING_TAGS) {
    const slots = (component(tag) as () => Record<string, SlotFn | undefined>)()
    headings[tag] = {
      base: slots.base!,
      link: slots.link?.() ?? '',
      leading: slots.leading?.(),
      icon: slots.leadingIcon ? [slots.leadingIcon(), 'prose-anchor-icon'].filter(Boolean).join(' ') : undefined,
      anchor: anchorFor(tag),
    }
  }

  return {
    simple,
    code: component('code') as SlotFn,
    cell: { th: component('th') as SlotFn, td: component('td') as SlotFn },
    table: { root: tableSlots.root, base: tableSlots.base() },
    headings,
  }
}

function walk(node: Node, ui: Ui): Node {
  if (!Array.isArray(node)) return node
  const tag = node[0]
  // Skip comments and `<pre>` subtrees: rangi bakes its own highlight markup there and the
  // renderer already renders `<pre>` children as native elements.
  if (typeof tag !== 'string' || tag === 'pre') return node
  // Bottom-up: children first, so wrappers (table, heading anchors) never re-process themselves.
  for (let i = 2; i < node.length; i++) {
    node[i] = walk(node[i] as Node, ui)
  }
  return transform(node as ElementNode, ui) ?? node
}

/** Mutates `node` in place; returns a replacement node only when the tag needs a wrapper. */
function transform(node: ElementNode, ui: Ui): Node | undefined {
  const tag = node[0]
  const attrs = (node[1] ??= {})

  if (isIn(SIMPLE_TAGS, tag)) {
    setClass(attrs, ui.simple[tag]({ class: attrs.class }))
    return
  }

  if (tag === 'code') {
    const color = attrs.color
    delete attrs.color
    delete attrs.lang
    // ProseCode joins comma-separated classes (markdown attribute syntax) with spaces.
    const authorClass = typeof attrs.class === 'string' ? attrs.class.split(',').join(' ') : attrs.class
    setClass(attrs, ui.code({ color, class: authorClass }))
    return
  }

  if (tag === 'th' || tag === 'td') {
    const align = attrs.align
    delete attrs.align
    setClass(attrs, ui.cell[tag]({ align, class: attrs.class }))
    return
  }

  if (tag === 'table') {
    // ProseTable wraps the table in a scroll container div.
    const rootClass = ui.table.root({ class: attrs.class })
    setClass(attrs, ui.table.base)
    return ['div', { class: rootClass }, node]
  }

  if (isIn(HEADING_TAGS, tag)) {
    const heading = ui.headings[tag]
    const anchor = parseBool(attrs.anchor)
    delete attrs.anchor
    setClass(attrs, heading.base({ class: attrs.class }))
    const id = attrs.id
    if (!id || !(anchor ?? heading.anchor)) return
    // Wrap the heading's children in the anchor link, like ProseH1-ProseH4 do. The tag must NOT
    // be `a`: the renderer would resolve it to the global `ProseA` (content-link styling).
    // `proseElements` maps `prose-anchor` back to a plain `<a>`.
    const link: ElementNode = ['prose-anchor', { href: `#${id}` }, ...(node.splice(2) as Node[])]
    setClass(link[1], heading.link)
    if (heading.leading) {
      link.splice(2, 0, ['span', { class: heading.leading }, ['span', { 'class': heading.icon, 'aria-hidden': 'true' }]])
    }
    node.push(link)
    return
  }
}

function setClass(attrs: ElementNode[1], value: string | undefined) {
  if (value) attrs.class = value
  else delete attrs.class
}

function parseBool(value: unknown): boolean | undefined {
  if (value === true || value === '' || value === 'true') return true
  if (value === false || value === 'false') return false
  return undefined
}

function isIn<const T extends readonly string[]>(list: T, tag: string): tag is T[number] {
  return (list as readonly string[]).includes(tag)
}
