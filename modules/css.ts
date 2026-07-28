import { addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { resolve } from 'pathe'

/**
 * Generates the Tailwind entry CSS.
 *
 * The theme itself is a plain hand-written stylesheet (`app/assets/css/theme.css`)
 * shared by every site — only the wiring around it is generated, and only
 * because it can't be written by hand:
 *
 * - Tailwind never auto-scans `node_modules`, so the layer's own components
 *   need an explicit `@source`. It has to be *absolute*: Vite flattens
 *   `@import`s before Tailwind resolves `@source`, so a relative one written
 *   inside theme.css would resolve against the entry file and silently point
 *   at the wrong directory. The absolute path differs between a local checkout
 *   and a pnpm-nested install, so it's only knowable at build time.
 * - `tailwindcss` / `@nuxt/ui` are the layer's dependencies, so they're
 *   resolved from here rather than from the consuming site.
 */
export default defineNuxtModule({
  meta: {
    name: 'comark-docs/css',
  },
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const tailwindPath = resolveModulePath('tailwindcss', { from: import.meta.url, conditions: ['style'] })
    const uiPath = resolveModulePath('@nuxt/ui', { from: import.meta.url, conditions: ['style'] })
    const themePath = resolver.resolve('../app/assets/css/theme.css')

    // The layer's components, then the site's own app/ and content/ — the
    // three places utility classes are written.
    const sources = [
      resolver.resolve('../app'),
      nuxt.options.srcDir,
      resolve(nuxt.options.rootDir, 'content'),
    ].map((dir) => `${dir}/**/*`.replace(/\\/g, '/'))

    const cssTemplate = addTemplate({
      filename: 'comark-docs.css',
      write: true,
      getContents: () =>
        [
          `@import ${JSON.stringify(tailwindPath)};`,
          `@import ${JSON.stringify(uiPath)};`,
          '',
          ...sources.map((source) => `@source ${JSON.stringify(source)};`),
          '',
          `@import ${JSON.stringify(themePath)};`,
          '',
        ].join('\n'),
    })

    nuxt.options.css.unshift(cssTemplate.dst)
  },
})
