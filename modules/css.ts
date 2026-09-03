import { addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { resolve } from 'pathe'

/**
 * Generates the Tailwind entry CSS; the theme itself is hand-written (`app/assets/css/theme.css`).
 * Tailwind never auto-scans `node_modules`, so the layer's components need an explicit `@source` — and
 * an absolute one: Vite flattens `@import`s before Tailwind resolves `@source`, so a relative path
 * written inside theme.css would resolve against the entry file. That absolute path differs between a
 * local checkout and a pnpm-nested install, so it's only knowable at build time. `tailwindcss` /
 * `@nuxt/ui` are the layer's own dependencies, so they resolve from here, not from the consuming site.
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

    const sources = [
      resolver.resolve('../app'),
      // The `elements` comark plugin bakes prose classes into parsed trees at runtime; scanning
      // `server/` keeps those literals covered even if they drift from the Nuxt UI prose theme.
      resolver.resolve('../server'),
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
