import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { useEvent } from 'nitropack/runtime'
import { getAgentDocument, listAgentPages } from '#agent-discovery'

export default defineMcpResource({
  name: 'page',
  title: 'Documentation page',
  description:
    'A documentation page as markdown, the same document `/raw/<path>.md` serves. Listing the resources lists every page; read one by its `docs://page/<path>` URI.',
  uri: new ResourceTemplate(`${PAGE_RESOURCE_PREFIX}{+route}`, {
    list: async () => {
      const pages = await listAgentPages(useEvent())
      return {
        resources: pages.map((page) => ({
          uri: pageResourceUri(page.route),
          name: page.title ?? page.route,
          description: page.description,
          mimeType: 'text/markdown',
        })),
      }
    },
  }),
  handler: async (uri: URL) => {
    const route = pageRouteFromUri(uri)
    const document = route ? await getAgentDocument(useEvent(), route) : null
    if (!document || 'redirect' in document) {
      throw new Error(`Page not found: ${uri.href}. List the resources to see every page.`)
    }
    return {
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: document.markdown }],
    }
  },
})
