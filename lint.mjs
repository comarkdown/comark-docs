// @ts-check
// A comark-linter config for sites extending this layer. Run `lint-comark` from the site's root:
//   lint-comark "content/**/*.md" -c comark-lint.config.ts
// with a config that re-exports it: `export { default } from 'comark-docs/lint.mjs'`.
// Plain JavaScript, since Node won't strip types from a file in node_modules.
import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { comarkContent } from 'comark-content'
import fs from 'comark-content/sources/fs'
import emoji from 'comark/plugins/emoji'

const kebab = (/** @type {string} */ name) => name.replace(/[A-Z]/g, (c, i) => (i ? '-' : '') + c.toLowerCase())

/** The kebab-case names of the components in a folder and its subfolders. */
function componentsIn(/** @type {string} */ dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map(file => basename(file).match(/^(\w+)\.(vue|ts)$/)?.[1])
    .filter(name => name !== undefined)
    .map(name => kebab(name))
}

const nuxtUi = dirname(fileURLToPath(import.meta.resolve('@nuxt/ui/components/Button.vue')))

// What Markdown resolves by name: the global components of `components/prose/`, which Nuxt UI
// registers for its prose and @comark/nuxt for this layer and the site, plus every Nuxt UI
// component with the `u-` prefix, such as `::u-button`.
const components = [
  ...componentsIn(`${nuxtUi}/prose`),
  ...componentsIn(fileURLToPath(new URL('app/components/prose', import.meta.url))),
  ...componentsIn('app/components/prose'),
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
