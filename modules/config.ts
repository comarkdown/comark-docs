import { existsSync, readdirSync } from 'node:fs'
import { addServerPlugin, createResolver, defineNuxtModule, useLogger } from '@nuxt/kit'
import { defu } from 'defu'
import type { ModuleOptions as AgentDiscoveryOptions } from 'nuxt-agent-discovery'
import { resolveContentDir } from '../utils/content-dir'
import { getGitBranch, getGitEnv, getGitRoot, getLocalGitInfo } from '../utils/git'
import { LAYER_ICON_COLLECTIONS } from '../utils/icons'
import { getPackageJsonMetadata, inferSiteURL } from '../utils/meta'

const logger = useLogger('comark-docs')

export interface ComarkDocsOptions {
  /**
   * ISR TTL (seconds) for content page HTML and the global content indexes in production builds.
   * `false` disables the generated route rules; per-route rules in `routeRules` still apply.
   * @default 300
   */
  isr?: number | false
  /**
   * Content directory, relative to the **repository** root, not the app root. Derived by relativising
   * `<rootDir>/content` against the git root (app in `docs/` → `docs/content`). Set it when the build
   * has no `.git` to inspect and the app isn't at the repo root, or the GitHub source, edit links and
   * push webhook all resolve to a path that doesn't exist. Also settable as `NUXT_DOCS_CONTENT_DIR`.
   */
  contentDir?: string
  codeExplorer?: {
    /** GitHub repos (`owner/name`) `/api/code-explorer` may read. Defaults to the content repo only. */
    allowRepos?: string[]
  }
  /** @deprecated Use `agentDiscovery.skills` instead. */
  skills?: {
    dir?: string
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

    // Untyped view: `site` (nuxt-site-config) and `appConfig` aren't typed until app.config is generated.
    const nuxtOptions = nuxt.options as typeof nuxt.options & {
      site?: { url?: string; name?: string; description?: string }
      appConfig: Record<string, unknown>
    }

    // This module is listed first in the layer's nuxt.config, so what is seeded below (`site`, `mcp`,
    // `agentDiscovery`) is in place before the modules that read it at setup. Static defaults still belong in
    // nuxt.config; only build-time discoveries (git, env, the consumer's content dir) are resolved here.

    const url = inferSiteURL()
    const meta = await getPackageJsonMetadata(rootDir)
    const gitInfo = getLocalGitInfo(rootDir) || getGitEnv()
    const branch = getGitBranch(rootDir)
    const siteName = nuxtOptions.site?.name || meta.name || gitInfo?.name || ''

    // Absolute (dev fs source) and git-root-relative (GitHub source, edit links, webhook).
    const gitRoot = getGitRoot(rootDir)
    const repoRoot = gitRoot || rootDir
    const { contentPath, contentDir, source: contentDirSource } = resolveContentDir({
      rootDir,
      gitRoot,
      explicit: options.contentDir || process.env.NUXT_DOCS_CONTENT_DIR,
    })

    // Without a git root, an app that *is* the repo root is indistinguishable from one in a subdirectory,
    // and a wrong guess surfaces only in production (dev reads `contentPath` absolutely). Warn rather
    // than fail: the assumption holds for the common single-app repo.
    if (contentDirSource === 'assumed') {
      logger.warn(
        `No git repository found above ${rootDir}, so the content directory is assumed to be ` +
          `"content" at the repository root.\n` +
          `  If this app lives in a subdirectory of its repo, the GitHub content source, "Edit this page" links ` +
          `and the push webhook will all resolve to a path that does not exist in production.\n` +
          `  Set \`comarkDocs.contentDir\` (or NUXT_DOCS_CONTENT_DIR) to the repo-relative path, e.g. "docs/content".`
      )
    }

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

    // Every field is overridable through `NUXT_DOCS_*`; secrets also fall back to their historical env
    // names (GITHUB_TOKEN, WEBHOOK_SECRET, VERCEL_BYPASS_TOKEN) at runtime.
    nuxt.options.runtimeConfig.docs = defu(nuxt.options.runtimeConfig.docs, {
      githubToken: '',
      webhookSecret: '',
      bypassToken: '',
      // Feeds the OpenAPI document.
      version: meta.version || '0.0.0',
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

    // Drop layer Iconify prefixes from appConfig so @nuxt/icon keeps using the Iconify API (not `/api/_nuxt_icon`).
    nuxt.hook('modules:done', () => {
      const iconAppConfig = nuxtOptions.appConfig.icon as { customCollections?: string[] } | undefined
      if (!iconAppConfig?.customCollections?.length) return
      iconAppConfig.customCollections = iconAppConfig.customCollections.filter(
        (prefix) => !LAYER_ICON_COLLECTIONS.includes(prefix)
      )
    })


    // Extend Nuxt UI components to make them global and usable in markdown by consumers.
    nuxt.hook('components:extend', (components) => {
      const globalComponents = ['UButton', 'UPageHero']
      for (const component of globalComponents) {
        const entry = components.find((c) => c.pascalName === component)
        if (!entry) continue
        entry.global = true
      }
    })

    const rawMcpOptions = (nuxt.options as { mcp?: false | { name?: string; version?: string; route?: string } }).mcp
    const mcp = defu(rawMcpOptions || undefined, {
      name: `${siteName} Docs`,
      version: '1.0.0',
    })
    ;(nuxt.options as { mcp?: typeof mcp }).mcp = mcp

    // What nuxt-agent-discovery cannot know: the MCP server card describing the toolkit's endpoint under the
    // same name, and the deprecated `comarkDocs.skills` alias.
    if (options.skills) {
      logger.warn('`comarkDocs.skills` is deprecated. Move it to `agentDiscovery.skills` in nuxt.config.ts.')
    }
    const agentDiscovery = (nuxt.options as { agentDiscovery?: AgentDiscoveryOptions }).agentDiscovery
    ;(nuxt.options as { agentDiscovery?: AgentDiscoveryOptions }).agentDiscovery = defu(agentDiscovery, {
      discovery: {
        mcpServerCard:
          rawMcpOptions === false
            ? false
            : {
                endpoint: mcp.route || '/mcp',
                name: mcp.name,
                version: mcp.version,
                ...(nuxtOptions.site?.description ? { description: nuxtOptions.site.description } : {}),
              },
      },
      ...(options.skills ? { skills: options.skills } : {}),
    }) as AgentDiscoveryOptions

    // `llms.txt` sections come from the content navigation at request time. Registered here rather than
    // scanned from `server/plugins/` so the hook runs ahead of the nuxt-agent-discovery bridge (see the plugin).
    const { resolve } = createResolver(import.meta.url)
    addServerPlugin(resolve('./runtime/server/plugins/llms'))

    // ISR rules here (not `$production`) so they merge cleanly across npm layers; content sections need a redeploy.
    if (!nuxt.options.dev && options.isr !== false) {
      const isr = options.isr!
      const rules: Record<string, Record<string, unknown>> = {
        '/': { isr },
        // Layer-owned page (not derived from content/); still SSRs the content navigation shell.
        '/logos': { isr },
        // Previews are served live (SSR) off Runtime Cache; `/blob/**` is immutable commit HTML.
        // `/pr/**` follows the PR's head like `/tree/**` follows a branch, so it shares the short TTL.
        '/tree/**': { isr, robots: 'noindex, nofollow' },
        '/blob/**': { isr: true, robots: 'noindex, nofollow' },
        '/pr/**': { isr, robots: 'noindex, nofollow' },
        // Raw markdown mirrors of every page, for agents.
        '/raw/**': { isr, robots: 'noindex' },
        // Global content indexes, purged by the push webhook on content changes.
        '/llms.txt': { isr },
        '/llms-full.txt': { isr },
        '/sitemap.md': { isr },
        '/rss.xml': { isr },
        // Fetched on every page hydration (see app.vue) and parses every doc body, so cache it.
        '/api/content/blob/*/search-sections': { isr: true },
        '/api/content/tree/*/search-sections': { isr },
        '/api/content/pr/*/search-sections': { isr },
        '/api/content/search-sections': { isr },
        '/api/code-explorer/**': { isr },
        '/_payload.json': {
          headers: { 'cache-control': `public, max-age=${isr}, s-maxage=${isr}, stale-while-revalidate=60` },
        },
        '/**/_payload.json': {
          headers: { 'cache-control': `public, max-age=${isr}, s-maxage=${isr}, stale-while-revalidate=60` },
        },
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
