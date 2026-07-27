import { z } from 'zod'
import { withLeadingSlash } from 'ufo'

export default defineMcpTool({
  description:
    'Read a documentation page as markdown. Pass the page path from list-pages, e.g. /getting-started/installation.',
  inputSchema: {
    path: z.string().describe('Page path, e.g. /getting-started/installation'),
  },
  handler: async ({ path }) => {
    const cms = await getProdCMS()

    const markdown = await renderPageMarkdown(cms, withLeadingSlash(path))
    if (!markdown) {
      return {
        content: [{ type: 'text', text: `Page not found: ${path}. Use list-pages to see available paths.` }],
        isError: true,
      }
    }

    return {
      content: [{ type: 'text', text: markdown }],
    }
  },
})
