import { describe, expect, it } from 'vitest'
import { fetchWithFailure, INTRO_PAGE, NOT_FOUND_SLUG, request, SITE_URL } from './utils'

let requestId = 0

/** Calls the MCP server over streamable HTTP, without a session. */
async function mcp<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const response = await request('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => undefined)) as { message?: string } | undefined
    throw new Error(`MCP ${method} returned ${response.status}${error?.message ? `: ${error.message}` : ''}`)
  }

  const text = await response.text()
  // Streamable HTTP may answer with SSE instead of JSON.
  const json = text.startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data: '))?.slice(6)
  const payload = JSON.parse(json || '{}') as { result?: T; error?: { message: string } }
  if (payload.error) throw new Error(`MCP ${method} failed: ${payload.error.message}`)
  return payload.result as T
}

async function listTools(): Promise<string[]> {
  const { tools } = await mcp<{ tools: Array<{ name: string }> }>('tools/list')
  return tools.map((tool) => tool.name)
}

/** Joins the text parts, `isError` defaults to `false`. */
async function callTool(name: string, args: Record<string, unknown>) {
  const result = await mcp<{ content: Array<{ text: string }>; isError?: boolean }>('tools/call', { name, arguments: args })
  return { text: result.content.map((part) => part.text).join('\n'), isError: result.isError ?? false }
}

describe('mcp', () => {
  it('lists the layer tools', async () => {
    expect(await listTools()).toEqual(expect.arrayContaining(['list-pages', 'get-page', 'search-docs']))
  })

  // Clients discover the server through its card, which is written separately from the toolkit's config.
  it('advertises the endpoint and the same tools in its server card', async () => {
    const { response, failure } = await fetchWithFailure('/.well-known/mcp/server-card.json')
    expect(response.status, failure).toBe(200)

    const card = (await response.json()) as { endpoints: Array<{ url: string }>; tools: Array<{ name: string }> }
    expect(card.endpoints.map((endpoint) => endpoint.url)).toEqual([`${SITE_URL}/mcp`])
    expect(card.tools.map((tool) => tool.name).sort()).toEqual((await listTools()).sort())
  })

  it('list-pages lists the docs pages', async () => {
    const { text, isError } = await callTool('list-pages', {})
    expect(isError).toBe(false)
    expect(text).toContain(`${INTRO_PAGE.path} — ${INTRO_PAGE.title}`)
  })

  it('get-page reads a page as markdown', async () => {
    const { text, isError } = await callTool('get-page', { path: INTRO_PAGE.path })
    expect(isError).toBe(false)
    expect(text).toMatch(new RegExp(`^# ${INTRO_PAGE.title}$`, 'm'))
  })

  it('get-page keeps only the requested sections', async () => {
    const { text } = await callTool('get-page', { path: INTRO_PAGE.path, sections: ['How it works'] })
    expect(text.split('\n').filter((line) => line.startsWith('## '))).toEqual(['## How it works'])
  })

  it.each([
    [`/${NOT_FOUND_SLUG}`, 'Page not found'],
    ['/getting-started', 'is a section, not a page'],
  ])('get-page reports %s as an error', async (path, message) => {
    const { text, isError } = await callTool('get-page', { path })
    expect(isError).toBe(true)
    expect(text).toContain(message)
  })

  it('search-docs returns matching sections with their anchor', async () => {
    const { text } = await callTool('search-docs', { query: 'versioned previews' })
    expect(text).toContain('/concepts/versioned-previews#')
  })
})
