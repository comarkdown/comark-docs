import { existsSync, readdirSync } from 'node:fs'
import { addServerPlugin, createResolver, defineNuxtModule, useLogger } from '@nuxt/kit'
import { defu } from 'defu'
import type { ModuleOptions as AgentDiscoveryOptions } from 'nuxt-agent-discovery'
import { getGitBranch, getGitEnv, getGitRoot, getLocalGitInfo } from '../../utils/git'
import { getPackageJsonMetadata, inferSiteURL, resolveContentDir } from './utils'

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
      mcp?: false | { name?: string; version?: string; route?: string }
      agentDiscovery?: AgentDiscoveryOptions
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

    // nuxt-schema-org attaches this to every page as the publisher, and to the `Article` on a docs page
    // as its author. Without it the graph has no identity at all and both fields are simply absent.
    // A site declaring its own `schemaOrg` in nuxt.config wins, the same as `site` above, and `false`
    // disables the module outright. Seeded through a view of the shape a config carries: the module's
    // own type is the resolved one, with every key required, which no partial can satisfy.
    const schemaOrgOptions = nuxt.options as { schemaOrg?: false | { identity?: Record<string, unknown> } }
    if (schemaOrgOptions.schemaOrg !== false) {
      const schemaOrg: { identity?: Record<string, unknown> } = schemaOrgOptions.schemaOrg || {}
      schemaOrg.identity = schemaOrg.identity || { type: 'Organization', name: siteName, url }
      schemaOrgOptions.schemaOrg = schemaOrg
    }

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

    // Extend Nuxt UI components to make them global and usable in markdown by consumers.
    nuxt.hook('components:extend', (components) => {
      const globalComponents = ['UButton', 'UPageHero']
      for (const component of globalComponents) {
        const entry = components.find((c) => c.pascalName === component)
        if (!entry) continue
        entry.global = true
      }
    })

    const rawMcpOptions = nuxtOptions.mcp
    const mcp = defu(rawMcpOptions || undefined, {
      name: `${siteName} Docs`,
      version: '1.0.0',
    })
    // `mcp: false` disables the toolkit, so the defaults must not be written back over it. The server
    // card below reads `rawMcpOptions` for the same reason.
    if (rawMcpOptions !== false) {
      nuxtOptions.mcp = mcp
    }

    // What nuxt-agent-discovery cannot know: the MCP server card describing the toolkit's endpoint under the
    // same name, and the deprecated `comarkDocs.skills` alias.
    if (options.skills) {
      logger.warn('`comarkDocs.skills` is deprecated. Move it to `agentDiscovery.skills` in nuxt.config.ts.')
    }
    nuxtOptions.agentDiscovery = defu(nuxtOptions.agentDiscovery, {
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

    // A `.vue` page has no document behind it, so negotiation would answer a markdown 404 on a route
    // browsers serve as HTML. Every page route outside the content catch-all is excluded, which is what a
    // consumer app's own pages need: without this each one has to be listed in `excludePrefixes` by hand.
    //
    // Routes are only known at `pages:extend`, by which point nuxt-agent-discovery has resolved its
    // options and Nitro has deep-copied `runtimeConfig`, so the list exists twice: the one the Vercel
    // preset reads when it writes the route table, and Nitro's own, which the server bundle serializes.
    // Both get the exclusions or the CDN stops routing these paths while the origin still negotiates
    // them, and an agent gets a markdown 404 on a page browsers render. `nitro:init` runs first, so the
    // copy is in hand by the time the pages are.
    let nitroExcludePrefixes: string[] | undefined
    nuxt.hook('nitro:init', (nitro) => {
      nitroExcludePrefixes = (nitro.options.runtimeConfig.agentDiscovery as { excludePrefixes?: string[] } | undefined)?.excludePrefixes
    })

    nuxt.hook('pages:extend', (pages) => {
      const excludePrefixes = (nuxt.options.runtimeConfig.agentDiscovery as { excludePrefixes?: string[] } | undefined)?.excludePrefixes
      if (!excludePrefixes) {
        return
      }

      const excluded: string[] = []
      for (const page of pages) {
        // Up to the first dynamic segment, so `/blog/[slug]` excludes `/blog/`. The content catch-all
        // (`/:slug(.*)*`) and the homepage both reduce to `/`, which stays negotiable.
        const dynamic = page.path.search(/[:*(]/)
        const prefix = dynamic === -1 ? page.path : page.path.slice(0, dynamic)
        if (prefix === '/' || excluded.includes(prefix)) {
          continue
        }
        excluded.push(prefix)
      }

      // `pages:extend` runs again on every page change in dev, so both lists are additive and deduped.
      for (const list of [excludePrefixes, nitroExcludePrefixes]) {
        if (list) {
          list.push(...excluded.filter(prefix => !list.includes(prefix)))
        }
      }

      if (excluded.length) {
        logger.info(`Vue pages excluded from markdown negotiation: ${excluded.join(', ')}`)
      }
    })

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
        '/blob/**': { isr: true, robots: 'noindex, nofollow' }, // Immutable since SHA-pinned
        '/pr/**': { isr, robots: 'noindex, nofollow' },
        // Raw markdown mirrors of every page, for agents.
        '/raw/**': { isr, robots: 'noindex' },
        // Global content indexes, purged by the push webhook on content changes.
        '/llms.txt': { isr },
        '/llms-full.txt': { isr },
        '/sitemap.md': { isr },
        '/rss.xml': { isr },
        // Prerendering would bake the build-time site URL and `docs.version` into it.
        '/openapi.json': { isr },
        // Scanned from the app at build time, so they only change on deploy.
        '/.well-known/skills': { isr: true },
        '/.well-known/skills/**': { isr: true },
        // Per-commit artifacts hydrating the client-side search database (see `useSearch`)
        '/api/content/blob/*/manifest.json': { isr: true }, // Immutable since SHA-pinned
        '/api/content/blob/*/snapshot/*': { isr: true }, // Immutable since SHA-pinned
        '/api/content/tree/*/manifest.json': { isr },
        '/api/content/tree/*/snapshot/*': { isr },
        // `/pr/*` follows the PR head, so it gets the short TTL like `/tree/*`.
        '/api/content/pr/*/manifest.json': { isr },
        '/api/content/pr/*/snapshot/*': { isr },
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

      // Remove once https://github.com/benjamincanac/nuxt-agent-discovery/pull/35 is released.
      nuxt.hook('modules:done', () => {
        nuxt.hook('prerender:routes', (ctx) => {
          for (const route of ctx.routes) {
            if (route.startsWith('/.well-known/skills')) ctx.routes.delete(route)
          }
        })
      })
    }
  },
})
