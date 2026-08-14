import { existsSync, readdirSync } from 'node:fs'
import { defineNuxtModule, useLogger } from '@nuxt/kit'
import { defu } from 'defu'
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
  skills?: {
    /**
     * Directory, relative to the app root, scanned at build time for Agent Skills.
     * Each subdirectory with a `SKILL.md` is published at `/.well-known/skills/`.
     * @default 'skills'
     */
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
      site?: { url?: string; name?: string }
      appConfig: Record<string, unknown>
    }

    // Static module defaults live in the layer's nuxt.config: seeding them here makes module order
    // load-bearing. Only build-time discoveries (git, env, the consumer's content dir) belong below.

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

    const mcpOptions = (nuxt.options as { mcp?: { name?: string; version?: string } }).mcp
    ;(nuxt.options as { mcp?: { name?: string; version?: string } }).mcp = defu(mcpOptions, {
      name: `${siteName} Docs`,
      version: '1.0.0',
    })

    // ISR rules here (not `$production`) so they merge cleanly across npm layers; content sections need a redeploy.
    if (!nuxt.options.dev && options.isr !== false) {
      const isr = options.isr!
      const rules: Record<string, Record<string, unknown>> = {
        '/': { isr },
        // Layer-owned page (not derived from content/); still SSRs the content navigation shell.
        '/logos': { isr },
        // Previews are served live (SSR) off Runtime Cache; `/blob/**` is immutable commit HTML.
        '/tree/**': { isr, robots: 'noindex, nofollow' },
        '/blob/**': { isr: true, robots: 'noindex, nofollow' }, // Immutable since SHA-pinned
        // Raw markdown mirrors of every page, for agents.
        '/raw/**': { isr, robots: 'noindex' },
        // Global content indexes, purged by the push webhook on content changes.
        '/llms.txt': { isr },
        '/llms-full.txt': { isr },
        '/rss.xml': { isr },
        // Per-commit artifacts hydrating the client-side search database (see `useSearch`)
        '/api/content/blob/*/manifest.json': { isr: true }, // Immutable since SHA-pinned
        '/api/content/blob/*/snapshot/*': { isr: true }, // Immutable since SHA-pinned
        '/api/content/tree/*/manifest.json': { isr },
        '/api/content/tree/*/snapshot/*': { isr },
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
