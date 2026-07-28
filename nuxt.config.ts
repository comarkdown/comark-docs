import { resolveModulePath } from 'exsolve'
import { defineNuxtConfig } from 'nuxt/config'
import { layerIconCollections } from './utils/icons'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-09',
  devtools: { enabled: true },
  // `modules/config` and `modules/css` aren't listed: Nuxt auto-scans the
  // layer's `modules/` directory. They run after the modules below, which is
  // fine — neither seeds anything another module needs to see (see the static
  // defaults underneath).
  modules: [
    '@nuxt/ui',
    '@comark/nuxt',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    'nuxt-seo-utils',
    'nuxt-og-image',
    '@nuxtjs/mcp-toolkit',
  ],
  // Static defaults for the modules above. These live here, not in
  // modules/config.ts, so they're part of the resolved config *before* any
  // module runs — module order can't affect them. (Seeding `ui.content` from a
  // module is order-dependent: land after @nuxt/ui and its content components
  // are never registered, silently removing the sidebar, TOC and search.)
  // Satori fonts come from @nuxt/fonts, bundled with Nuxt UI, resolved from
  // the Geist families declared in theme.css.
  ...({
    // Nuxt UI content components + prose styles.
    ui: { content: true, prose: true },
    // Sitemap URLs come from the CMS navigation; previews are never indexed.
    sitemap: { sources: ['/api/__sitemap__/urls'], exclude: ['/tree/**', '/blob/**'] },
    // Render OG images at runtime (Satori) rather than prerendering them.
    ogImage: { zeroRuntime: false },
    // Icon collections are handed over as data, not left to the consumer's
    // node_modules layout — see `utils/icons.ts` for why, and modules/config.ts for
    // the `appConfig` half. This has to live here rather than in a module:
    // `defineNuxtModule` hands @nuxt/icon a defu'd *copy* of its options at setup
    // time, so a module landing after it (as every auto-scanned `modules/` file
    // does) can no longer influence what gets bundled.
    icon: {
      provider: 'iconify',
      customCollections: layerIconCollections(),
      // `includeCustomCollections` defaults to true when `provider !== 'server'`,
      // which is right for a small hand-rolled SVG set — there'd be nowhere else to
      // serve it from — but these are three full Iconify collections (7k icons,
      // ~8.7MB). Inlining them all overruns the 256KB client-bundle limit and the
      // template fails to compile. Bundle only what's actually used; the Iconify API
      // covers the rest, exactly as it does for every other collection.
      clientBundle: { includeCustomCollections: false },
    },
    // Spread untyped: these keys are module augmentations, which aren't visible
    // while typechecking the layer's own nuxt.config against `nuxt/config`.
  } as Record<string, unknown>),
  vite: {
    optimizeDeps: {
      // Deps that must go through the dep optimizer, or the browser gets
      // `module.exports` and dies on "does not provide an export named
      // 'default'", taking hydration down on every page.
      //
      // `beautiful-mermaid` matters because of what it pulls in: it statically
      // imports the UMD `elkjs/lib/elk.bundled.js`. Optimizing beautiful-mermaid
      // inlines elkjs into its chunk, so the browser never sees the raw UMD.
      // Do NOT add an entry for elkjs itself — a second entry pointing at the
      // same file splits it back out and reintroduces the hydration crash.
      //
      // Resolved to absolute entry paths from the layer, because every relative form
      // is wrong in at least one install mode. Vite resolves a bare id in
      // `optimizeDeps.include` with *no importer* — i.e. from the consuming app's
      // root — and these are the layer's dependencies, not the consumer's. The
      // `comark-docs > x` chain fixes that only while the layer really is under the
      // consumer's node_modules: extend a local checkout (the documented
      // `COMARK_DOCS_LAYER=…` dev loop) and the id goes back to bare, resolves
      // against a root that has never heard of it, and nothing is optimized — which
      // is precisely how the raw UMD elkjs reaches the browser.
      //
      // An absolute path is resolvable without an importer, so it holds in all three
      // modes: installed as a package, extended from a local path, and this repo's
      // own playground. The nested syntax can't express it — Vite reads the part
      // before `>` as a package *name* (`nestedResolveBasedir`), not a directory.
      include: ['beautiful-mermaid', 'motion-v', '@vueuse/core'].map((id) =>
        resolveModulePath(id, { from: import.meta.url })
      ),
    },
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
      // Force Nuxt UI Prose headings component to generate links: https://github.com/nuxt/ui/blob/f546b2c9008044a48e4e9a1d08e9082d5012b200/src/runtime/components/prose/H2.vue#L39
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
