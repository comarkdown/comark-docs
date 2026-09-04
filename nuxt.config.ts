import { fileURLToPath } from 'node:url'
import { resolveModulePath } from 'exsolve'
import { defineNuxtConfig } from 'nuxt/config'
import { layerIconCollections } from './utils/icons'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-09',
  devtools: { enabled: true },
  modules: [
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
    sources: ['/api/__sitemap__/urls'], exclude: ['/tree/**', '/blob/**', '/pr/**']
  },
  // Markdown for agents: content negotiation on every page, `/raw/**`, the `llms.txt` bridge, `sitemap.md`,
  // the api-catalog, the MCP server card and Agent Skills. Every page negotiates, since the content sections
  // are only known at request time. The server card is seeded in modules/config.ts, where the site name is.
  agentDiscovery: {
    // comark sites build their own content instance, so the adapter is a file rather than auto-detected.
    source: fileURLToPath(new URL('./server/utils/agent-source.ts', import.meta.url)),
    // Versioned previews serve HTML only, and `/logos` is a layer page with no document behind it.
    excludePrefixes: { extend: ['/tree/', '/blob/', '/pr/', '/logos'] },
    discovery: {
      // Name, version and description are filled in by modules/config.ts, where the site name is resolved.
      mcpServerCard: { endpoint: '/mcp', name: '' },
      links: [{ href: '/rss.xml', rel: 'alternate', type: 'application/rss+xml', title: 'RSS feed of the documentation' }],
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
    // `llms.txt` sections come from the content navigation at request time. Listed here rather than scanned from
    // `server/plugins/` so the hook runs ahead of the nuxt-agent-discovery bridge (see the plugin).
    plugins: [fileURLToPath(new URL('./modules/runtime/server/plugins/llms.ts', import.meta.url))],
    routeRules: {
      '/llms.txt': { prerender: false },
      '/llms-full.txt': { prerender: false },
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
