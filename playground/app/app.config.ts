// Exercises the layer's brand config end-to-end: both wordmarks, the
// ecosystem popover, and the footer credit line.
export default defineAppConfig({
  seo: {
    siteName: 'Comark Docs Template',
  },
  header: {
    title: 'Comark Docs Template',
    logo: {
      mark: 'comark',
    },
    ecosystem: [{ mark: 'comark-content', to: 'https://content.comark.dev', label: 'Comark Content' }],
    nav: [
      { label: 'Documentation', sections: ['getting-started', 'writing', 'concepts', 'deployment'] },
    ],
  },
  footer: {
    icon: 'i-simple-icons-vercel',
    owner: 'Vercel, Inc',
    links: [
      { icon: 'i-simple-icons-github', to: 'https://github.com/comarkdown/comark-docs', target: '_blank', 'aria-label': 'GitHub' },
    ]
  },
  assistant: {
    enabled: true,
    faqQuestions: [
      {
        category: 'Getting Started',
        items: ['How do I set up a docs site with this layer?', 'How does content get served from GitHub?'],
      },
    ],
  },
})
