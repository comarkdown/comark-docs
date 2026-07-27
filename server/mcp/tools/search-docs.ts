import { z } from 'zod'

export default defineMcpTool({
  description:
    'Search the documentation. Returns matching sections with their page path and heading anchor.',
  inputSchema: {
    query: z.string().describe('Search terms, e.g. "github source" or "full text search"'),
  },
  handler: async ({ query }) => {
    const cms = await getProdCMS()
    const sections = await buildSearchSections(cms)

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const scored = sections
      .map((section) => {
        const haystackTitle = [section.title, ...section.titles].join(' ').toLowerCase()
        const haystackContent = section.content.toLowerCase()
        let score = 0
        for (const term of terms) {
          if (haystackTitle.includes(term)) score += 3
          if (haystackContent.includes(term)) score += 1
        }
        return { section, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    if (!scored.length) {
      return {
        content: [{ type: 'text', text: `No results for "${query}". Try list-pages to browse all pages.` }],
      }
    }

    const text = scored
      .map(({ section }) => {
        const crumb = [...section.titles, section.title].join(' > ')
        const snippet = section.content.slice(0, 200)
        return `${section.id}\n${crumb}${snippet ? `\n${snippet}` : ''}`
      })
      .join('\n\n')

    return {
      content: [{ type: 'text', text }],
    }
  },
})
