import { createComarkSource } from '#agent-discovery/comark'

const source = createComarkSource(() => getProdContent())

/**
 * Content adapter behind nuxt-agent-discovery: the raw markdown route, `sitemap.md`, the `llms.txt`
 * bridge and the MCP helpers all read production content through it. Versioned previews (`/tree`,
 * `/blob`, `/pr`) are excluded from negotiation in nuxt.config.ts and keep serving HTML.
 *
 * The full listing (no selector) comes from `listDocsPages()` instead of the navigation tree alone, so
 * `sitemap.md` lists a directory index once and keeps the pages hidden from the sidebar, the same as
 * `sitemap.xml` and `llms.txt`.
 */
export default {
  ...source,
  async list(selector, event) {
    if (selector) return source.list?.(selector, event) ?? null
    const pages = await listDocsPages(await getProdContent())
    return pages.map((page) => ({
      route: page.path,
      title: page.title,
      description: page.description,
      section: page.section,
    }))
  },
} satisfies typeof source
