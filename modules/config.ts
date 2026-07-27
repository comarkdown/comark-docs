import { existsSync, readdirSync } from 'node:fs'
import { defineNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'
import { join, relative } from 'pathe'
import { getGitBranch, getGitEnv, getGitRoot, getLocalGitInfo } from '../utils/git'
import { getPackageJsonMetadata, inferSiteURL } from '../utils/meta'

export interface ComarkDocsOptions {
  /**
   * ISR TTL (seconds) applied to content page HTML and the global content
   * indexes in production builds. `false` disables the generated route rules.
   * Consumers can still add or override rules per route in `routeRules`.
   * @default 300
   */
  isr?: number | false
  codeExplorer?: {
    /**
     * GitHub repos (`owner/name`) the `/api/code-explorer` endpoint is allowed
     * to read. Defaults to the configured content repo only.
     */
    allowRepos?: string[]
  }
}

export default defineNuxtModule<ComarkDocsOptions>({
  meta: {
    name: 'comark-docs/config',
    configKey: 'comarkDocs',
  },
  defaults: {
    isr: 300,
  },
  async setup(options, nuxt) {
    const rootDir = nuxt.options.rootDir
    // `site` comes from nuxt-site-config (via SEO modules) and `appConfig`
    // values are loosely typed until the consumer's app.config is generated,
    // so the seeding below goes through an untyped view of the options.
    const nuxtOptions = nuxt.options as typeof nuxt.options & {
      site?: { url?: string; name?: string }
      ui?: { content?: boolean; prose?: boolean }
      sitemap?: { sources?: string[]; exclude?: string[] }
      ogImage?: { zeroRuntime?: boolean }
      icon?: { provider?: string }
      appConfig: Record<string, any>
    }

    nuxtOptions.icon = defu(nuxtOptions.icon, { provider: 'iconify' }) as typeof nuxtOptions.icon

    // Render OG images at runtime (Satori) rather than prerendering them.
    nuxtOptions.ogImage = defu(nuxtOptions.ogImage, { zeroRuntime: false }) as typeof nuxtOptions.ogImage

    // @nuxt/ui content components + prose styles (this module runs before
    // @nuxt/ui's setup, see the layer's modules order).
    nuxtOptions.ui = defu(nuxtOptions.ui, { content: true, prose: true }) as typeof nuxtOptions.ui

    // Sitemap URLs come from the CMS navigation; previews are never indexed.
    nuxtOptions.sitemap = defu(nuxtOptions.sitemap, {
      sources: ['/api/__sitemap__/urls'],
      exclude: ['/tree/**', '/blob/**'],
    }) as typeof nuxtOptions.sitemap

    const url = inferSiteURL()
    const meta = await getPackageJsonMetadata(rootDir)
    const gitInfo = getLocalGitInfo(rootDir) || getGitEnv()
    const branch = getGitBranch(rootDir)
    const siteName = nuxtOptions.site?.name || meta.name || gitInfo?.name || ''

    // The consumer's content dir, expressed both absolutely (dev fs source)
    // and relative to the git root (GitHub source path, edit links, webhook).
    const repoRoot = getGitRoot(rootDir) || rootDir
    const contentPath = join(rootDir, 'content')
    const contentDir = relative(repoRoot, contentPath) || 'content'

    nuxtOptions.site = defu(nuxtOptions.site, {
      url,
      name: siteName,
    }) as typeof nuxtOptions.site

    nuxtOptions.appConfig.seo = defu(nuxtOptions.appConfig.seo, {
      siteName,
    })

    nuxtOptions.appConfig.header = defu(nuxtOptions.appConfig.header, {
      title: siteName,
    })

    nuxtOptions.appConfig.github = defu(nuxtOptions.appConfig.github, {
      owner: gitInfo?.owner || '',
      name: gitInfo?.name || '',
      url: gitInfo?.url || '',
      branch,
      contentDir,
    })

    // Server-side source configuration; every field is overridable through
    // `NUXT_DOCS_*` env vars, and secrets fall back to their historical env
    // names (GITHUB_TOKEN, WEBHOOK_SECRET, VERCEL_BYPASS_TOKEN) at runtime.
    nuxt.options.runtimeConfig.docs = defu(nuxt.options.runtimeConfig.docs, {
      githubToken: '',
      webhookSecret: '',
      bypassToken: '',
      github: {
        owner: gitInfo?.owner || '',
        repo: gitInfo?.name || '',
        branch,
      },
      contentDir,
      contentPath,
      repoRoot,
      codeExplorer: {
        allowRepos: options.codeExplorer?.allowRepos || [],
      },
    })

    const mcpOptions = (nuxt.options as { mcp?: { name?: string; version?: string } }).mcp
    ;(nuxt.options as { mcp?: { name?: string; version?: string } }).mcp = defu(mcpOptions, {
      name: `${siteName} Docs`,
      version: '1.0.0',
    })

    /*
     * ISR route rules (production builds only). Generated here rather than via
     * `$production` in the layer's nuxt.config so they merge deterministically
     * across npm-installed layers. Content-tree rules are derived from the
     * consumer's top-level content entries at build time — adding a new
     * top-level section requires a redeploy (as it always did).
     */
    if (!nuxt.options.dev && options.isr !== false) {
      const isr = options.isr!
      const rules: Record<string, Record<string, unknown>> = {
        '/': { isr },
        // Preview routes are served live (SSR) backed by Runtime Cache and
        // must never be indexed. `/blob/**` is immutable commit HTML.
        '/tree/**': { isr, robots: 'noindex, nofollow' },
        '/blob/**': { isr: true, robots: 'noindex, nofollow' },
        // Raw markdown mirrors every page for agents; keep them out of search indexes.
        '/raw/**': { isr, robots: 'noindex' },
        // Global content indexes, purged by the push webhook on content changes.
        '/llms.txt': { isr },
        '/llms-full.txt': { isr },
        '/rss.xml': { isr },
        // Fetched client-side on every page hydration (see app.vue); fully
        // parses every doc's body, so caching it avoids doing that per visit.
        '/api/cms/blob/*/search-sections': { isr: true },
        '/api/cms/tree/*/search-sections': { isr },
        '/api/cms/search-sections': { isr },
        '/api/code-explorer/**': { isr },
      }

      if (existsSync(contentPath)) {
        for (const entry of readdirSync(contentPath, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
          const slug = entry.name.replace(/^\d+\./, '').replace(/\.md$/i, '')
          if (!slug || slug === 'index') continue
          rules[`/${slug}`] = { isr }
          if (entry.isDirectory()) rules[`/${slug}/**`] = { isr }
        }
      }

      // Consumer-declared rules win per route.
      nuxt.options.routeRules = defu(nuxt.options.routeRules, rules) as typeof nuxt.options.routeRules
    }
  },
})
