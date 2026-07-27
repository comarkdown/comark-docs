import { existsSync } from 'node:fs'
import { addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { resolveModulePath } from 'exsolve'
import { resolve } from 'pathe'

/**
 * Generates the Tailwind entry CSS. The layer can't ship a plain
 * `css: ['~/assets/css/main.css']` entry: `~` resolves to the consumer's
 * srcDir, and Tailwind's automatic source detection never scans files under
 * node_modules, so the layer's own components and the consumer's content dir
 * must be declared as explicit absolute `@source` entries.
 */
export default defineNuxtModule({
  meta: {
    name: 'comark-docs/css',
  },
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const contentDir = resolve(nuxt.options.rootDir, 'content')
    const appConfigPath = resolve(nuxt.options.rootDir, 'app.config.ts')
    const tailwindPath = resolveModulePath('tailwindcss', { from: import.meta.url, conditions: ['style'] })
    const uiPath = resolveModulePath('@nuxt/ui', { from: import.meta.url, conditions: ['style'] })
    const layerAppDir = resolver.resolve('../app')
    const themePath = resolver.resolve('../app/assets/css/theme.css')

    // Consumer extension point: app/assets/css/main.css, imported last so it
    // can override the layer theme.
    let userCssPath: string | null = resolve(nuxt.options.srcDir, 'assets/css/main.css')
    if (!existsSync(userCssPath)) userCssPath = null

    const sources = [
      `${contentDir}/**/*`,
      `${layerAppDir}/**/*`,
      `${nuxt.options.srcDir}/**/*`,
      appConfigPath,
    ]

    const cssTemplate = addTemplate({
      filename: 'comark-docs.css',
      write: true,
      getContents: () =>
        [
          `@import ${JSON.stringify(tailwindPath)};`,
          `@import ${JSON.stringify(uiPath)};`,
          '',
          ...sources.map((source) => `@source ${JSON.stringify(source.replace(/\\/g, '/'))};`),
          '',
          `@import ${JSON.stringify(themePath)};`,
          ...(userCssPath ? [`@import ${JSON.stringify(userCssPath)};`] : []),
          '',
        ].join('\n'),
    })

    nuxt.options.css.unshift(cssTemplate.dst)
  },
})
