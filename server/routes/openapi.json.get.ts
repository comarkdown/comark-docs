import { agentDiscoveryOpenApi, getAgentSiteUrl } from '#agent-discovery'

/**
 * The routes an agent can call on this site: the markdown twin of every page, the discovery documents
 * and the MCP endpoint, described by nuxt-agent-discovery from the same route config that serves them.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const discovery = agentDiscoveryOpenApi(event, { reserved: ['searchDocs'] })
  const siteName = config.public.agentDiscovery?.siteName || 'Documentation'

  return {
    openapi: '3.1.0',
    info: {
      title: siteName,
      description: `Markdown representations of every ${siteName} page, the documents agents discover the site through, and its MCP endpoint.`,
      version: config.docs.version,
    },
    servers: [{ url: getAgentSiteUrl(event) }],
    tags: discovery.tags,
    paths: {
      ...discovery.paths,
      // server/routes/.well-known/search.ts
      '/.well-known/search': {
        get: {
          tags: ['Discovery'],
          operationId: 'searchDocs',
          summary: 'Search the documentation',
          description: 'Ranked documentation sections matching the query, as Markdown. Also answers the HTTP QUERY method with a plain-text or JSON (`{"q": "..."}`) body.',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Keywords or a natural-language query.' }],
          responses: {
            200: { description: 'Matching sections, each with its heading trail, URL, and text.', content: { 'text/markdown': { schema: { type: 'string' } } } },
            400: { description: 'The query is missing.' },
          },
        },
      },
    },
    components: discovery.components,
  }
})
