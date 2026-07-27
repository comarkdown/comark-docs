import { defineNuxtConfig } from 'nuxt/config'
import { createResolver } from '@nuxt/kit'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  compatibilityDate: '2026-06-09',
  devtools: { enabled: true },
  modules: [
    resolve('./modules/config'),
    resolve('./modules/css'),
    '@nuxt/ui',
    '@comark/nuxt',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    'nuxt-seo-utils',
    'nuxt-og-image',
    '@nuxtjs/mcp-toolkit',
  ],
  // Module-augmented option keys (`ui`, `sitemap`, `ogImage`, `icon`) are
  // seeded by modules/config.ts: their NuxtConfig augmentations aren't visible
  // when typechecking the layer's own nuxt.config against `nuxt/config`.
  // (Satori fonts come from @nuxt/fonts, bundled with Nuxt UI, resolved from
  // the Geist families declared in theme.css.)
  vite: {
    optimizeDeps: {
      // CJS deps that must be pre-bundled. When the layer is installed as a
      // package they are nested deps, so Vite needs the `comark-docs > x`
      // resolution chain; when extended from a local path they resolve plainly.
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
