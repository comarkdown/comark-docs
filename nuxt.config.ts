import { defineNuxtConfig } from 'nuxt/config'

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
    icon: { provider: 'iconify' },
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
      // When the layer is installed as a package these are nested deps, so Vite
      // needs the `comark-docs > x` resolution chain; when extended from a local
      // path (or run from the playground) they resolve plainly.
      include: ['beautiful-mermaid', 'motion-v'].map((id) =>
        import.meta.url.includes('node_modules') ? `comark-docs > ${id}` : id
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
