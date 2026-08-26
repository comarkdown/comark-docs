import { defineAsyncComponent, hydrateOnVisible } from 'vue'

/**
 * `ProseImg` keeps its component (zoom dialog), but hydrates lazily: the chunk only downloads
 * and hydrates once an image scrolls into the viewport.
 */
const LazyProseImg = defineAsyncComponent({
  loader: () => import('@nuxt/ui/runtime/components/prose/Img.vue'),
  hydrate: hydrateOnVisible(),
})

/**
 * Component map for `<MarkdownDocument :components>` covering every tag the `elements` comark
 * plugin (`server/utils/comark-elements.ts`) rewrites to final HTML with baked-in classes.
 *
 * Mapping a tag to its own name short-circuits the renderer's `Prose*` lookup, so it emits a
 * plain element (`h('p')`) instead of mounting the global Nuxt UI component — removing per-node
 * component instances from SSR, hydration, and client-side navigation. Children still render
 * normally, so links and inline components inside these elements stay interactive.
 */
export const proseElements = {
  p: 'p',
  em: 'em',
  strong: 'strong',
  hr: 'hr',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  blockquote: 'blockquote',
  code: 'code',
  table: 'table',
  thead: 'thead',
  tbody: 'tbody',
  tr: 'tr',
  th: 'th',
  td: 'td',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  // Heading anchor links emitted by the plugin: rendered as plain `<a>` (a bare `a` tag would
  // resolve to the global `ProseA` and pick up content-link styling).
  'prose-anchor': 'a',
  img: LazyProseImg,
}
