// Vercel Build Output routes that serve raw markdown to agents asking for it. Injected ahead of the
// generated routing table (see `modules/markdown-rewrite.ts`), so the rewrite happens at the edge —
// *before* the ISR cache — and the HTML and markdown variants can never poison each other's cache
// entries. Same approach as Docus (nuxt-content/docus `markdown-rewrite`), but with generic patterns:
// comark-docs reads content at request time, so the page list isn't known at build time.

export interface VercelRoute {
  src: string
  dest: string
  headers?: Record<string, string>
  has?: Array<{ type: 'header'; key: string; value?: string }>
}

const MARKDOWN_HEADERS = {
  'content-type': 'text/markdown; charset=utf-8',
  // acceptmarkdown.com: negotiated responses must vary on Accept so shared caches key both variants.
  'vary': 'Accept',
}

// A rewrite fires when the client either negotiates markdown or is curl (agents shell out to it).
const MATCHERS: NonNullable<VercelRoute['has']>[] = [
  [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }],
  [{ type: 'header', key: 'user-agent', value: 'curl/.*' }],
]

// `src`/`dest` pairs, expanded per matcher below. Order matters: first match wins.
const REWRITES: Array<Pick<VercelRoute, 'src' | 'dest'>> = [
  // Landing page → the full docs index.
  { src: '^/$', dest: '/llms.txt' },
  // Every other extensionless page → its raw markdown mirror. Excluded: the mirrors themselves, API
  // routes, versioned previews (`/tree`, `/blob`, `/pr` serve HTML only), Nuxt/Nitro internals
  // (`_nuxt`, `__nuxt_island`, …), the MCP endpoint and the layer-owned `/logos` page (not
  // content-derived, so it has no mirror). `[^.]` also skips every dotted path: `llms.txt`,
  // `sitemap.xml`, `robots.txt`, `favicon.ico`, `/.well-known/**`, …
  { src: '^/(?!raw/|api/|tree/|blob/|pr/|mcp$|logos$|_)([^.]+?)/?$', dest: '/raw/$1.md' },
]

/** The full route list to prepend to `.vercel/output/config.json`. */
export function buildMarkdownRewriteRoutes(): VercelRoute[] {
  return REWRITES.flatMap((rewrite) =>
    MATCHERS.map((has) => ({ ...rewrite, headers: MARKDOWN_HEADERS, has }))
  )
}
