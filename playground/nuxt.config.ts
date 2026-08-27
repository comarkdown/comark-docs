export default defineNuxtConfig({
  extends: ['..'],
  site: {
    url: 'https://docs-template.comark.dev',
    name: 'Comark Docs Template',
  },
  llms: {
    domain: 'https://docs-template.comark.dev',
    full: {
      title: 'Full documentation of Comark Docs Template',
      description: 'All pages concatenated in one file',
    },
  },
  app: {
    head: {
      link: [
        { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
})
