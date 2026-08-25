import { readFile, writeFile } from 'node:fs/promises'
import { defineNuxtModule, useLogger } from '@nuxt/kit'
import { resolve } from 'pathe'
import { buildMarkdownRewriteRoutes } from '../utils/markdown-rewrite'

const logger = useLogger('comark-docs')

/**
 * Serve raw markdown to agents on the *page* URLs: `Accept: text/markdown` (or a curl user-agent) on
 * `/getting-started/installation` 307-redirects to `/raw/getting-started/installation.md`, and `/`
 * to `/llms.txt`. Implemented as Vercel routing-layer redirects written into
 * `.vercel/output/config.json` after Nitro compiles. Redirects (not rewrites) are required: the ISR
 * cache is keyed on the request path only and ignores `Vary`, so a rewrite would let the HTML and
 * markdown variants of the same URL poison each other's cache entry.
 */
export default defineNuxtModule({
  meta: {
    name: 'comark-docs/markdown-rewrite',
  },
  setup(_options, nuxt) {
    nuxt.hooks.hook('nitro:init', (nitro) => {
      if (nitro.options.dev || !nitro.options.preset.includes('vercel')) return

      nitro.hooks.hook('compiled', async () => {
        const configPath = resolve(nitro.options.output.dir, 'config.json')
        const config = JSON.parse(await readFile(configPath, 'utf8'))

        const routes = buildMarkdownRewriteRoutes()
        config.routes.unshift(...routes)

        await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
        logger.info(`Injected ${routes.length} markdown content-negotiation routes into ${configPath}`)
      })
    })
  },
})
