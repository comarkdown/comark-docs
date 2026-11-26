import { getAgentSiteUrl } from '#agent-discovery'
import { joinURL } from 'ufo'

/** A search query, not a document: anything larger is refused before it is buffered. */
const MAX_QUERY_BODY = 16 * 1024

/**
 * Search for agents (https://blog.cloudflare.com/search-for-agents/): ranked documentation sections as
 * Markdown, for `GET ?q=` and the HTTP `QUERY` method (RFC 10008) with a plain-text or JSON body. Reads
 * production content, like the MCP `search-docs` tool, through the same index.
 */
export default defineEventHandler(async (event) => {
  // h3's `HTTPMethod` type predates `QUERY`.
  const method: string = event.method
  if (method !== 'GET' && method !== 'QUERY') {
    setResponseHeader(event, 'allow', 'GET, QUERY')
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  let query = String(getQuery(event).q ?? '')
  if (method === 'QUERY') {
    // h3 v1's `readRawBody()` only reads PATCH, POST, PUT, and DELETE bodies.
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of event.node.req) {
      size += (chunk as Buffer).length
      if (size > MAX_QUERY_BODY) throw createError({ statusCode: 413, statusMessage: 'Query body too large' })
      chunks.push(chunk as Buffer)
    }
    const body = Buffer.concat(chunks).toString('utf8')
    const mediaType = getRequestHeader(event, 'content-type')?.split(';')[0]!.trim().toLowerCase()
    const isJson = mediaType === 'application/json'
    try {
      query = isJson ? String(JSON.parse(body).q ?? '') : body
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid JSON body' })
    }
  }
  query = query.trim()
  if (!query) throw createError({ statusCode: 400, statusMessage: 'Missing `q` parameter' })

  const sections = await searchDocSections(await getProdContent(), query)
  const siteUrl = getAgentSiteUrl(event)
  const results = sections.map((section) => {
    const heading = [...section.titles, section.title].filter(Boolean).join(' > ')
    return `## ${heading}\n\nURL: ${joinURL(siteUrl, section.id)}${section.content ? `\n\n${section.content}` : ''}`
  })

  setResponseHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  if (!results.length) return `# No results for: "${query}"\n\nTry fewer or broader terms, or browse ${joinURL(siteUrl, 'sitemap.md')}.\n`
  return [`# Search results for: "${query}"`, ...results].join('\n\n---\n\n') + '\n'
})
