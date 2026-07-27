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
  ui: {
    content: true,
    prose: true,
  },
  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/tree/**', '/blob/**'],
  },
  // Fonts for the Satori template come from @nuxt/fonts (bundled with Nuxt UI),
  // resolved from the Geist families declared in theme.css.
  ogImage: {
    zeroRuntime: false,
  },
  icon: {
    provider: 'iconify',
  },
  vite: {
    optimizeDeps: {
      include: ['beautiful-mermaid', 'motion-v'],
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
