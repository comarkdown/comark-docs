// @ts-check
// A comark-linter config for sites extending this layer. Run `comark-lint` from the site's root:
//   comark-lint "content/**/*.md"
// next to a `comark-lint.config.ts` that re-exports it: `export { default } from 'comark-docs/lint.mjs'`.
// Plain JavaScript, since Node won't strip types from a file in node_modules.
import { readdirSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { comarkContent } from 'comark-content'
import fs from 'comark-content/sources/fs'
import emoji from 'comark/plugins/emoji'

const kebab = (/** @type {string} */ name) => name.replace(/[A-Z]/g, (c, i) => (i ? '-' : '') + c.toLowerCase())

/** The kebab-case names of the components in a folder and its subfolders. */
function componentsIn(/** @type {string} */ dir) {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map(file => basename(file).match(/^(\w+)\.(vue|ts)$/)?.[1])
    .filter(name => name !== undefined)
    .map(name => kebab(name))
}

const nuxtUi = dirname(fileURLToPath(import.meta.resolve('@nuxt/ui/components/Button.vue')))

// What the pages pass to `MarkdownDocument`: Nuxt UI's prose components and the layer's
// `app/components/content/`, plus every Nuxt UI component with the `u-` prefix, such as `::u-button`.
const components = [
  ...componentsIn(`${nuxtUi}/prose`),
  ...componentsIn(fileURLToPath(new URL('app/components/content', import.meta.url))),
  ...readdirSync(nuxtUi).filter(file => file.endsWith('.vue')).map(file => `u-${kebab(basename(file, '.vue'))}`),
]

// Each page's URL, mapped to its file the way comark-content derives the URL from it.
const pages = new Map()
for (const item of await comarkContent({ source: fs('content') }).list()) {
  pages.set(item.path, `content/${item.meta.stem}${item.meta.extension}`)
}

/** @type {import('comark-linter').Config} */
export default {
  components,
  // The layer parses `:smile:` shortcodes as emoji, not as inline components.
  plugins: [emoji()],
  links: {
    // Guides link a local dev server on purpose, for readers running it.
    skip: ['localhost'],
    routes: path => pages.get(path.replace(/\/$/, '') || '/'),
  },
}
