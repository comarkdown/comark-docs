// Exercises the layer's brand config end-to-end: both wordmarks, the
// ecosystem popover, and the footer credit line.
export default defineAppConfig({
  seo: {
    siteName: 'Comark Docs',
  },
  header: {
    title: 'Comark Docs',
    logo: {
      mark: 'comark',
    },
    ecosystem: [{ mark: 'comark-cms', to: 'https://cms.comark.dev', label: 'Comark CMS' }],
    nav: [
      { label: 'Documentation', sections: ['getting-started', 'concepts'] },
    ],
  },
  footer: {
    icon: 'i-simple-icons-vercel',
    owner: 'Vercel',
  },
})
