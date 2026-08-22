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
})
