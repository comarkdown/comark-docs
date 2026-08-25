// Vercel Build Output routes that redirect agents asking for markdown to the raw mirrors. Injected
// ahead of the generated routing table (see `modules/markdown-rewrite.ts`). These must be redirects,
// not rewrites: the ISR (prerender) cache is keyed on the *request* path only and ignores `Vary`, so
// a rewrite would let the HTML and markdown variants poison each other's cache entry for the same
// URL. A 307 resolves client-side before any cache lookup, and each path keeps a single variant.

export interface VercelRoute {
  src: string
  status?: number
  headers?: Record<string, string>
  has?: Array<{ type: 'header'; key: string; value?: string }>
}

// A redirect fires when the client either negotiates markdown or is curl (agents shell out to it).
const MATCHERS: NonNullable<VercelRoute['has']>[] = [
  [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }],
  [{ type: 'header', key: 'user-agent', value: 'curl/.*' }],
]

// `src`/`location` pairs, expanded per matcher below. Order matters: first match wins.
const REDIRECTS: Array<{ src: string; location: string }> = [
  // Landing page → the full docs index.
  { src: '^/$', location: '/llms.txt' },
  // Every other extensionless page → its raw markdown mirror. Excluded: the mirrors themselves, API
  // routes, versioned previews (`/tree`, `/blob`, `/pr` serve HTML only), Nuxt/Nitro internals
  // (`_nuxt`, `__nuxt_island`, …), the MCP endpoint and the layer-owned `/logos` page (not
  // content-derived, so it has no mirror). `[^.]` also skips every dotted path: `llms.txt`,
  // `sitemap.xml`, `robots.txt`, `favicon.ico`, `/.well-known/**`, …
  { src: '^/(?!raw/|api/|tree/|blob/|pr/|mcp$|logos$|_)([^.]+?)/?$', location: '/raw/$1.md' },
]

/** The full route list to prepend to `.vercel/output/config.json`. */
export function buildMarkdownRewriteRoutes(): VercelRoute[] {
  return REDIRECTS.flatMap(({ src, location }) =>
    MATCHERS.map((has) => ({
      src,
      status: 307,
      headers: {
        Location: location,
        // acceptmarkdown.com: negotiated responses must vary on Accept so shared caches key both variants.
        vary: 'Accept',
      },
      has,
    }))
  )
}
