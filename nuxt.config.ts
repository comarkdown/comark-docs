import { resolveModulePath } from 'exsolve'
import { defineNuxtConfig } from 'nuxt/config'
import { layerIconCollections } from './utils/icons'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-09',
  devtools: { enabled: true },
  // `modules/config` and `modules/css` aren't listed: Nuxt auto-scans `modules/`. They run after the
  // modules below, which is fine — neither seeds anything another module needs to see.
  modules: [
    '@nuxt/ui',
    '@comark/nuxt',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    'nuxt-seo-utils',
    'nuxt-og-image',
    '@nuxtjs/mcp-toolkit',
  ],
  // Static defaults for the modules above, here rather than in modules/config.ts so they land before any
  // module runs (seeding `ui.content` from a module that runs after @nuxt/ui never registers its content
  // components: no sidebar, TOC or search). Satori fonts: @nuxt/fonts via Nuxt UI, Geist from theme.css.
  ...({
    ui: { content: true, prose: true },
    // URLs come from the CMS navigation; previews are never indexed.
    sitemap: { sources: ['/api/__sitemap__/urls'], exclude: ['/tree/**', '/blob/**'] },
    // Render OG images at runtime (Satori) rather than prerendering them.
    ogImage: { zeroRuntime: false },
    // Collections handed over as data, not left to the consumer's node_modules layout (why: utils/icons.ts;
    // the `appConfig` half: modules/config.ts). Must live here, not in a module: @nuxt/icon gets a defu'd
    // *copy* of its options at setup time, so anything landing after it can no longer change bundling.
    icon: {
      provider: 'iconify',
      customCollections: layerIconCollections(),
      // `includeCustomCollections` defaults to true when `provider !== 'server'` — right for a small
      // hand-rolled SVG set, but these are three full Iconify collections (7k icons, ~8.7MB): inlining
      // them overruns the 256KB client-bundle limit and the template fails to compile; the API serves the rest.
      clientBundle: { includeCustomCollections: false },
    },
    // Spread untyped: module augmentations aren't visible when typechecking against `nuxt/config`.
  } as Record<string, unknown>),
  vite: {
    resolve: {
      // `beautiful-mermaid` statically imports the UMD `elkjs/lib/elk.bundled.js`, so it has to go through
      // the dep optimizer or hydration dies on "does not provide an export named 'default'". The alias is
      // what gets it there: Vite keys optimized deps by the literal `include` string and only maps a bare
      // import onto a bare key, so resolving the path in `include` instead builds a chunk nothing imports.
      // Resolved from the layer, since that's where the dep is — the consumer's root can't see it.
      alias: { 'beautiful-mermaid': resolveModulePath('beautiful-mermaid', { from: import.meta.url }) },
    },
    // Do NOT add `elkjs`: a second entry on the same file splits it out of that chunk and returns the crash.
    optimizeDeps: { include: ['beautiful-mermaid'] },
  },
  nitro: {
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
    public: {
      // Load-bearing despite looking like leftover MDC config — do not remove. Nuxt UI's prose headings
      // read this exact key and default *off* without it: `props.anchor ?? headings?.anchorLinks?.h2 ??
      // false` (@nuxt/ui 4.10, runtime/components/prose/H{1,2,3,4}.vue); nothing else supplies it and this
      // layer doesn't install MDC, so every heading silently loses its anchor link. comark-cms removed
      // this block as "unused code" in df12585 and lost the anchor links on its docs site.
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
