export default defineNuxtConfig({
  extends: ['..'],
  site: {
    url: 'https://docs.comark.dev',
    name: 'Comark Docs',
  },
  llms: {
    domain: 'https://docs.comark.dev',
    full: {
      title: 'Full documentation',
      description: 'All pages concatenated in one file',
    },
  },
})
