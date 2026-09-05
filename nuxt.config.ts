import { resolveModulePath } from 'exsolve'
import { defineNuxtConfig } from 'nuxt/config'
import { createResolver } from 'nuxt/kit'
import { layerIconCollections } from './utils/icons'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  compatibilityDate: '2026-06-09',
  devtools: { enabled: true },
  modules: [
    // The layer's own modules go first: what config.ts seeds (`site`, `mcp`, `agentDiscovery`) has to be in
    // place before the modules that read it at setup. Nuxt queues a layer's `modules` before its scanned
    // `modules/` dir and dedupes by file path, so the extension is what keeps these from installing twice.
    resolve('./modules/config.ts'),
    resolve('./modules/css.ts'),
    '@nuxt/ui',
    '@comark/nuxt',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    'nuxt-seo-utils',
    'nuxt-og-image',
    '@nuxtjs/mcp-toolkit',
    'nuxt-llms',
    'nuxt-agent-discovery',
  ],
  ignore: ['content/**'],
  ui: { content: true, prose: true },
  sitemap: {
    // Content is the source of truth: the app sources would only add the prerendered skill files.
    excludeAppSources: true,
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/tree/**', '/blob/**', '/pr/**'],
  },
  // Markdown for agents: content negotiation on every page, `/raw/**`, the `llms.txt` bridge, `sitemap.md`,
  // the api-catalog, the MCP server card and Agent Skills. Every page negotiates, since the content sections
  // are only known at request time. The server card is seeded in modules/config.ts, where the site name is.
  agentDiscovery: {
    // comark sites build their own content instance, so the adapter is a file rather than auto-detected.
    source: resolve('./server/utils/agent-source.ts'),
    // Versioned previews serve HTML only, and `/logos` is a layer page with no document behind it.
    excludePrefixes: { extend: ['/tree/', '/blob/', '/pr/', '/logos'] },
    discovery: {
      // `server/routes/openapi.json.get.ts`, the one document the module cannot know about.
      links: [
        { href: '/openapi.json', rel: 'service-desc', type: 'application/vnd.oai.openapi+json', title: 'OpenAPI document: every route this site serves to agents', anchor: '/' },
        { href: '/rss.xml', rel: 'alternate', type: 'application/rss+xml', title: 'RSS feed of the documentation' },
      ],
    },
  },
  ogImage: { zeroRuntime: false },
  icon: {
    provider: 'iconify',
    customCollections: layerIconCollections() as never,
    clientBundle: {
      scan: true,
      includeCustomCollections: false
    },
  },
  vite: {
    resolve: {
      alias: { 'beautiful-mermaid': resolveModulePath('beautiful-mermaid', { from: import.meta.url }) },
    },
    optimizeDeps: {
      include: [
        'beautiful-mermaid',
        'comark-docs > ai > @ai-sdk/gateway > @vercel/oidc',
        'js-yaml'
      ],
    },
  },
  nitro: {
    routeRules: {
      '/llms.txt': { prerender: false },
      '/llms-full.txt': { prerender: false },
      '/openapi.json': { prerender: true },
    },
    // MCP tool handlers reach the request through `useEvent()`.
    experimental: { asyncContext: true },
    vercel: {
      config: {
        bypassToken: process.env.VERCEL_BYPASS_TOKEN,
      },
    },
  },
  experimental: {
    payloadExtraction: 'client',
  },
  runtimeConfig: {
    assistant: {
      // Gateway model serving /api/assistant (can be overridden with NUXT_ASSISTANT_MODEL).
      model: 'anthropic/claude-sonnet-5',
    },
    public: {
      mdc: {
        headings: {
          anchorLinks: {
            h2: true,
            h3: true,
            h4: true,
          },
        },
      },
    },
  },
})
