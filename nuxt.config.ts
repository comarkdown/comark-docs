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
  ],
  ui: { content: true, prose: true },
  sitemap: { 
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/tree/**', '/blob/**']
  },
  ogImage: { zeroRuntime: false },
  icon: {
    provider: 'iconify',
    customCollections: layerIconCollections() as never,
    clientBundle: { includeCustomCollections: false },
  },
  vite: {
    optimizeDeps: {
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
