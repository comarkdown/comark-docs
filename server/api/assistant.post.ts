import {
  streamText,
  tool,
  isStepCount,
  convertToModelMessages,
  toUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod'
import type { NavigationItem } from 'comark-content'
import { getAgentDocument } from '#agent-discovery'

/** Keep the context bounded on a public endpoint: only the tail of long conversations is forwarded. */
const MAX_MESSAGES = 20

function pageIndex(navigation: NavigationItem[]): string {
  const lines: string[] = []
  const collect = (items: NavigationItem[], section?: string) => {
    for (const item of items) {
      if (item.page !== false && item.path) {
        lines.push(`${item.path} — ${item.title}${item.description ? `: ${item.description}` : ''}`)
      }
      if (item.children?.length) collect(item.children, section ?? item.title)
    }
  }
  collect(navigation)
  return lines.join('\n')
}

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig()
  if (!appConfig.assistant?.enabled) {
    throw createError({ statusCode: 404, message: 'Assistant is not enabled on this site' })
  }

  // The gateway authenticates with an API key locally and OIDC on Vercel.
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw createError({ statusCode: 503, message: 'Assistant is not configured: set AI_GATEWAY_API_KEY' })
  }

  const { messages } = await readBody<{ messages: UIMessage[] }>(event)
  if (!Array.isArray(messages) || !messages.length) {
    throw createError({ statusCode: 400, message: 'messages is required' })
  }

  const site = getSiteConfig(event)
  const siteName = appConfig.seo?.siteName || site.name || 'this site'
  const content = await getProdContent()
  const navigation = await content.navigation()

  const result = streamText({
    model: gateway(useRuntimeConfig(event).assistant.model),
    system: `You are the documentation assistant of ${siteName} (${site.url}).

Answer questions using ONLY the documentation. Ground every answer:
1. Call search_docs with the user's terms, or get_page when you already know the page from the index below.
2. Read the relevant page(s) with get_page before answering anything non-trivial.
3. Answer concisely in markdown. Link the pages you used with relative paths, e.g. [Installation](/getting-started/installation).
4. If the documentation doesn't cover the question, say so — never invent APIs, options, or behavior.

Stay on the topic of ${siteName}. Politely refuse unrelated requests.

## Page index

${pageIndex(navigation)}`,
    messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES)),
    stopWhen: isStepCount(6),
    maxOutputTokens: 4096,
    providerOptions: {
      anthropic: { thinking: { type: 'adaptive' }, effort: 'low' },
      openai: { reasoningEffort: 'low', reasoningSummary: 'detailed' },
      google: { thinkingConfig: { includeThoughts: true, thinkingLevel: 'low' } },
    },
    tools: {
      search_docs: tool({
        description: 'Search the documentation. Returns matching sections with their page path and heading anchor.',
        inputSchema: z.object({
          query: z.string().describe('Search terms, e.g. "github source" or "custom components"'),
        }),
        execute: async ({ query }) => {
          const results = await searchDocSections(content, query)
          if (!results.length) return `No results for "${query}". Try other terms or get_page with a path from the page index.`
          return results
            .map((section) => {
              const crumb = [...section.titles, section.title].join(' > ')
              const snippet = section.content.slice(0, 200)
              return `${section.id}\n${crumb}${snippet ? `\n${snippet}` : ''}`
            })
            .join('\n\n')
        },
      }),
      get_page: tool({
        description: 'Read a documentation page as markdown. Pass a page path from the index, e.g. /getting-started/installation.',
        inputSchema: z.object({
          path: z.string().describe('Page path, e.g. /getting-started/installation'),
        }),
        execute: async ({ path }) => {
          const document = await getAgentDocument(event, path.startsWith('/') ? path : `/${path}`)
          if (!document) return `Page not found: ${path}. Use a path from the page index.`
          if ('redirect' in document) return `${path} is a section, not a page. Read ${document.redirect} instead.`
          return document.markdown
        },
      }),
    },
  })

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })
})
